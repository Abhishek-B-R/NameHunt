import fs from "fs-extra";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { newStealthContext } from "../browser.js";

export type DCResult = {
  ok: boolean;
  domain: string;
  available?: boolean;
  isPremium?: boolean;
  registrationPrice?: number;
  renewalPrice?: number;
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
  return path.join(base, `nc_${id}`);
}

function parseCurrencyAmount(text: string) {
  // returns first currency + amount in text
  const m =
    text.match(/(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([0-9][\d,]*\.?\d*)/i) ||
    text.match(/([0-9][\d,]*\.?\d*)\s*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)/i);
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

export async function checkNamecheap(
  domain: string,
  opts: RunOpts = {}
): Promise<DCResult> {
  const profileDir =
    opts.ephemeralProfile === false
      ? path.join(opts.profileBaseDir || "./profiles", "namecheap")
      : freshProfileDir(opts.profileBaseDir || "/tmp");

  await fs.ensureDir(profileDir);

  const ctx = await newStealthContext({
    profileDir,
    headless: opts.headless ?? true,
    locale: opts.locale || "en-US",
    timezoneId: opts.timezoneId || "America/New_York",
    proxy: opts.proxy,
  });

  const page = await ctx.newPage();

  try {
    const url = `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(
      domain
    )}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 45000,
    });

    // let SPA fetch
    await sleep(900 + Math.random() * 500);

    // Find the article whose .name h2 equals requested domain
    // Then use that article for all reads
    const article = page
      .locator(`article:has(.name h2:has-text("${domain}"))`)
      .first();

    // Wait briefly for it to appear and finish loading
    await article.waitFor({ timeout: 12000 });

    // Sometimes the element appears then updates; give it one more frame
    await sleep(200);

    const rawText =
      ((await article.innerText().catch(() => "")) || "").slice(0, 900);

    // Classes decide state
    const classAttr = (await article.getAttribute("class")) || "";
    const available = /\bavailable\b/i.test(classAttr) && !/\bunavailable\b/i.test(classAttr);

    // Premium badge
    const isPremium =
      (await article.locator(".label.premium").count()) > 0 ||
      /premium/i.test(rawText);

    // Registration price: from .price strong
    let registrationPrice: number | undefined;
    let currency: string | undefined;

    const strong = article.locator(".price strong").first();
    if (await strong.isVisible().catch(() => false)) {
      const priceText = (await strong.innerText().catch(() => "")) || "";
      const parsed = parseCurrencyAmount(priceText);
      registrationPrice = parsed.amount;
      currency = parsed.currency;
    }

    // Renewal price:
    // For standard available domains, strong often contains "/yr" and equals the renewal.
    // For premium available, strong is a one-time price with no "/yr", and there's usually no renewal shown upfront.
    let renewalPrice: number | undefined;

    if (await strong.isVisible().catch(() => false)) {
      const t = (await strong.innerText().catch(() => "")) || "";
      const hasPerYear = /\/\s*yr/i.test(t);
      if (hasPerYear) {
        // strong includes /yr, so treat this as renewal and also as registration unless a discounted price exists elsewhere.
        const parsed = parseCurrencyAmount(t);
        renewalPrice = parsed.amount;
        // If registrationPrice not set yet from another node, set it to the same as renewal
        if (registrationPrice === undefined && parsed.amount !== undefined) {
          registrationPrice = parsed.amount;
          currency = currency || parsed.currency;
        }
      }
    }

    // Unavailable quick path
    const isTaken =
      !available &&
      ((await article.locator(".label.taken").count()) > 0 ||
        /make\s*offer/i.test(rawText) ||
        /unavailable/i.test(rawText));

    if (isTaken) {
      await ctx.close().catch(() => {});
      if (opts.ephemeralProfile !== false) {
        await fs.remove(profileDir).catch(() => {});
      }
      return {
        ok: true,
        domain,
        available: false,
        isPremium: isPremium || undefined,
        currency: currency || "USD",
        rawText,
      };
    }

    // Build result for available or unknown state
    const result: DCResult = {
      ok: true,
      domain,
      available,
      isPremium: isPremium || (registrationPrice ? registrationPrice > 100 : undefined),
      registrationPrice,
      renewalPrice,
      currency: currency || "USD",
      rawText,
    };

    await ctx.close().catch(() => {});
    if (opts.ephemeralProfile !== false) {
      await fs.remove(profileDir).catch(() => {});
    }

    return result;
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