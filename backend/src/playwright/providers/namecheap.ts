import { detectBotWall, openProviderPage } from "../browser.js";
import type { DCResult } from "../../types/resultSchema.js";
import type { RunOpts } from "../../types/runOptions.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
  // Cloudflare blocks Playwright-launched browsers; prefer real Chrome when available
  const { page, close } = await openProviderPage("nc", opts);

  try {
    const url = `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(
      domain
    )}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 90000,
    });

    const blocked = await detectBotWall(page);
    if (blocked) {
      await close();
      return { ok: false, domain, error: blocked };
    }

    // let SPA fetch
    await sleep(900 + Math.random() * 500);

    // Find the article whose .name h2 equals requested domain
    // Then use that article for all reads
    const article = page
      .locator(`article:has(.name h2:text-is("${domain}"))`)
      .first();

    // Wait briefly for it to appear and finish loading
    await article.waitFor({ timeout: 20000 });

    // Sometimes the element appears then updates; give it one more frame
    await sleep(200);

    const rawText =
      ((await article.innerText().catch(() => "")) || "").slice(0, 900);

    // Classes decide state
    const classAttr = (await article.getAttribute("class")) || "";
    const available = /\bavailable\b/i.test(classAttr) && !/\bunavailable\b/i.test(classAttr);

    // Premium badge. Don't regex rawText: promo copy like "Non-premium domains only" would match.
    const isPremium = (await article.locator(".label.premium").count()) > 0;

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

    // Renewal price: discounted domains show "Retail $14.98/yr" under the sale price,
    // otherwise the "/yr" price in <strong> is also the renewal price.
    // Premium domains show a one-time price without "/yr" and no renewal upfront.
    let renewalPrice: number | undefined;

    const priceBlock =
      (await article.locator(".price").first().innerText().catch(() => "")) || "";
    const retail = priceBlock.match(/retail\s*([^\n]*)/i);
    if (retail) {
      renewalPrice = parseCurrencyAmount(retail[1] || "").amount;
    } else if (await strong.isVisible().catch(() => false)) {
      const t = (await strong.innerText().catch(() => "")) || "";
      if (/\/\s*yr/i.test(t)) renewalPrice = parseCurrencyAmount(t).amount;
    }

    // Unavailable quick path
    const isTaken =
      !available &&
      ((await article.locator(".label.taken").count()) > 0 ||
        /make\s*offer/i.test(rawText) ||
        /unavailable/i.test(rawText));

    if (isTaken) {
      await close();
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
      isPremium,
      registrationPrice,
      renewalPrice,
      currency: currency || "USD",
      rawText,
    };

    await close();

    return result;
  } catch (e: any) {
    await close();
    return { ok: false, domain, error: e?.message || "Navigation failed" };
  }
}