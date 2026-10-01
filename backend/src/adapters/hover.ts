import axios from "axios";
import type { DCResult } from "../types/resultSchema.js";

// Hover's results page embeds a per-search `return_key`, which its
// /api/lookup endpoint needs. Lookups stream in, so we poll until `complete`.
const BASE = "https://www.hover.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const POLL_INTERVAL_MS = 1_000;
const POLL_DEADLINE_MS = 25_000;

type HoverResult = {
  domain: string;
  result_type?: string;
  is_exact?: boolean;
  price?: string;
  regular_price?: string;
  renew_price?: string;
};

type HoverLookup = {
  succeeded?: boolean;
  error?: string;
  complete?: boolean;
  results?: HoverResult[];
  taken?: string[];
  undetermined?: string[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseUsd(v?: string) {
  if (!v) return undefined;
  const n = parseFloat(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export async function checkHoverDC(domain: string): Promise<DCResult> {
  const d = domain.trim().toLowerCase();
  try {
    const page = await axios.get(`${BASE}/domains/results`, {
      params: { q: d },
      timeout: 20_000,
      headers: { "User-Agent": UA, Accept: "text/html" },
    });

    const html = String(page.data || "");
    const key = html.match(/return_key(?:&quot;|")\s*:\s*(?:&quot;|")(s\.[0-9a-f]+)/)?.[1];
    if (!key) {
      return { ok: false, domain, error: "Hover search key not found" };
    }

    const cookie = (page.headers["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");

    const started = Date.now();
    let data: HoverLookup = {};
    while (Date.now() - started < POLL_DEADLINE_MS) {
      const remaining = POLL_DEADLINE_MS - (Date.now() - started);
      const r = await axios
        .get(`${BASE}/api/lookup`, {
        params: { q: d, ipcountry: "--", exact_search: d, return_key: key },
        timeout: Math.max(3_000, remaining),
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          Referer: `${BASE}/domains/results?q=${encodeURIComponent(d)}`,
          ...(cookie ? { Cookie: cookie } : {}),
        },
      })
        // an occasional slow lookup shouldn't fail the search; retry until the deadline
        .catch((e) => (e?.code === "ECONNABORTED" ? null : Promise.reject(e)));
      if (!r) continue;
      data = r.data || {};
      if (data.succeeded === false) {
        return { ok: false, domain, error: data.error || "Hover lookup failed" };
      }

      if (data.taken?.includes(d)) {
        return { ok: true, domain, available: false, isPremium: false };
      }

      const exact = data.results?.find((x) => x.domain?.toLowerCase() === d);
      if (exact) {
        const type = exact.result_type || "";
        if (/make_offer/.test(type)) {
          return { ok: true, domain, available: false, isPremium: false };
        }
        return {
          ok: true,
          domain,
          available: true,
          isPremium: /premium/.test(type),
          registrationPrice: parseUsd(exact.price),
          renewalPrice: parseUsd(exact.renew_price || exact.regular_price),
          currency: "USD",
          rawText: JSON.stringify(exact).slice(0, 900),
        };
      }

      if (data.complete) break;
      await sleep(POLL_INTERVAL_MS);
    }

    if (data.undetermined?.includes(d) || !data.complete) {
      return { ok: false, domain, error: "Hover could not determine availability" };
    }

    // Lookup completed without listing the exact domain: Hover doesn't sell this TLD
    return {
      ok: false,
      domain,
      error: "Hover does not support this domain extension",
    };
  } catch (e: any) {
    return { ok: false, domain, error: e?.message || "Hover request failed" };
  }
}
