import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { newStealthContext } from "../browser";

export type NCResult = {
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

export async function checkNamecheap(domain: string, opts: RunOpts = {}): Promise<NCResult> {
  const profileDir =
    opts.ephemeralProfile === false
      ? path.join(opts.profileBaseDir || "./profiles", "namecheap")
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
    const url = `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(
      domain
    )}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 15000,
    });

    await sleep(1000 + Math.random() * 500);

    // Grab the primary domain card/article
    const card = page.locator("article.domain-tech").first();
    await card.waitFor({ timeout: 9000 });

    const cardText = (await card.innerText().catch(() => "")) || "";
    const cardHTML = (await card.innerHTML().catch(() => "")) || "";

    // Detect availability
    const taken = /\bTAKEN\b/i.test(cardText) || /Make offer/i.test(cardText);
    const addToCart = /Add to cart/i.test(cardText);
    const premium = /premium/i.test(cardText);

    const available = addToCart && !taken;

    // Extract price ONLY from this card
    let priceText = "";
    const strong = card.locator(".price strong").first();
    if (await strong.isVisible().catch(() => false)) {
      priceText = (await strong.innerText().catch(() => "")) || "";
    }
    const reg = parsePrice(priceText);

    // Renewal price (if shown in card)
    const renewMatch =
      cardText.match(/renews?\s+at[^0-9]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,\.]+)/i) ||
      cardText.match(/renewal[^0-9]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,\.]+)/i);
    const renewalPrice = renewMatch ? parseFloat(renewMatch[2].replace(/[^\d.]/g, "")) : undefined;

    return {
      ok: true,
      domain,
      available,
      isPremium: premium || (reg.amount ? reg.amount > 100 : undefined),
      registrationPrice: reg.amount,
      renewalPrice,
      currency: reg.currency || "USD",
      rawText: cardText.slice(0, 900),
    };
  } catch (e: any) {
    return { ok: false, domain, error: e?.message || "Navigation failed" };
  } finally {
    await ctx.close();
    if (opts.ephemeralProfile !== false) {
      await fs.remove(profileDir).catch(() => {});
    }
  }
}