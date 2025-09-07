import { resolveDomainPricing } from "../providers/hostinger.js";
import type { DCResult } from "../types/resultSchema.js";

type CatalogPrice = {
  id: string;
  name: string;
  currency: string;
  price: number; 
  first_period_price?: number | null;
  period: number | string;
  period_unit: string;
};

function toNumber(n: number | string | null | undefined): number | undefined {
  if (n === undefined || n === null) return undefined;
  const num = typeof n === "string" ? parseFloat(n) : n;
  return Number.isFinite(num) ? num : undefined;
}

function pickOneYearPrices(prices: CatalogPrice[]) {
  const yearly = prices
    .map((p) => ({
      ...p,
      periodNum: toNumber(p.period) || 0,
      unit: (p.period_unit || "").toLowerCase(),
    }))
    .filter((p) => p.unit.startsWith("year") && p.periodNum > 0);

  if (yearly.length === 0) return { reg: undefined, renew: undefined, currency: undefined };

  const oneYear = yearly.find((p) => p.periodNum === 1);

  if (oneYear) {
    const currency = oneYear.currency?.toUpperCase() || "USD";
    const registrationPrice =
      toNumber(oneYear.first_period_price) ?? toNumber(oneYear.price);

    const renewalPrice = toNumber(oneYear.price);

    return { reg: registrationPrice, renew: renewalPrice, currency };
  }

  yearly.sort((a, b) => (a.periodNum as number) - (b.periodNum as number));
  const shortest = yearly[0];
  const currency = shortest.currency?.toUpperCase() || "USD";

  const total = toNumber(shortest.price);
  const periodYears = shortest.periodNum as number;

  const perYear = total && periodYears ? total / periodYears : undefined;

  const regFromFirst =
    toNumber(shortest.first_period_price) && periodYears
      ? (shortest.first_period_price as number) / periodYears
      : undefined;

  const registrationPrice = regFromFirst ?? perYear;
  const renewalPrice = perYear;

  return { reg: registrationPrice, renew: renewalPrice, currency };
}

export async function checkHostingerDC(domainFqdn: string): Promise<DCResult> {
  try {
    const parts = domainFqdn.split(".");
    const tld = parts.pop() || "";
    const sld = parts.join(".");
    if (!sld || !tld) {
      return { ok: false, domain: domainFqdn, error: "Invalid domain format" };
    }

    const r = await resolveDomainPricing(sld, tld);

    if ("available" in r && r.available === false) {
      return {
        ok: true,
        domain: r.domain || domainFqdn,
        available: false,
        isPremium: false,
        rawText: JSON.stringify(r).slice(0, 900),
      };
    }

    if ("is_premium" in r && r.is_premium === true) {
      return {
        ok: true,
        domain: r.domain || domainFqdn,
        available: true,
        isPremium: true,
        registrationPrice: r.registrationPrice,
        renewalPrice: r.renewalPrice,
        currency: (r as any).currency || "USD",
        rawText: JSON.stringify(r).slice(0, 900),
      };
    }

    if ("catalog" in r) {
      const prices = (r.catalog?.prices || []) as CatalogPrice[];
      const { reg, renew, currency } = pickOneYearPrices(prices);

      return {
        ok: true,
        domain: r.domain || domainFqdn,
        available: true,
        isPremium: false,
        registrationPrice: reg,
        renewalPrice: renew,
        currency: currency || prices[0]?.currency?.toUpperCase() || "USD",
        rawText: JSON.stringify(r.catalog).slice(0, 900),
      };
    }

    return {
      ok: false,
      domain: domainFqdn,
      error: "Unknown Hostinger result shape",
      rawText: JSON.stringify(r).slice(0, 900),
    };
  } catch (e: any) {
    return {
      ok: false,
      domain: domainFqdn,
      error: e?.response?.data?.message || e?.message || "Hostinger error",
    };
  }
}