import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { newStealthContext } from "../browser.js";
import type { DCResult } from "../../types/resultSchema.js";
import type { RunOpts } from "../../types/runOptions.js";

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function freshProfileDir(base = "/tmp") {
  const id = crypto.randomBytes(6).toString("hex");
  return path.join(base, `gd_${id}`);
}

function extractFirstPrice(text: string) {
  const m =
    text.match(/(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([0-9][\d,]*\.?\d*)/) ||
    text.match(/([0-9][\d,]*\.?\d*)\s*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)/);
  if (!m) return { amount: undefined, currency: undefined };
  const sym = (m[1] || m[2] || "").toUpperCase();
  const num = (m[2] || m[1] || "").replace(/[^\d.]/g, "");
  const amount = parseFloat(num);
  let currency: string | undefined;
  if (sym.includes("₹") || sym.includes("INR") || sym.includes("RS"))
    currency = "INR";
  else if (sym.includes("$") || sym.includes("USD")) currency = "USD";
  else if (sym.includes("€") || sym.includes("EUR")) currency = "EUR";
  else if (sym.includes("£") || sym.includes("GBP")) currency = "GBP";
  return { amount, currency };
}

export async function checkGoDaddy(
  domain: string,
  runOpts: RunOpts = {}
): Promise<DCResult> {
  const profileDir =
    runOpts.ephemeralProfile !== false
      ? freshProfileDir(runOpts.profileBaseDir || "/tmp")
      : path.join(runOpts.profileBaseDir || "./profiles", "godaddy");

  await fs.ensureDir(profileDir);

  const ctx = await newStealthContext({
    profileDir,
    headless: runOpts.headless ?? false,
    locale: runOpts.locale || "en-US",
    timezoneId: runOpts.timezoneId || "America/New_York",
    proxy: runOpts.proxy,
  });

  const page = await ctx.newPage();

  const cleanup = async () => {
    try {
      await ctx.close();
    } catch {}
    if (runOpts.ephemeralProfile !== false) {
      await fs.remove(profileDir).catch(() => {});
    }
  };

  try {
    const searchUrl =
      "https://www.godaddy.com/en-in/domainsearch/find?domainToCheck=" +
      encodeURIComponent(domain);

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: runOpts.timeoutMs ?? 90000,
      referer: "https://www.godaddy.com/",
    });

    // Small natural delays
    await sleep(800 + Math.random() * 600);

    // Cookie banner
    const cookieBtn = page.locator('button:has-text("Accept")').first();
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click().catch(() => {});
    }

    // Quick bot-wall check
    const bodyText = ((await page.textContent("body").catch(() => "")) || "")
      .trim();
    if (
      /access denied/i.test(bodyText) ||
      /don['’]t have permission/i.test(bodyText) ||
      /errors\.edgesuite\.net/i.test(bodyText)
    ) {
      await cleanup();
      return {
        ok: false,
        domain,
        error: "Access Denied by GoDaddy/Akamai",
        rawText: bodyText.slice(0, 900),
      };
    }

    // Wait for either exact match avail card or domain-taken (DBS) card to show up
    await Promise.race([
      page.locator('[data-cy="availcard"]').first().waitFor({ timeout: 30000 }),
      page.locator('[data-cy="dbsCard"]').first().waitFor({ timeout: 30000 }),
      sleep(30000),
    ]);

    // Try exact-match available card
    const availCard = page.locator('[data-cy="availcard"]').first();
    if ((await availCard.count()) > 0) {
      // Verify it is for the exact domain
      const domainText =
        (await availCard
          .locator('[data-testid="single-line-display"]')
          .innerText()
          .catch(() => "")) || "";
      const norm = domainText.replace(/\s+/g, "").toLowerCase();
      const expect = domain.replace(/\s+/g, "").toLowerCase();

      if (norm.includes(expect)) {
        // Prices
        const regText =
          (await availCard
            .locator('[data-testid="pricing-main-price"]')
            .innerText()
            .catch(() => "")) || "";
        const renewalText =
          (await availCard
            .locator('[data-testid="premium-renewal-price"]')
            .innerText()
            .catch(() => "")) || "";

        const reg = extractFirstPrice(regText);
        const ren = extractFirstPrice(renewalText);

        // Premium tag
        const tagText =
          (await availCard
            .locator('[data-testid="availableCard-tag"]')
            .innerText()
            .catch(() => "")) || "";
        const isPremium =
          /premium/i.test(tagText) ||
          (await availCard.locator('[data-testid="premium-renewal-price"]').count()) >
            0;

        if (reg.amount == null) {
          // If we cannot read the primary price, treat as error
          await cleanup();
          return {
            ok: false,
            domain,
            error: "Could not extract price from available card",
            rawText:
              ((await availCard.innerText().catch(() => "")) || "").slice(
                0,
                900
              ),
          };
        }

        await cleanup();
        return {
          ok: true,
          domain,
          available: true,
          isPremium,
          registrationPrice: reg.amount,
          renewalPrice: ren.amount,
          currency: reg.currency || ren.currency || "USD",
          rawText:
            ((await availCard.innerText().catch(() => "")) || "").slice(
              0,
              900
            ),
        };
      }
    }

    // Try exact-match Domain Taken DBS card
    const dbsCard = page.locator('[data-cy="dbsCard"]').first();
    if ((await dbsCard.count()) > 0) {
      const dnText =
        (await dbsCard.locator(".domain-name").innerText().catch(() => "")) ||
        "";
      const badgeText =
        (await dbsCard
          .locator('[data-cy="dbsV2-badge"]')
          .innerText()
          .catch(() => "")) || "";

      const norm = dnText.replace(/\s+/g, "").toLowerCase();
      const expect = domain.replace(/\s+/g, "").toLowerCase();

      if (/domain\s*taken/i.test(badgeText) && norm.includes(expect)) {
        await cleanup();
        return {
          ok: true,
          domain,
          available: false,
          isPremium: false,
          registrationPrice: undefined,
          renewalPrice: undefined,
          currency: undefined,
          rawText:
            ((await dbsCard.innerText().catch(() => "")) || "").slice(0, 900),
        };
      }
    }

    // If we got here, we did not find a trustworthy exact-match card
    const fallbackText =
      ((await page.textContent("body").catch(() => "")) || "").slice(0, 900);

    await cleanup();
    return {
      ok: false,
      domain,
      error: "Exact-match result card not found or unreadable",
      rawText: fallbackText,
    };
  } catch (e: any) {
    await cleanup();
    return {
      ok: false,
      domain,
      error: e?.message?.slice(0, 300) || "Navigation or extraction failed",
    };
  }
}