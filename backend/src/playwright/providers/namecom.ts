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

export async function checkDomainNameCom(
  domain: string,
  opts: RunOpts = {}
): Promise<DCResult> {
  const profileDir =
    opts.ephemeralProfile === false
      ? path.join(opts.profileBaseDir || "./profiles", "namecom")
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
    const url = `https://www.name.com/domain/search/${encodeURIComponent(
      domain
    )}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 90000,
    });

    // Human-like pause
    await sleep(1200 + Math.random() * 800);

    // Wait for search results to load
    await Promise.race([
      page.waitForSelector('[data-testid="domain-result"]', { timeout: 12000 }),
      page.waitForSelector(".domain-result", { timeout: 12000 }),
      page.waitForSelector(".search-results", { timeout: 12000 }),
      page.waitForSelector('[class*="result"]', { timeout: 12000 }),
      page.waitForSelector('button:has-text("Make Offer")', { timeout: 12000 }),
      sleep(12000),
    ]);

    // Additional wait for dynamic content
    await sleep(3000);

    // Look for the exact domain in search results
    const domainResultSelectors = [
      `[data-testid="domain-result"]:has-text("${domain}")`,
      `.domain-result:has-text("${domain}")`,
      `.search-result:has-text("${domain}")`,
      `[class*="result"]:has-text("${domain}")`,
      `.domain-card:has-text("${domain}")`,
      `div:has-text("${domain}")`,
    ];

    let resultCard = null;
    for (const selector of domainResultSelectors) {
      try {
        resultCard = page.locator(selector).first();
        if (await resultCard.isVisible({ timeout: 3000 })) {
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!resultCard || !(await resultCard.isVisible().catch(() => false))) {
      // Fallback: look for any element containing the domain
      resultCard = page.locator(`div:has-text("${domain}")`).first();

      if (!(await resultCard.isVisible().catch(() => false))) {
        const bodyText = await page.textContent("body").catch(() => "");
        return {
          ok: false,
          domain,
          error: "Domain result not found in search results",
          rawText: (bodyText || "").slice(0, 900),
        };
      }
    }

    const cardText = (await resultCard.innerText().catch(() => "")) || "";
    const bodyText = await page.textContent("body").catch(() => "");

    // Check for "not supported" or similar messages
    const notSupported =
      /not\s+supported/i.test(cardText) ||
      /unsupported/i.test(cardText) ||
      /not\s+available\s+for\s+registration/i.test(cardText) ||
      /extension\s+is\s+not\s+supported/i.test(bodyText || "");

    if (notSupported) {
      return {
        ok: true,
        domain,
        available: undefined,
        isPremium: undefined,
        registrationPrice: undefined,
        renewalPrice: undefined,
        currency: "USD",
        rawText: cardText.slice(0, 900),
      };
    }

    // Check specifically for "Make Offer" button/text - this indicates domain is NOT available
    const makeOfferSelectors = [
      'button:has-text("Make Offer")',
      'a:has-text("Make Offer")',
      ':has-text("Make Offer")',
      'button:has-text("MAKE OFFER")',
      'a:has-text("MAKE OFFER")',
    ];

    let hasMakeOffer = false;
    for (const selector of makeOfferSelectors) {
      try {
        const btn = resultCard.locator(selector).first();
        if (await btn.isVisible({ timeout: 500 })) {
          hasMakeOffer = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Also check for "Make Offer" in the text content
    const hasMakeOfferText = /make\s+offer/i.test(cardText);

    // If Make Offer is present, domain is definitely NOT available
    if (hasMakeOffer || hasMakeOfferText) {
      await ctx.close();
      if (opts.ephemeralProfile !== false) {
        await fs.remove(profileDir).catch(() => {});
      }

      return {
        ok: true,
        domain,
        available: false,
        isPremium: undefined,
        registrationPrice: undefined,
        renewalPrice: undefined,
        currency: undefined,
        rawText: cardText.slice(0, 900),
      };
    }

    // Detect availability through Add to Cart buttons
    const addToCartButtons = [
      'button:has-text("Add to Cart")',
      'button:has-text("ADD TO CART")',
      '[class*="add-to-cart"]',
      'button[class*="cart"]',
      ".btn-add-cart",
      'a:has-text("Add to Cart")',
    ];

    let hasAddToCart = false;
    for (const selector of addToCartButtons) {
      try {
        const btn = resultCard.locator(selector).first();
        if (await btn.isVisible({ timeout: 500 })) {
          hasAddToCart = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Check for other taken/unavailable indicators
    const otherTakenIndicators = [
      /taken/i.test(cardText),
      /unavailable/i.test(cardText),
      /registered/i.test(cardText),
      /not\s+available/i.test(cardText),
      /owned/i.test(cardText),
      cardText.includes("🚫"),
      cardText.includes("❌"),
    ];

    const isTaken = otherTakenIndicators.some(Boolean);

    // If taken by other indicators, return unavailable
    if (isTaken) {
      await ctx.close();
      if (opts.ephemeralProfile !== false) {
        await fs.remove(profileDir).catch(() => {});
      }

      return {
        ok: true,
        domain,
        available: false,
        isPremium: undefined,
        registrationPrice: undefined,
        renewalPrice: undefined,
        currency: undefined,
        rawText: cardText.slice(0, 900),
      };
    }

    // Premium detection
    const isPremium =
      /premium/i.test(cardText) ||
      /\bpremium\b/i.test(cardText) ||
      cardText.includes("💎") ||
      cardText.includes("⭐");

    // Price extraction - only if domain is available
    let priceText = cardText;

    // Look specifically in price-related elements
    const priceSelectors = [
      ".price",
      '[class*="price"]',
      ".cost",
      '[class*="cost"]',
      ".amount",
      '[data-testid*="price"]',
      'span:has-text("$")',
      'div:has-text("$")',
      'span:has-text("₹")',
      'div:has-text("₹")',
    ];

    for (const selector of priceSelectors) {
      try {
        const priceEl = resultCard.locator(selector).first();
        if (await priceEl.isVisible({ timeout: 500 })) {
          const text = await priceEl.innerText().catch(() => "");
          if (text && /[\$€£₹]/.test(text)) {
            priceText = text;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    const reg = parsePrice(priceText);

    // Determine availability - domain is available if it has Add to Cart or pricing
    const available = hasAddToCart || reg.amount !== undefined;

    // Renewal price detection
    const renewMatch =
      cardText.match(/renew[s]?\s+at[^0-9]*([\$€£₹])\s*([\d,\.]+)/i) ||
      cardText.match(/renewal[^0-9]*([\$€£₹])\s*([\d,\.]+)/i) ||
      cardText.match(/then[^0-9]*([\$€£₹])\s*([\d,\.]+)/i);

    const renewalPrice = renewMatch
      ? parseFloat((renewMatch[2] || "").replace(/[^\d.]/g, ""))
      : undefined;

    await ctx.close();
    if (opts.ephemeralProfile !== false) {
      await fs.remove(profileDir).catch(() => {});
    }

    return {
      ok: true,
      domain,
      available,
      isPremium: isPremium || (reg.amount ? reg.amount > 50 : undefined),
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
