import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { newStealthContext } from "../browser";

export type DCResult = {
  ok: boolean;
  domain: string;
  available?: boolean;
  isPremium?: boolean;
  registrationPrice?: number; // first-year price
  renewalPrice?: number; // crossed/strike-through price shown as /yr
  currency?: string;
  error?: string;
  rawText?: string;
};

type RunOpts = {
  proxy?: { server: string; username?: string; password?: string };
  headless?: boolean;
  locale?: string;
  timezoneId?: string;
  ephemeralProfile?: boolean;
  profileBaseDir?: string;
  timeoutMs?: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function freshProfileDir(base = "/tmp") {
  const id = crypto.randomBytes(6).toString("hex");
  return path.join(base, `spaceship_${id}`);
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
  if (sym.includes("₹") || sym.includes("INR") || sym.includes("RS")) currency = "INR";
  else if (sym.includes("$") || sym.includes("USD")) currency = "USD";
  else if (sym.includes("€") || sym.includes("EUR")) currency = "EUR";
  else if (sym.includes("£") || sym.includes("GBP")) currency = "GBP";
  return { amount, currency };
}

export async function checkDomainSpaceship(
  domain: string,
  opts: RunOpts = {}
): Promise<DCResult> {
  const profileDir =
    opts.ephemeralProfile === false
      ? path.join(opts.profileBaseDir || "./profiles", "spaceship")
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
    // Spaceship direct search URL
    const url = `https://www.spaceship.com/domain-search/?query=${encodeURIComponent(
      domain
    )}&beast=false&tab=domains`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 60000,
    });

    // Sometimes results need a manual trigger
    await sleep(500);
    try {
      const searchBtn = page.locator('button:has-text("Search")').first();
      if (await searchBtn.isVisible().catch(() => false)) {
        await searchBtn.click().catch(() => {});
      }
    } catch {}

    // Wait for the result line that contains the exact domain and its CTA
    await Promise.race([
      page.locator(`:has-text("${domain}")`).first().waitFor({ timeout: 12000 }),
      page.locator(':has-text("Add to cart")').first().waitFor({ timeout: 12000 }),
      sleep(12000),
    ]);

    // Find the exact domain row card
    const cardCandidates = [
      // Prefer a node that has a specific domain-name element
      `:has(.domain-name:has-text("${domain}"))`,
      `:has([data-testid*="domain-name"]:has-text("${domain}"))`,
      // Fallback to any container with exact text
      `[class*="result"]:has-text("${domain}")`,
      `[class*="domain"]:has-text("${domain}")`,
      `article:has-text("${domain}")`,
      `li:has-text("${domain}")`,
      `tr:has-text("${domain}")`,
      `div:has-text("${domain}")`,
    ];

    let card = page.locator(cardCandidates[0]).first();
    for (const sel of cardCandidates) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible().catch(() => false)) {
        card = loc;
        break;
      }
    }

    if (!(await card.isVisible().catch(() => false))) {
      const body = (await page.textContent("body").catch(() => "")) || "";
      await ctx.close();
      if (opts.ephemeralProfile !== false) await fs.remove(profileDir).catch(() => {});
      return { ok: false, domain, error: "Domain row/card not found", rawText: body.slice(0, 900) };
    }

    await sleep(200);

    const cardText = (await card.innerText().catch(() => "")) || "";

    // Unavailability markers
    const isUnavailable =
      /taken/i.test(cardText) ||
      /unavailable/i.test(cardText) ||
      /already\s*registered/i.test(cardText) ||
      /transfer/i.test(cardText) ||
      /make\s*offer/i.test(cardText) ||
      /aftermarket/i.test(cardText);

    if (isUnavailable) {
      await ctx.close();
      if (opts.ephemeralProfile !== false) await fs.remove(profileDir).catch(() => {});
      return {
        ok: true,
        domain,
        available: false,
        isPremium: /premium/i.test(cardText) || undefined,
        rawText: cardText.slice(0, 900),
      };
    }

    // Availability markers
    const hasAddToCart =
      (await card.locator('button:has-text("Add to cart"), a:has-text("Add to cart")').first().isVisible().catch(() => false)) ||
      /is\s+available/i.test(cardText);

    // Registration price: the big bold price near CTA
    // Renewal price: the crossed/strike-through price (often has /yr text)
    // We will try specific class patterns, then fall back to text.
    let registrationPrice: number | undefined;
    let renewalPrice: number | undefined;
    let currency: string | undefined;

    // Try explicit struck-through and main price nodes
    const crossedNode = card.locator('s, del, .line-through, .strikethrough').first();
    const mainPriceNode = card.locator(
      [
        '.price',
        '[class*="price"]',
        '[data-testid*="price"]',
        'strong:has-text("$"), b:has-text("$")',
        'div:has-text("$"), span:has-text("$")',
      ].join(", ")
    ).first();

    // Renewal from crossed text
    if (await crossedNode.isVisible().catch(() => false)) {
      const crossedText = (await crossedNode.innerText().catch(() => "")) || "";
      const rp = parsePrice(crossedText);
      if (rp.amount !== undefined) {
        renewalPrice = rp.amount;
        currency = currency || rp.currency;
      }
    } else {
      // Try to find a price text that includes "/yr" as renewal
      const yrNode = card.locator(':text-matches("[$€£₹]\\s*[\\d,]+\\.?\\d*\\s*/\\s*yr", "i")').first();
      if (await yrNode.isVisible().catch(() => false)) {
        const yrText = (await yrNode.innerText().catch(() => "")) || "";
        const rp = parsePrice(yrText);
        if (rp.amount !== undefined) {
          renewalPrice = rp.amount;
          currency = currency || rp.currency;
        }
      }
    }

    // Registration price from the prominent price near CTA
    if (await mainPriceNode.isVisible().catch(() => false)) {
      const mpText = (await mainPriceNode.innerText().catch(() => "")) || "";
      const ap = parsePrice(mpText);
      if (ap.amount !== undefined) {
        // If this equals renewal by accident, we will correct below
        registrationPrice = ap.amount;
        currency = currency || ap.currency;
      }
    }

    // If still missing, parse prices from card text and pick
    if (registrationPrice === undefined || currency === undefined) {
      const prices = (cardText.match(/(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*[0-9][\d,]*\.?\d*/g) || [])
        .map((t) => parsePrice(t))
        .filter((p) => p.amount !== undefined);
      if (prices.length) {
        // Heuristic: bigger is renewal, smaller is current price in your screenshot
        // Example: $1,035.00/yr (renewal) vs $258.75 (current)
        const amounts = prices.map((p) => p.amount as number);
        const max = Math.max(...amounts);
        const min = Math.min(...amounts);
        // If we have renewal already, set reg to the other
        if (renewalPrice !== undefined) {
          const regCand = amounts.find((a) => Math.abs(a - renewalPrice!) > 1e-6);
          registrationPrice = regCand ?? registrationPrice ?? min;
        } else {
          renewalPrice = max;
          registrationPrice = min;
        }
        currency = currency || prices[0].currency;
      }
    }

    const available = hasAddToCart || registrationPrice !== undefined;

    const isPremium =
      /premium/i.test(cardText) ||
      (registrationPrice !== undefined ? registrationPrice > 50 : undefined);

    // Close immediately once we have the data
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
      currency: currency || "USD",
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