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
  if (sym.includes("₹") || sym.includes("INR") || sym.includes("RS")) currency = "INR";
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

  // Use your stealth context with watchdog hard-timeout
  const ctx = await newStealthContext({
    profileDir,
    headless: opts.headless ?? true,
    locale: opts.locale || "en-US",
    timezoneId: opts.timezoneId || "America/New_York",
    proxy: opts.proxy,
  });

  const page = await ctx.newPage();

  try {
    const url = `https://domains.squarespace.com/domain/search?query=${encodeURIComponent(
      domain
    )}`;

    // Go to page and wait for network to at least be idle once
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 90_000,
    });

    // Wait for the results container to exist, site can block for 20–40s
    const resultsListSelector = 'ul[role="list"], ul.search-results';
    await page.waitForSelector(resultsListSelector, {
      timeout: opts.timeoutMs ?? 90_000,
      state: "attached",
    }).catch(() => {});

    // Let SPA hydrate
    await sleep(1500);

    // Poll up to hard limit to survive their blocking phase
    const started = Date.now();
    const softDeadline = (opts.timeoutMs ?? 90_000) + 30_000; // give some slack

    let foundRowText = "";
    let available: boolean | undefined;
    let isPremium = false;
    let regAmount: number | undefined;
    let regCurrency: string | undefined;

    // precise match function run in page to avoid false positives
    async function findExactRow() {
      return page.evaluate((d) => {
        const all = Array.from(document.querySelectorAll('li.search-results__search-result'));
        for (const li of all) {
            const nameEl = li.querySelector('.search-results__search-result-name, .search-results__search-result-name--has-pill');
            const name = nameEl?.textContent?.trim().toLowerCase();
            if (name === d.toLowerCase()) {
              const btn = li.querySelector('button.search-results__search-result-wrapper-button');
              const hasPill = btn?.classList.contains('search-results__search-result-wrapper-button--has-pill') || false;
  
              const pricing = li.querySelector('.search-results__search-result-pricing') as HTMLElement | null;
              const unavailable = li.querySelector('.search-results__search-result-pricing--unavailable');
  
              const pillPremium = li.querySelector('.search-results__pill--info');
              const textPremium =
                !!pillPremium ||
                (li.textContent || "").toLowerCase().includes("premium");
  
              let priceText = "";
              if (pricing && !unavailable) {
                // prefer the current price span (the last span in pricing)
                const spans = Array.from(pricing.querySelectorAll('span'));
                if (spans.length > 0) {
                  priceText = spans[spans.length - 1].textContent || "";
                } else {
                  priceText = pricing.textContent || "";
                }
              }
  
              return {
                rowHTML: (li as HTMLElement).innerText || li.textContent || "",
                hasPill,
                isUnavailable: !!unavailable,
                priceText,
                isPremium: textPremium,
              };
            }
          }
        return null;
      }, domain);
    }

    while (Date.now() - started < softDeadline) {
      const row = await findExactRow();
      if (row) {
        foundRowText = row.rowHTML.slice(0, 2000);
        isPremium = !!row.isPremium;

        if (row.isUnavailable) {
          available = false;
          break;
        }

        if (row.hasPill) {
          // exact match and actionable
          available = true;
          const { amount, currency } = parsePrice(row.priceText || "");
          regAmount = amount;
          regCurrency = currency || "USD";
          break;
        }

        // If found but not actionable yet, wait a bit more for hydration
      }

      await sleep(800);
    }

    if (available === undefined) {
      // Fallback heuristic if not found in time
      const bodyText = (await page.content()) || "";
      const lower = bodyText.toLowerCase();
      if (lower.includes("unavailable")) {
        available = false;
      } else if (lower.includes("$") || lower.includes("usd") || lower.includes("add to cart")) {
        available = true;
      } else {
        // unknown
        return {
          ok: false,
          domain,
          error: "Squarespace parsing timeout or structure changed",
        };
      }
    }

    return {
      ok: true,
      domain,
      available,
      isPremium,
      registrationPrice: regAmount,
      currency: regCurrency || "USD",
      rawText: foundRowText || undefined,
    };
  } catch (e: any) {
    return { ok: false, domain, error: e?.message || "Navigation failed" };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
    if (opts.ephemeralProfile !== false) {
      await fs.remove(profileDir).catch(() => {});
    }
  }
}