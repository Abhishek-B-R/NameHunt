import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { newStealthContext } from "../browser";

export type SSResult = {
  ok: boolean;
  domain: string;
  available?: boolean;
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
  return path.join(base, `ss_${id}`);
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

export async function checkSquarespace(
  domain: string,
  opts: RunOpts = {}
): Promise<SSResult> {
  const profileDir =
    opts.ephemeralProfile === false
      ? path.join(opts.profileBaseDir || "./profiles", "squarespace")
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
    const url = `https://domains.squarespace.com/domain/search?query=${encodeURIComponent(
      domain
    )}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 15000,
    });

    // Let SPA hydrate
    await sleep(1500);

    // Grab the primary result card
    const card = page.locator('[data-test="search-result"]').first();
    await card.waitFor({ timeout: 8000 });

    const cardText = (await card.innerText().catch(() => "")) || "";
    const cardHTML = (await card.innerHTML().catch(() => "")) || "";

    // Detect availability
    const taken = /\bTAKEN\b/i.test(cardText) || /unavailable/i.test(cardText);
    const addToCart = /Add to cart/i.test(cardText) || /Add/i.test(cardText);

    const available = addToCart && !taken;

    // Extract price
    let priceText = "";
    const priceNode = card.locator('[data-test="price"], .price, strong').first();
    if (await priceNode.isVisible().catch(() => false)) {
      priceText = (await priceNode.innerText().catch(() => "")) || "";
    }
    const reg = parsePrice(priceText);

    return {
      ok: true,
      domain,
      available,
      registrationPrice: reg.amount,
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