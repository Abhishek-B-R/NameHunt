import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { newStealthContext } from "../browser.js";
import type { DCResult } from "../../types/resultSchema.js";
import type { RunOpts } from "../../types/runOptions.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function freshProfileDir(base = "/tmp") {
  const id = crypto.randomBytes(6).toString("hex");
  return path.join(base, `dc_${id}`);
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

export async function checkDomainHover(
  domain: string,
  opts: RunOpts = {}
): Promise<DCResult> {
  const profileDir =
    opts.ephemeralProfile === false
      ? path.join(opts.profileBaseDir || "./profiles", "hover")
      : freshProfileDir(opts.profileBaseDir || "/tmp");

  await fs.ensureDir(profileDir);

  const ctx = await newStealthContext({
    profileDir,
    headless: opts.headless ?? false,
    locale: opts.locale || "en-US",
    timezoneId: opts.timezoneId || "America/New_York",
    proxy: opts.proxy,
  });

  const page = await ctx.newPage();

  try {
    const url = `https://www.hover.com/domains/results?q=${encodeURIComponent(
      domain
    )}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 60000,
    });

    await sleep(1000 + Math.random() * 800);

    // Wait for either results table/cards or known CTAs
    await Promise.race([
      page.waitForSelector(':has-text("Add to cart")', { timeout: 8000 }),
      page.waitForSelector(':has-text("Taken")', { timeout: 8000 }),
      page.waitForSelector(':has-text("Unavailable")', { timeout: 8000 }),
      page.waitForSelector(':has-text("Transfer")', { timeout: 8000 }),
      page.waitForSelector('[class*="result"], [class*="domain"], table, li', {
        timeout: 8000,
      }),
      sleep(8000),
    ]);

    // Find the exact domain row/card
    const candidates = [
      `li:has-text("${domain}")`,
      `tr:has-text("${domain}")`,
      `div[role="row"]:has-text("${domain}")`,
      `article:has-text("${domain}")`,
      `div:has-text("${domain}")`,
    ];

    let card = page.locator(candidates[0] || "").first();
    for (const sel of candidates) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible().catch(() => false)) {
        card = loc;
        break;
      }
    }

    if (!(await card.isVisible().catch(() => false))) {
      const bodyText = (await page.textContent("body").catch(() => "")) || "";
      await ctx.close();
      if (opts.ephemeralProfile !== false)
        await fs.remove(profileDir).catch(() => {});
      return {
        ok: false,
        domain,
        error: "Result card not found",
        rawText: bodyText.slice(0, 900),
      };
    }

    const cardText = (await card.innerText().catch(() => "")) || "";

    // Unavailability signals that Hover often uses
    // Taken, Unavailable, Already registered, Transfer, Make Offer style marketplace links
    const unavailable =
      /taken/i.test(cardText) ||
      /unavailable/i.test(cardText) ||
      /already\s*registered/i.test(cardText) ||
      /transfer/i.test(cardText) ||
      /make\s*offer/i.test(cardText);

    if (unavailable) {
      await ctx.close();
      if (opts.ephemeralProfile !== false)
        await fs.remove(profileDir).catch(() => {});
      return {
        ok: true,
        domain,
        available: false,
        rawText: cardText.slice(0, 900),
      };
    }

    // Available markers: Add to cart or a visible price on the exact domain row
    const hasAddToCart =
      (await card.locator('button:has-text("Add to cart")').count()) > 0 ||
      /add\s*to\s*cart/i.test(cardText);

    // Price extraction scoped to the exact card
    let priceText = "";
    const priceSelectors = [
      ".price",
      '[class*="price"]',
      'span:has-text("$")',
      'div:has-text("$")',
      'span:has-text("€")',
      'div:has-text("€")',
      'span:has-text("£")',
      'div:has-text("£")',
      'span:has-text("₹")',
      'div:has-text("₹")',
    ];

    for (const sel of priceSelectors) {
      const el = card.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        const t = (await el.innerText().catch(() => "")) || "";
        if (/[₹$€£]/.test(t)) {
          priceText = t;
          break;
        }
      }
    }
    if (!priceText) priceText = cardText;

    const reg = parsePrice(priceText);

    // Renewal price pattern if Hover shows it
    const renewMatch =
      cardText.match(
        /renew[s]?\s+at[^$€£₹]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([0-9][\d,]*\.?\d*)/i
      ) ||
      cardText.match(
        /then[^$€£₹]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([0-9][\d,]*\.?\d*)/i
      ) ||
      cardText.match(
        /renewal[^$€£₹]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([0-9][\d,]*\.?\d*)/i
      );

    const renewalPrice = renewMatch
      ? parseFloat((renewMatch[2] || "").replace(/[^\d.]/g, ""))
      : undefined;

    const available = hasAddToCart || reg.amount !== undefined;

    // Premium detection heuristic
    const isPremium =
      /premium/i.test(cardText) ||
      (reg.amount !== undefined ? reg.amount > 50 : undefined);

    await ctx.close();
    if (opts.ephemeralProfile !== false)
      await fs.remove(profileDir).catch(() => {});

    return {
      ok: true,
      domain,
      available,
      isPremium: isPremium || undefined,
      registrationPrice: reg.amount,
      renewalPrice,
      currency: reg.currency || "USD",
      rawText: cardText.slice(0, 900),
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
