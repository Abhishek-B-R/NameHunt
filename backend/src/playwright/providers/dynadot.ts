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
      timeout: opts.timeoutMs ?? 60000,
    });

    await sleep(800 + Math.random() * 600);

    // Find the exact row. Prefer the specific result-row container.
    let row = page
      .locator(
        [
          `div.result-row:has(.search-domain-word:has-text("${domain}"))`,
          `div[role="row"]:has(.search-domain-word:has-text("${domain}"))`,
          `.domain-search-result:has(.search-domain-word:has-text("${domain}"))`,
          `.domain-result:has(.search-domain-word:has-text("${domain}"))`,
          `li:has(.search-domain-word:has-text("${domain}"))`,
          `tr:has(.search-domain-word:has-text("${domain}"))`,
        ].join(", ")
      )
      .first();

    // If that fails, fallback to a text has selector, then refine to exact .search-domain-word
    if (!(await row.isVisible().catch(() => false))) {
      row = page
        .locator(
          [
            `div.result-row:has-text("${domain}")`,
            `div[role="row"]:has-text("${domain}")`,
            `.domain-search-result:has-text("${domain}")`,
            `.domain-result:has-text("${domain}")`,
            `li:has-text("${domain}")`,
            `tr:has-text("${domain}")`,
          ].join(", ")
        )
        .first();
    }

    await row.waitFor({ timeout: 15000 });

    if (!(await row.isVisible().catch(() => false))) {
      const body = (await page.innerText("body").catch(() => "")) || "";
      await ctx.close();
      if (opts.ephemeralProfile !== false)
        await fs.remove(profileDir).catch(() => {});
      return {
        ok: false,
        domain,
        error: "Result row not found",
        rawText: body.slice(0, 900),
      };
    }

    // Confirm the row domain matches exactly
    const rowDomainText =
      (await row
        .locator(".search-domain-word")
        .first()
        .innerText()
        .catch(() => "")) || "";
    if (
      rowDomainText &&
      rowDomainText.trim().toLowerCase() !== domain.toLowerCase()
    ) {
      const exactRow = page
        .locator(
          `div.result-row:has(.search-domain-word:has-text("${domain}"))`
        )
        .first();
      if (await exactRow.isVisible().catch(() => false)) {
        row = exactRow;
      }
    }

    await sleep(300);

    const rowText = (await row.innerText().catch(() => "")) || "";

    // Availability markers from this row only
    const saysAvailable =
      (await row.locator('.search-domain:has-text("is available")').count()) >
        0 || /\bis available\b/i.test(rowText);

    const negativeTaken =
      /\btaken\b/i.test(rowText) ||
      /unavailable/i.test(rowText) ||
      /already registered/i.test(rowText) ||
      /backorder/i.test(rowText) ||
      /auction/i.test(rowText) ||
      /make\s+an?\s+offer/i.test(rowText) ||
      /whois/i.test(rowText);

    // If unavailable, return immediately with no prices to avoid leakage from neighbors
    if (negativeTaken && !saysAvailable) {
      await ctx.close();
      if (opts.ephemeralProfile !== false)
        await fs.remove(profileDir).catch(() => {});
      return {
        ok: true,
        domain,
        available: false,
        isPremium: /premium/i.test(rowText) || undefined,
        registrationPrice: undefined,
        renewalPrice: undefined,
        currency: undefined,
        rawText: rowText.slice(0, 900),
      };
    }

    // Renewal price from this row
    const renewalText =
      (await row
        .locator(".search-renewal")
        .first()
        .innerText()
        .catch(() => "")) || "";
    const renewalParsed = parsePrice(renewalText);
    const renewalPrice = renewalParsed.amount;

    // Registration price from this row
    let regText =
      (await row
        .locator(".domain-price .search-price")
        .first()
        .innerText()
        .catch(() => "")) || "";
    let regParsed = parsePrice(regText);
    let registrationPrice = regParsed.amount;

    // Fallback to crossed regular price
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

    // Final fallback: compute from price tokens within this row only
    if (registrationPrice === undefined) {
      const priceTokens = await row
        .locator(".domain-price, .search-price-group, [class*='price']")
        .allInnerTexts()
        .catch(() => [] as string[]);
      const joined = priceTokens.join(" ");
      const prices = parseAllPrices(joined)
        .map((p) => p.amount)
        .filter((n): n is number => !!n);
      if (prices.length) {
        const uniq = Array.from(new Set(prices));
        if (renewalPrice !== undefined) {
          const candidates = uniq.filter(
            (a) => Math.abs(a - renewalPrice) > 1e-6
          );
          registrationPrice = candidates.length
            ? Math.max(...candidates)
            : Math.max(...uniq);
        } else {
          registrationPrice = Math.max(...uniq);
        }
      }
    }

    // Currency from this row
    const currency =
      regParsed.currency ||
      renewalParsed.currency ||
      (parseAllPrices(rowText)[0]?.currency as string | undefined) ||
      "USD";

    // Cart presence
    const hasCart =
      (await row
        .locator(
          [
            ".add-to-cart-widget-icon",
            'button:has-text("Add to Cart")',
            'a:has-text("Add to Cart")',
            '[aria-label*="Add to cart"]',
          ].join(", ")
        )
        .first()
        .isVisible()
        .catch(() => false)) || /add to cart/i.test(rowText);

    // Final availability from this row only
    const available =
      !negativeTaken &&
      (saysAvailable || hasCart || registrationPrice !== undefined);

    // Premium badge from this row
    const premiumBadge =
      (await row.locator("#premium-link, .search-registry-premium").count()) >
        0 || /premium/i.test(rowText);

    const isPremium =
      premiumBadge || (registrationPrice ? registrationPrice > 100 : false);

    await ctx.close();
    if (opts.ephemeralProfile !== false)
      await fs.remove(profileDir).catch(() => {});

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
