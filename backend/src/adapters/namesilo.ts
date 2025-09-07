import checkNamesilo from "../providers/namesilo.js";
import type { DCResult } from "../types/resultSchema.js";

export async function checkNamesiloDC(domain: string): Promise<DCResult> {
  try {
    const r = await checkNamesilo(domain);

    if (!r || r.ok === false) {
      return {
        ok: false,
        domain,
        error: r?.error || "NameSilo availability failed",
        rawText: r?.rawText
          ? typeof r.rawText === "string"
            ? r.rawText.slice(0, 900)
            : JSON.stringify(r.rawText).slice(0, 900)
          : undefined,
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
      rawText:
        r.rawText && typeof r.rawText !== "string"
          ? JSON.stringify(r.rawText).slice(0, 900)
          : (r.rawText as string | undefined)?.slice(0, 900),
    };
  } catch (e: any) {
    return {
      ok: false,
      domain,
      error: e?.response?.data?.reply?.detail || e?.message || "NameSilo error",
    };
  }
}