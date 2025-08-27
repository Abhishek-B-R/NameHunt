import axios from "axios";
import { z } from "zod";
import { PBAvailability, PBPriceDomain } from "../types/porkbun";

const BASE = "https://api.porkbun.com/api/json/v3";

function headers() {
  if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_KEY) {
    throw new Error("Missing PORKBUN_API_KEY or PORKBUN_SECRET_KEY");
  }
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function authBody() {
  return {
    apikey: process.env.PORKBUN_API_KEY!,
    secretapikey: process.env.PORKBUN_SECRET_KEY!,
  };
}

function toNumber(n: unknown): number | undefined {
  if (n == null) return undefined;
  const x = typeof n === "string" ? parseFloat(n) : (n as number);
  return Number.isFinite(x) ? x : undefined;
}

/**
 * Single function: give it "abhishek.tech" and get
 * { available, isPremium, registrationPrice, renewalPrice, currency }
 */
export async function getDomainPricingPorkbun(domain: string) {
  // 1) Check availability first for fast signal
  const availResp = await axios.post(
    `${BASE}/domain/check`,
    { ...authBody(), domain },
    { headers: headers() }
  );

  const availParsed = PBAvailability.safeParse(availResp.data);
  // Porkbun also has /domain/checkSingle; /domain/check returns array
  let available: boolean | undefined;
  let isPremiumHint: boolean | undefined;

  if (availParsed.success) {
    const entry = availParsed.data.domains.find(
      (d) => d.domain.toLowerCase() === domain.toLowerCase()
    );
    if (entry) {
      available = entry.status === "available";
      isPremiumHint = entry.premium;
    }
  } else {
    // Some accounts return minimal shape without domains array for single-check.
    // Ignore and rely on pricing endpoint for authoritative results.
  }

  // 2) Get authoritative domain-specific pricing
  // Porkbun provides pricing per exact domain
  const priceResp = await axios.post(
    `${BASE}/pricing/get/domain`,
    { ...authBody(), domain },
    { headers: headers() }
  );

  const priceParsed = PBPriceDomain.parse(priceResp.data);

  const isPremium =
    typeof priceParsed.premium === "boolean"
      ? priceParsed.premium
      : Boolean(isPremiumHint);

  const registrationPrice = toNumber(priceParsed.registration?.price);
  const renewalPrice = toNumber(priceParsed.renewal?.price);
  const transferPrice = toNumber(priceParsed.transfer?.price);
  const currency =
    priceParsed.registration?.currency ||
    priceParsed.renewal?.currency ||
    priceParsed.transfer?.currency ||
    "USD";

  // If availability missing, infer from pricing: if registrationPrice exists, assume purchasable
  if (available === undefined) {
    available = typeof registrationPrice === "number";
  }

  return {
    ok: true,
    provider: "porkbun",
    domain,
    available: Boolean(available),
    isPremium,
    registrationPrice,
    renewalPrice,
    transferPrice,
    currency,
    raw: { availability: availResp.data, pricing: priceResp.data },
  };
}