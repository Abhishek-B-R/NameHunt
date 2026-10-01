import axios from "axios";
import type { DCResult } from "../types/resultSchema.js";

// Squarespace's own domain search UI calls these public JSON endpoints.
// Plain HTTP is much faster and more reliable than driving the SPA with Playwright.
const BASE = "https://domains.squarespace.com/api";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const STATUS_AVAILABLE = 1;
const STATUS_TAKEN = 2;

type Plan = {
  price?: { currency: string; value: string };
  discountedPrice?: { currency: string; value: string };
};

type StatusItem = {
  domainName: string;
  status: number;
  externalReferenceId?: { type: string; value: string };
};

const http = axios.create({
  baseURL: BASE,
  timeout: 20_000,
  headers: { "User-Agent": UA, Accept: "application/json" },
});

// Price table rarely changes; keep it in memory for an hour.
let planCache: { at: number; map: Record<string, Plan> } | null = null;
const PLAN_TTL_MS = 60 * 60 * 1000;

async function getPlanMap(): Promise<Record<string, Plan>> {
  if (planCache && Date.now() - planCache.at < PLAN_TTL_MS) return planCache.map;
  const r = await http.get("/checkout/available-plans/domains-plans", {
    params: { currency: "USD" },
  });
  const map = (r.data?.tldPlanMap || {}) as Record<string, Plan>;
  planCache = { at: Date.now(), map };
  return map;
}

function toNum(v?: string) {
  const n = v == null ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function checkSquarespaceDC(domain: string): Promise<DCResult> {
  const d = domain.trim().toLowerCase();
  try {
    const [statusRes, plans] = await Promise.all([
      http.get("/domain-availability-status", { params: { domainNames: d } }),
      getPlanMap(),
    ]);

    const statuses = (statusRes.data?.statuses || []) as StatusItem[];
    const item = statuses.find((s) => s.domainName?.toLowerCase() === d);

    if (!item) {
      return {
        ok: false,
        domain,
        error: "Squarespace does not support this domain extension",
      };
    }

    if (item.status === STATUS_TAKEN) {
      return { ok: true, domain, available: false, isPremium: false };
    }

    if (item.status !== STATUS_AVAILABLE) {
      return {
        ok: false,
        domain,
        error: `Unknown Squarespace status ${item.status}`,
        rawText: JSON.stringify(item).slice(0, 900),
      };
    }

    const ref = item.externalReferenceId;
    const isPremium = ref?.type === "PREMIUM";
    const plan = ref ? plans[ref.value] : undefined;

    // `discountedPrice` is the first-year price, `price` is the regular (renewal) price
    const renewalPrice = toNum(plan?.price?.value);
    const registrationPrice = toNum(plan?.discountedPrice?.value) ?? renewalPrice;

    return {
      ok: true,
      domain,
      available: true,
      isPremium,
      registrationPrice,
      renewalPrice,
      currency: plan?.price?.currency || "USD",
      rawText: JSON.stringify(item).slice(0, 900),
    };
  } catch (e: any) {
    // The status endpoint rejects TLDs Squarespace can't register with a 400
    if (e?.response?.status === 400) {
      return {
        ok: false,
        domain,
        error: "Squarespace does not support this domain extension",
      };
    }
    return {
      ok: false,
      domain,
      error: e?.message || "Squarespace request failed",
    };
  }
}
