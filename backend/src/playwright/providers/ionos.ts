import { openProviderPage } from "../browser.js";
import type { DCResult } from "../../types/resultSchema.js";
import type { RunOpts } from "../../types/runOptions.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

// Extract all currency amounts in reading order
function parseAllPrices(text: string) {
  const rx = /(?:₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*[0-9][\d,]*\.?\d*/g;
  const matches = (text.match(rx) || []).map((m) => {
    const { amount, currency } = parsePrice(m);
    return { amount, currency, raw: m };
  });
  return matches;
}

function linesAround(text: string, needle: string, radius = 20) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const idx = lines.findIndex((l) => l.toLowerCase() === needle.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx);
  const end = Math.min(lines.length, idx + radius);
  return lines.slice(start, end).join("\n");
}

export async function checkDomainIONOS(
  domain: string,
  opts: RunOpts = {}
): Promise<DCResult> {
  // A tab in the shared real Chrome when available (far lighter than a browser per lookup)
  const { page, close } = await openProviderPage("io", opts);

  try {
    await page.goto("https://www.ionos.com/domains/domain-finder", {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 90000,
    });

    await sleep(800 + Math.random() * 600);

    // Search field and submit
    const inputSelCandidates = [
      'input[type="text"][name]',
      'input[type="search"]',
      'input[placeholder*="domain"]',
      "#domain-search-input",
      '[class*="search"] input',
      'form input[type="text"]',
    ];

    let inputFound = false;
    for (const sel of inputSelCandidates) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        await el.fill(domain);
        inputFound = true;
        break;
      }
    }

    if (!inputFound) {
      await close();
      return { ok: false, domain, error: "Search input not found" };
    }

    const submitSelCandidates = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Search")',
      'button:has-text("Check")',
      '[class*="search"] button',
      "form button",
    ];

    let submitted = false;
    for (const sel of submitSelCandidates) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        submitted = true;
        break;
      }
    }
    if (!submitted) {
      await page.keyboard.press("Enter");
    }

    // Wait for known result states
    await Promise.race([
      page.locator(':has-text("is taken")').first().waitFor({ timeout: 12000 }),
      page
        .locator(':has-text("is invalid")')
        .first()
        .waitFor({ timeout: 12000 }),
      page
        .locator(':has-text("still available")')
        .first()
        .waitFor({ timeout: 12000 }),
      page
        .locator(':has-text("Add to cart")')
        .first()
        .waitFor({ timeout: 12000 }),
      sleep(12000),
    ]);

    await sleep(3000);

    // Prices are parsed from the exact-match block below. The card's .price__strike
    // node isn't reliable: bundle offers ("name .com+ .net+ ...") use the same markup.
    let registrationPriceIntro: number | undefined;
    let registrationCurrency: string | undefined;
    let renewalPrice: number | undefined;
    let renewalCurrency: string | undefined;

    const bodyText = (await page.textContent("body").catch(() => "")) || "";
    const scoped = linesAround(bodyText, domain, 24) || bodyText.slice(0, 1200);

    // Invalid/external transfer
    if (/is invalid/i.test(bodyText) || /external domain/i.test(bodyText)) {
      await close();
      return {
        ok: true,
        domain,
        available: false,
        rawText: scoped.slice(0, 900),
      };
    }

    // Taken
    if (
      /is taken/i.test(bodyText) ||
      /already (exists|registered|taken)/i.test(bodyText)
    ) {
      await close();
      return {
        ok: true,
        domain,
        available: false,
        rawText: scoped.slice(0, 900),
      };
    }

    // If we could not read the structured nodes, fallback to your previous heuristic
    let currency = registrationCurrency || renewalCurrency;
    if (registrationPriceIntro == null || renewalPrice == null) {
      // Only the exact-match banner counts; suggestions also have "Add to cart"
      const availableBanner = /still available/i.test(bodyText);

      // The exact match is the block from "still available!" to its first "Add to cart";
      // everything after that is suggested domains with their own prices.
      const pageText = (await page.innerText("body").catch(() => "")) || "";
      const bannerIdx = pageText.search(/still available/i);
      let cardText =
        bannerIdx >= 0
          ? pageText.slice(bannerIdx).split(/add to cart/i)[0] || ""
          : "";
      if (!cardText) cardText = scoped;

      // "$90 $40.99 /year": the per-year figure is what you pay, the other is the list price
      const perYear = cardText.match(
        /(₹|\$|€|£)\s*([0-9][\d,]*\.?\d*)\s*\/\s*year/i,
      );
      if (perYear && registrationPriceIntro == null) {
        const { amount, currency: c } = parsePrice(`${perYear[1]}${perYear[2]}`);
        registrationPriceIntro = amount;
        if (!currency) currency = c;
      }

      const priceHits = parseAllPrices(cardText);
      const amounts = priceHits
        .map((p) => p.amount)
        .filter((n): n is number => typeof n === "number");

      if (amounts.length >= 2) {
        const max = Math.max(...amounts);
        const min = Math.min(...amounts);
        if (registrationPriceIntro == null) registrationPriceIntro = min;
        if (renewalPrice == null) renewalPrice = max;
        if (!currency)
          currency =
            priceHits.find((p) => p.amount === min)?.currency ||
            priceHits[0]?.currency;
      } else if (amounts.length === 1) {
        if (registrationPriceIntro == null) registrationPriceIntro = amounts[0];
        if (!currency) currency = priceHits[0]?.currency;
      }

      if (!availableBanner) {
        await close();
        return {
          ok: false,
          domain,
          error: "Could not determine IONOS availability",
          rawText: scoped.slice(0, 900),
        };
      }
      const available = true;

      const isPremium = /premium/i.test(cardText);

      await close();

      return {
        ok: true,
        domain,
        available: Boolean(available),
        isPremium: isPremium || undefined,
        registrationPrice: registrationPriceIntro ?? undefined,
        renewalPrice: renewalPrice ?? undefined,
        currency: currency || undefined,
        rawText: cardText.slice(0, 900),
      };
    }

    // If structured read worked, we can assume available
    const isPremium = /premium/i.test(scoped.split(/add to cart/i)[0] || "");

    await close();

    return {
      ok: true,
      domain,
      available: true,
      isPremium: isPremium || undefined,
      registrationPrice: registrationPriceIntro ?? undefined,
      renewalPrice: renewalPrice ?? undefined,
      currency: currency || undefined,
      rawText: scoped.slice(0, 900),
    };
  } catch (e: any) {
    await close();
    return { ok: false, domain, error: e?.message || "Navigation failed" };
  }
}