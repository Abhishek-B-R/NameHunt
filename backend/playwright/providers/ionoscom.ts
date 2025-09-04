import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { newStealthContext } from "../browser";

export type DCResult = {
  ok: boolean;
  domain: string;
  available?: boolean;
  isPremium?: boolean;
  // For backward compatibility:
  // registrationPrice will be the intro price if available, else the only price found
  registrationPrice?: number;
  renewalPrice?: number;
  currency?: string;
  error?: string;
  rawText?: string;

  // New fields to be explicit
  registrationPriceIntro?: number;
  registrationPriceRegular?: number;
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
  if (sym.includes("₹") || sym.includes("INR") || sym.includes("RS")) currency = "INR";
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
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
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
  const profileDir =
    opts.ephemeralProfile === false
      ? path.join(opts.profileBaseDir || "./profiles", "ionos")
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
    await page.goto("https://www.ionos.com/domains/domain-finder", {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 60000,
    });

    await sleep(800 + Math.random() * 600);

    // Search field and submit
    const inputSelCandidates = [
      'input[type="text"][name]',
      'input[type="search"]',
      'input[placeholder*="domain"]',
      '#domain-search-input',
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
      await ctx.close();
      if (opts.ephemeralProfile !== false) await fs.remove(profileDir).catch(() => {});
      return { ok: false, domain, error: "Search input not found" };
    }

    const submitSelCandidates = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Search")',
      'button:has-text("Check")',
      '[class*="search"] button',
      'form button',
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
      page.locator(':has-text("is invalid")').first().waitFor({ timeout: 12000 }),
      page.locator(':has-text("still available")').first().waitFor({ timeout: 12000 }),
      page.locator(':has-text("Add to cart")').first().waitFor({ timeout: 12000 }),
      sleep(12000),
    ]);

    await sleep(1000);

    const bodyText = (await page.textContent("body").catch(() => "")) || "";
    const scoped = linesAround(bodyText, domain, 24) || bodyText.slice(0, 1200);

    // Invalid/external transfer
    if (/is invalid/i.test(bodyText) || /external domain/i.test(bodyText)) {
      await ctx.close();
      if (opts.ephemeralProfile !== false) await fs.remove(profileDir).catch(() => {});
      return {
        ok: true,
        domain,
        available: false,
        rawText: scoped.slice(0, 900),
      };
    }

    // Taken
    if (/is taken/i.test(bodyText) || /already (exists|registered)/i.test(bodyText)) {
      await ctx.close();
      if (opts.ephemeralProfile !== false) await fs.remove(profileDir).catch(() => {});
      return {
        ok: true,
        domain,
        available: false,
        rawText: scoped.slice(0, 900),
      };
    }

    // Available hints
    const availableBanner =
      /still available/i.test(bodyText) ||
      /Add to cart/i.test(bodyText) ||
      /Introductory Offer/i.test(bodyText);

    // Try to grab the main card text
    const cardLocCandidates = [
      `:text("${domain}")`,
      `div:has-text("${domain}")`,
      `section:has-text("${domain}")`,
      `article:has-text("${domain}")`,
    ];

    let cardText = "";
    for (const sel of cardLocCandidates) {
      const card = page.locator(sel).first();
      if (await card.isVisible().catch(() => false)) {
        const t = (await card.innerText().catch(() => "")) || "";
        if (/Add to cart/i.test(t) || /\/\s*year/i.test(t) || /Introductory Offer/i.test(t)) {
          cardText = t;
          break;
        }
      }
    }
    if (!cardText) cardText = scoped;

    // If the card contains negative markers, treat as unavailable
    if (!availableBanner && /(taken|invalid|not available|transfer only)/i.test(cardText)) {
      await ctx.close();
      if (opts.ephemeralProfile !== false) await fs.remove(profileDir).catch(() => {});
      return {
        ok: true,
        domain,
        available: false,
        rawText: cardText.slice(0, 900),
      };
    }

    // Extract all prices
    const priceHits = parseAllPrices(cardText);

    // Heuristics:
    // Typical card: "Save 37%  $20  $5.10 / year  for 1 year  Introductory Offer"
    // - The higher price is regular, the lower is intro
    // - If only one price, treat it as intro and also as renewal when "Introductory" absent
    let registrationPriceIntro: number | undefined;
    let registrationPriceRegular: number | undefined;
    let currency: string | undefined;

    const amounts = priceHits
      .map((p) => p.amount)
      .filter((n): n is number => typeof n === "number");

    if (amounts.length >= 2) {
      const max = Math.max(...amounts);
      const min = Math.min(...amounts);
      registrationPriceIntro = min;
      registrationPriceRegular = max;
      currency = priceHits.find((p) => p.amount === min)?.currency || priceHits[0]?.currency;
    } else if (amounts.length === 1) {
      registrationPriceIntro = amounts[0];
      currency = priceHits[0]?.currency;
    }

    // Explicit renewal extraction
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

    let renewalPrice = renewMatch
      ? parseFloat(renewMatch[2].replace(/[^\d.]/g, ""))
      : undefined;

    // If no explicit renewal, assume renewal equals regular when both present
    if (!renewalPrice && registrationPriceRegular) {
      renewalPrice = registrationPriceRegular;
    }

    const available =
      availableBanner ||
      /Add to cart/i.test(cardText) ||
      /\/\s*year/i.test(cardText) ||
      Boolean(registrationPriceIntro);

    const isPremium =
      /premium/i.test(cardText) ||
      ((registrationPriceRegular || registrationPriceIntro || 0) > 50);

    await ctx.close();
    if (opts.ephemeralProfile !== false) await fs.remove(profileDir).catch(() => {});

    return {
      ok: true,
      domain,
      available: Boolean(available),
      isPremium: isPremium || undefined,
      // keep legacy fields
      registrationPrice: registrationPriceIntro ?? registrationPriceRegular,
      renewalPrice,
      currency: currency || undefined,
      rawText: cardText.slice(0, 900),
      // new explicit fields
      registrationPriceIntro,
      registrationPriceRegular,
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