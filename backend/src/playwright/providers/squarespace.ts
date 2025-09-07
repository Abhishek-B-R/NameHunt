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
  if (sym.includes("₹") || sym.includes("INR") || sym.includes("RS"))
    currency = "INR";
  else if (sym.includes("$") || sym.includes("USD")) currency = "USD";
  else if (sym.includes("€") || sym.includes("EUR")) currency = "EUR";
  else if (sym.includes("£") || sym.includes("GBP")) currency = "GBP";
  return { amount, currency };
}

export async function checkSquarespace(
  domain: string,
  opts: RunOpts = {}
): Promise<DCResult> {
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
      timeout: opts.timeoutMs ?? 60000,
    });

    // Let SPA hydrate
    await sleep(2000);

    // Find the row that contains the exact domain
    const row = page.locator(`div[role="row"]:has-text("${domain}")`).first();
    await row.waitFor({ timeout: 60000 });

    const rowText = (await row.innerText().catch(() => "")) || "";

    // Extract price
    let priceText = "";
    const priceNode = row.locator("span, strong, div").filter({
      hasText: /\$|USD|INR|₹|EUR|£/,
    });
    if (
      await priceNode
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      priceText =
        (await priceNode
          .first()
          .innerText()
          .catch(() => "")) || "";
    }
    const reg = parsePrice(priceText);

    // Detect availability
    const taken = /\bTAKEN\b/i.test(rowText) || /unavailable/i.test(rowText);
    const addToCart = /Add to cart/i.test(rowText) || /🛒/.test(rowText);
    const premium = /Premium/i.test(rowText);

    const available = addToCart && !taken;

    return {
      ok: true,
      domain,
      available,
      isPremium: premium,
      registrationPrice: reg.amount,
      currency: reg.currency || "USD",
      rawText: rowText.slice(0, 900),
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
