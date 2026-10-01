import axios from "axios";
import type { DCResult } from "../types/resultSchema.js";
import {
  detectBotWall,
  openProviderPage,
  realChromeAvailable,
} from "../playwright/browser.js";

// spaceship.com is behind a Cloudflare challenge that blocks headless browsers,
// so we use the official API (https://docs.spaceship.dev) for availability and
// premium pricing. The API has no standard pricing, so when real Chrome is
// available we read that from the search page.
const BASE = process.env.SPACESHIP_BASE_URL || "https://spaceship.dev/api/v1";

/** "example.com is available ... $8.88 $9.98/yr" -> first-year and renewal prices */
async function scrapeStandardPrice(domain: string) {
  const { page, close } = await openProviderPage("spaceship");
  try {
    await page.goto(
      `https://www.spaceship.com/domain-search/?query=${encodeURIComponent(domain)}&tab=domains`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    if (await detectBotWall(page)) return undefined;
    // The headline is split across elements, so poll the page text instead of a locator
    const needle = `${domain} is available`;
    let text = "";
    for (let i = 0; i < 15 && !text.toLowerCase().includes(needle); i++) {
      await page.waitForTimeout(1_000);
      text = (await page.innerText("body").catch(() => "")).replace(/\s+/g, " ");
    }
    const idx = text.toLowerCase().indexOf(needle);
    if (idx < 0) return undefined;
    const slice = text.slice(idx, idx + 200).split(/add to cart/i)[0] || "";
    const prices = [...slice.matchAll(/\$\s*([\d,]+(?:\.\d+)?)(\s*\/\s*yr)?/gi)].map((m) => ({
      amount: parseFloat(m[1]!.replace(/,/g, "")),
      perYear: !!m[2],
    }));
    const renewal = prices.find((p) => p.perYear)?.amount;
    const registration = prices.find((p) => !p.perYear)?.amount ?? renewal;
    return registration === undefined ? undefined : { registration, renewal };
  } catch {
    return undefined;
  } finally {
    await close();
  }
}

type PremiumPrice = { operation: string; price: number; currency: string };
type Availability = {
  domain: string;
  result: string; // available | taken | tldNotSupported | ...
  premiumPricing?: PremiumPrice[];
};

export async function checkSpaceshipDC(domain: string): Promise<DCResult> {
  const key = process.env.SPACESHIP_API_KEY;
  const secret = process.env.SPACESHIP_API_SECRET;
  if (!key || !secret) {
    return { ok: false, domain, error: "Missing SPACESHIP_API_KEY/SECRET" };
  }

  try {
    const r = await axios.get<Availability>(
      `${BASE}/domains/${encodeURIComponent(domain.trim().toLowerCase())}/available`,
      {
        timeout: 15_000,
        headers: { "X-API-Key": key, "X-API-Secret": secret },
      },
    );
    const data = r.data;

    if (data.result === "tldNotSupported") {
      return {
        ok: false,
        domain,
        error: "Spaceship does not support this domain extension",
      };
    }

    if (data.result !== "available") {
      return { ok: true, domain, available: false, isPremium: false };
    }

    const premium = data.premiumPricing || [];
    const reg = premium.find((p) => p.operation === "register");
    const renew = premium.find((p) => p.operation === "renew");
    const standard =
      premium.length === 0 && realChromeAvailable()
        ? await scrapeStandardPrice(data.domain)
        : undefined;

    return {
      ok: true,
      domain,
      available: true,
      isPremium: premium.length > 0,
      registrationPrice: reg?.price ?? standard?.registration,
      renewalPrice: renew?.price ?? standard?.renewal,
      currency: (reg?.currency || "USD").toUpperCase(),
      rawText: JSON.stringify(data).slice(0, 900),
    };
  } catch (e: any) {
    return {
      ok: false,
      domain,
      error: e?.response?.data?.detail || e?.message || "Spaceship API error",
    };
  }
}
