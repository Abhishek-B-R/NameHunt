import { detectBotWall, openProviderPage } from "../browser.js";
import type { DCResult } from "../../types/resultSchema.js";
import type { RunOpts } from "../../types/runOptions.js";

function extractFirstPrice(text: string) {
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
  return { amount: Number.isFinite(amount) ? amount : undefined, currency };
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export async function checkGoDaddy(
  domain: string,
  runOpts: RunOpts = {},
): Promise<DCResult> {
  // GoDaddy sits behind Akamai Bot Manager, which only lets real Chrome through
  const { page, close } = await openProviderPage("gd", runOpts);

  try {
    const searchUrl =
      "https://www.godaddy.com/en-in/domainsearch/find?domainToCheck=" +
      encodeURIComponent(domain);

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: runOpts.timeoutMs ?? 45_000,
      referer: "https://www.godaddy.com/",
    });

    const blocked = await detectBotWall(page, 3_000);
    if (blocked) return { ok: false, domain, error: blocked };

    const availCard = page.locator('[data-cy="availcard"]').first();
    const unavailable = page.locator('[data-cy="search-result-error"]').first();
    const takenDbs = page.locator('[data-cy="dbsCard"]').first();

    await Promise.race([
      availCard.waitFor({ timeout: 20_000 }),
      unavailable.waitFor({ timeout: 20_000 }),
      takenDbs.waitFor({ timeout: 20_000 }),
    ]).catch(() => {});

    // Taken: "Sorry, example.com is unavailable" (older layout: "Domain Taken" DBS card)
    const unavailableText =
      (await unavailable.innerText({ timeout: 1_000 }).catch(() => "")) ||
      (await takenDbs.innerText({ timeout: 1_000 }).catch(() => ""));
    if (
      norm(unavailableText).includes(norm(domain)) &&
      /unavailable|taken/i.test(unavailableText)
    ) {
      return {
        ok: true,
        domain,
        available: false,
        isPremium: false,
        rawText: unavailableText.slice(0, 900),
      };
    }

    if (!(await availCard.count())) {
      const bodyText = await page.innerText("body").catch(() => "");
      return {
        ok: false,
        domain,
        error: "Exact-match result card not found",
        rawText: bodyText.slice(0, 900),
      };
    }

    const cardDomain = await availCard
      .locator('[data-testid="single-line-display"]')
      .first()
      .innerText({ timeout: 2_000 })
      .catch(() => "");
    if (!norm(cardDomain).includes(norm(domain))) {
      return { ok: false, domain, error: "Result card is for a different domain" };
    }

    const cardText = await availCard.innerText().catch(() => "");
    const readPrice = async (testId: string) =>
      extractFirstPrice(
        await availCard
          .locator(`[data-testid="${testId}"]`)
          .first()
          .innerText({ timeout: 1_000 })
          .catch(() => ""),
      );

    const main = await readPrice("pricing-main-price");
    const list = await readPrice("pricing-strikethrough-price");
    const premiumRenewal = await readPrice("premium-renewal-price");

    // GoDaddy often headlines a teaser (e.g. ₹1) that only applies with a multi-year
    // term. Other registrars are compared on a 1-year purchase, so use the list price then.
    const multiYearOnly = /with\s+\d+\s*(yr|year)s?\s+term/i.test(cardText);
    const registration =
      multiYearOnly && list.amount !== undefined ? list : main;

    if (registration.amount === undefined) {
      return {
        ok: false,
        domain,
        error: "Could not extract price from available card",
        rawText: cardText.slice(0, 900),
      };
    }

    const tag = await availCard
      .locator('[data-testid="availableCard-tag"]')
      .first()
      .innerText({ timeout: 1_000 })
      .catch(() => "");
    const isPremium =
      /premium/i.test(tag) || premiumRenewal.amount !== undefined;

    return {
      ok: true,
      domain,
      available: true,
      isPremium,
      registrationPrice: registration.amount,
      renewalPrice: premiumRenewal.amount ?? list.amount ?? main.amount,
      currency: registration.currency || list.currency || "USD",
      rawText: cardText.slice(0, 900),
    };
  } catch (e: any) {
    return {
      ok: false,
      domain,
      error: e?.message?.slice(0, 300) || "Navigation or extraction failed",
    };
  } finally {
    await close();
  }
}
