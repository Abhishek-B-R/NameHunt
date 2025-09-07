import axios from "axios";
import GoDaddyResponse,{ type GoDaddyResponseType } from "../types/godaddy.js";

const BASE =
  process.env.GODADDY_ENV === "prod"
    ? "https://api.godaddy.com"
    : "https://api.ote-godaddy.com";

function gdHeaders() {
  return {
    Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function microsToMoney(n: number | undefined) {
  return typeof n === "number" && Number.isFinite(n) ? n / 1_000_000 : undefined;
}

function isErrorResp(v: GoDaddyResponseType): v is Extract<GoDaddyResponseType, { code: string }> {
  return typeof (v as any)?.code === "string" && typeof (v as any)?.message === "string";
}

function hasPrice(v: GoDaddyResponseType): v is GoDaddyResponseType & { price: number } {
  return typeof (v as any)?.price === "number" && Number.isFinite((v as any).price);
}

// 1) Availability: conforms to your Zod union
export async function checkDomain(domain: string, period: number) {
  try {
    const response = await axios.get(
      `${BASE}/v1/domains/available?domain=${encodeURIComponent(
        domain
      )}&checkType=FULL&period=${period}`,
      { headers: gdHeaders() }
    );

    const parsed = GoDaddyResponse.parse(response.data) as GoDaddyResponseType;

    // Normalize micro-units price if present in the union
    if (hasPrice(parsed)) {
      parsed.price = microsToMoney(parsed.price) as number;
    }

    if (isErrorResp(parsed)) {
      // Surface API error explicitly
      throw new Error(`GoDaddy availability error: ${parsed.code} ${parsed.message}`);
    }

    return parsed;
  } catch (error: any) {
    if (error.response) {
      console.error("API Error:", error.response.status, error.response.data);
    } else {
      console.error("Error:", error.message);
    }
    throw error;
  }
}

/**
2) POST /v1/domains/purchase/validate
   Use this to get a definitive quote and infer premium.
   Your Zod types do not cover this endpoint, so we keep it typed loosely but normalized.
*/
export async function validatePurchaseQuote(domain: string, period: number = 1) {
  const headers = gdHeaders();

  const contact = {
    nameFirst: "Test",
    nameLast: "User",
    email: "test@example.com",
    phone: "+1.5555555555",
    addressMailing: {
      address1: "123 Test St",
      city: "Phoenix",
      country: "US",
      postalCode: "85001",
      state: "AZ",
    },
  };

  const body = {
    domain,
    period,
    privacy: false,
    renewAuto: false,
    consent: {
      agreedAt: new Date().toISOString(),
      agreedBy: "127.0.0.1",
      agreementKeys: ["DNRA"],
    },
    contactAdmin: contact,
    contactBilling: contact,
    contactRegistrant: contact,
    contactTech: contact,
  };

  const resp = await axios.post(`${BASE}/v1/domains/purchase/validate`, body, {
    headers,
  });

  const data: any = resp.data;

  const total =
    microsToMoney(data.total) ?? microsToMoney(data.amount) ?? microsToMoney(data.subtotal);

  const fees = Array.isArray(data.fees)
    ? data.fees.map((f: any) => ({
        type: f?.type,
        amount: microsToMoney(f?.amount),
      }))
    : [];

  const item = Array.isArray(data.items) ? data.items[0] : undefined;

  const feeTypeSet = new Set(
    (fees || []).map((f: { type: any; }) => String(f.type || "").toUpperCase())
  );

  const isPremium =
    Boolean(data.isPremium) ||
    Boolean(item?.isPremium) ||
    Boolean(item?.premium) ||
    Boolean(item?.pricing?.special) ||
    Boolean(item?.specialPricing) ||
    feeTypeSet.has("PREMIUM") ||
    feeTypeSet.has("AFTERMARKET") ||
    feeTypeSet.has("AFTER_MARKET") ||
    feeTypeSet.has("PRM") ||
    feeTypeSet.has("PREMIUM_DNS");

  return {
    ok: true,
    domain,
    currency: data.currency || "USD",
    total, // normalized money
    fees,
    isPremium,
    raw: data,
  };
}

/**
3) Convenience: availability + premium-aware quote
   Works with your Zod union; does not change your types.
*/
export async function checkDomainWithPremium(domain: string, period = 1) {
  const avail = await checkDomain(domain, period);

  // If union is ErrorSchema, we never reach here because checkDomain throws.
  // For availability, your union ensures `available` exists.
  const available = (avail as any)?.available === true;

  if (!available) {
    return {
      domain,
      available: false,
      isPremium: undefined,
      currency: (avail as any).currency ?? "USD",
      availability: avail,
    };
  }

  const quote = await validatePurchaseQuote(domain, period);

  return {
    domain,
    available: true,
    isPremium: quote.isPremium,
    currency: quote.currency,
    availabilityPrice: hasPrice(avail) ? (avail as any).price : undefined,
    validatedTotal: quote.total,
    fees: quote.fees,
    raw: { availability: avail, validate: quote.raw },
  };
}

// Example usage
(async () => {
  const domain = "abhishekbr.com";
  const period = 2;
  const result = await checkDomainWithPremium(domain, period);
  console.log(JSON.stringify(result, null, 2));
})();