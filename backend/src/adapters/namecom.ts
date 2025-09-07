import type { DCResult } from "../types/resultSchema.js";
import checkNamecom from "../providers/namecom.js";

export async function checkNamecomDC(domain: string): Promise<DCResult> {
  try {
    const r = await checkNamecom(domain);

    if (!r || r.ok === false) {
      return {
        ok: false,
        domain,
        error: r?.error || "Name.com availability failed",
      };
    }

    return {
      ok: true,
      domain: r.domain || domain,
      available: r.available,
      isPremium: r.isPremium,
      registrationPrice: r.registrationPrice,
      renewalPrice: r.renewalPrice,
      currency: r.currency || "USD",
      rawText: undefined,
    };
  } catch (e: any) {
    return {
      ok: false,
      domain,
      error: e?.response?.data?.message || e?.message || "Name.com API error",
    };
  }
}