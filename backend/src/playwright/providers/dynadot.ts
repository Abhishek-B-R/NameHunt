import fs from "fs-extra";
import * as path from "path";
import * as crypto from "crypto";
import { newStealthContext } from "../browser.js";
import type { DCResult } from "../../types/resultSchema.js";
import type { RunOpts } from "../../types/runOptions.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function freshProfileDir(base = "/tmp") {
  const id = crypto.randomBytes(6).toString("hex");
  return path.join(base, `dd_${id}`);
}

function parsePrice(text: string) {
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

function parseAllPrices(text: string) {
  const rx = /(?:₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*[0-9][\d,]*\.?\d*/g;
  const matches = (text.match(rx) || []).map((m) => {
    const { amount, currency } = parsePrice(m);
    return { amount, currency, raw: m };
  });
  return matches;
}

export async function checkDynadot(
  domain: string,
  opts: RunOpts = {}
): Promise<DCResult> {
  const profileDir =
    opts.ephemeralProfile === false
      ? path.join(opts.profileBaseDir || "./profiles", "dynadot")
      : freshProfileDir(opts.profileBaseDir || "/tmp");

  await fs.ensureDir(profileDir);

  const ctx = await newStealthContext({
    profileDir,
    headless: opts.headless ?? false,
    locale: opts.locale || "en-US",
    timezoneId: opts.timezoneId || "America/New_York",
  });

  const page = await ctx.newPage();

  try {
    const url = `https://www.dynadot.com/?domain=${encodeURIComponent(domain)}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 90000,
    });

    await sleep(800 + Math.random() * 600);

    // Target the exact row that contains the exact domain
    // Their markup shows: .result-row .search-domain-word == domain
    const exactRowSel = `div.result-row:has(.search-domain-word:has-text("${domain}"))`;
    await page.locator(exactRowSel).first().waitFor({ timeout: 20000 });

    let row = page.locator(exactRowSel).first();

    // Verify match
    const rowDomainText =
      (await row.locator(".search-domain-word").first().innerText().catch(() => "")) ||
      "";
    if (rowDomainText.trim().toLowerCase() !== domain.toLowerCase()) {
      const fallback = page
        .locator(
          [
            `div[role="row"]:has(.search-domain-word:has-text("${domain}"))`,
            `.domain-search-result:has(.search-domain-word:has-text("${domain}"))`,
          ].join(", ")
        )
        .first();
      if (await fallback.isVisible().catch(() => false)) row = fallback;
    }

    // Pull text for rawText but only from this row
    const rowText = (await row.innerText().catch(() => "")) || "";

    // Strict availability from row-only DOM
    const hasAvailablePhrase =
      (await row.locator('.search-domain:has-text("is available")').count()) > 0;

    const hasTakenBadge =
      (await row.locator(".search-taken-row-text:has-text('Taken')").count()) >
        0 ||
      (await row.locator(".search-taken-row").count()) > 0;

    const hasCartIcon =
      (await row.locator(".add-to-cart-widget-icon, .search-shop-cart").count()) >
      0;

    const hasVisiblePrice =
      (await row.locator(".domain-price .search-price").count()) > 0;

    // Decide availability
    // If row explicitly says Taken, mark unavailable.
    // Else if "is available" or cart or price exists, mark available.
    let available: boolean;
    if (hasTakenBadge) {
      available = false;
    } else if (hasAvailablePhrase || hasCartIcon || hasVisiblePrice) {
      available = true;
    } else {
      // conservative fallback: look at the colorized search-domain block text
      // but default to false if neither positive nor negative signals.
      available = false;
    }

    // Prices from row
    // Registration price: .domain-price .search-price
    const regText =
      (await row
        .locator(".domain-price .search-price")
        .first()
        .innerText()
        .catch(() => "")) || "";
    const regParsed = parsePrice(regText);
    let registrationPrice = regParsed.amount;

    // Renewal price: from .search-renewal
    const renewalText =
      (await row
        .locator(".search-renewal")
        .first()
        .innerText()
        .catch(() => "")) || "";
    const renewalParsed = parsePrice(renewalText);
    const renewalPrice = renewalParsed.amount;

    // Fallbacks, but still scoped to the row
    if (registrationPrice === undefined) {
      const prevText =
        (await row
          .locator(".domain-price .prev-price")
          .first()
          .innerText()
          .catch(() => "")) || "";
      const prevParsed = parsePrice(prevText);
      if (prevParsed.amount !== undefined) {
        registrationPrice = prevParsed.amount;
      }
    }

    if (registrationPrice === undefined) {
      const priceTokens = await row
        .locator(".domain-price, .search-price-group, [class*='price']")
        .allInnerTexts()
        .catch(() => [] as string[]);
      const joined = priceTokens.join(" ");
      const prices = parseAllPrices(joined)
        .map((p) => p.amount)
        .filter((n): n is number => typeof n === "number");
      if (prices.length) {
        // For premium, .prev-price shows regular, .search-price shows sale
        // Prefer the larger one as the safe regPrice
        registrationPrice = Math.max(...prices);
      }
    }

    // Currency preference from reg, then renewal, then any price in row
    let currency =
      regParsed.currency ||
      renewalParsed.currency ||
      (parseAllPrices(rowText)[0]?.currency as string | undefined) ||
      "USD";

    // Premium badge detection
    const isPremium =
      (await row.locator("#premium-link.search-registry-premium").count()) > 0 ||
      /registry\s+premium/i.test(rowText);

    await ctx.close();
    if (opts.ephemeralProfile !== false) {
      await fs.remove(profileDir).catch(() => {});
    }

    return {
      ok: true,
      domain,
      available,
      isPremium: isPremium || undefined,
      registrationPrice,
      renewalPrice,
      currency,
      rawText: rowText.slice(0, 900),
    };
  } catch (e: any) {
    try {
      await ctx.close();
    } catch {}
    if (opts.ephemeralProfile !== false) {
      await fs.remove(profileDir).catch(() => {});
    }
    return { ok: false, domain, error: e?.message || "Navigation failed" };
  }
}