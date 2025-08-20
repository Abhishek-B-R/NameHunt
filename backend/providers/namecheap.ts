import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import type {CheckDomainResult,PricingRow, PricingResult} from "../../zod-types/types/namecheap"

const NAMECHEAP_BASE = "https://api.sandbox.namecheap.com/xml.response";
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
});

function buildParams(extra: Record<string, string>) {
  const base = {
    ApiUser: process.env.NAMECHEAP_API_USER || "",
    ApiKey: process.env.NAMECHEAP_API_KEY || "",
    UserName: process.env.NAMECHEAP_API_USER || "",
    ClientIp: process.env.NAMECHEAP_CLIENT_IP || "",
  };
  for (const [k, v] of Object.entries(base)) {
    if (!v) throw new Error(`Missing env var for ${k}`);
  }
  return { ...base, ...extra };
}

/* Helpers to extract common meta */
function extractMeta(parsed: any) {
  return {
    requestedCommand: parsed?.ApiResponse?.RequestedCommand,
    server: parsed?.ApiResponse?.Server,
    executionTime: parsed?.ApiResponse?.ExecutionTime
      ? Number(parsed.ApiResponse.ExecutionTime)
      : undefined,
    gmtOffset: parsed?.ApiResponse?.GMTTimeDifference,
  };
}

export async function checkDomainNamecheap(
  domain: string
): Promise<CheckDomainResult> {
  const response = await axios.get(NAMECHEAP_BASE, {
    params: buildParams({
      Command: "namecheap.domains.check",
      DomainList: domain,
    }),
  });

  const rawXml = response.data as string;
  const parsed = parser.parse(rawXml);

  const status = parsed?.ApiResponse?.Status;
  if (status !== "OK") {
    const errors =
      parsed?.ApiResponse?.Errors?.Error ??
      parsed?.ApiResponse?.Errors ??
      "Unknown error";
    throw new Error(`Namecheap check error: ${JSON.stringify(errors)}`);
  }

  const result =
    parsed?.ApiResponse?.CommandResponse?.DomainCheckResult ||
    parsed?.ApiResponse?.CommandResponse?.["DomainCheckResult"];

  return {
    ok: true,
    domain: result?.Domain ?? domain,
    available: String(result?.Available).toLowerCase() === "true",
    isPremium: String(result?.IsPremiumName).toLowerCase() === "true",
    prices: {
      premiumRegistration: Number(result?.PremiumRegistrationPrice || 0),
      premiumRenewal: Number(result?.PremiumRenewalPrice || 0),
      premiumRestore: Number(result?.PremiumRestorePrice || 0),
      premiumTransfer: Number(result?.PremiumTransferPrice || 0),
      icannFee: Number(result?.IcannFee || 0),
      eapFee: result?.EapFee ? Number(result.EapFee) : undefined,
    },
    meta: extractMeta(parsed),
    raw: parsed,
  };
}

export async function getDomainPriceNamecheap(
  tld: string,
  category: "REGISTER" | "RENEW" | "TRANSFER" = "REGISTER"
): Promise<PricingResult> {
  const response = await axios.get(NAMECHEAP_BASE, {
    params: buildParams({
      Command: "namecheap.users.getPricing",
      ProductType: "DOMAIN",
      ProductCategory: category,
      ProductName: tld, // "tech"
    }),
  });

  const rawXml = response.data as string;
  const parsed = parser.parse(rawXml);

  if (parsed?.ApiResponse?.Status !== "OK") {
    const errors =
      parsed?.ApiResponse?.Errors?.Error ??
      parsed?.ApiResponse?.Errors ??
      "Unknown error";
    throw new Error(`Namecheap pricing error: ${JSON.stringify(errors)}`);
  }

  const pricingRoot =
    parsed?.ApiResponse?.CommandResponse?.UserGetPricingResult;

  // Traverse ProductType -> ProductCategory -> Product -> Price
  const productType = pricingRoot?.ProductType || pricingRoot?.["ProductType"];
  const domainType = Array.isArray(productType)
    ? productType.find((pt: any) => pt.Name === "DOMAIN")
    : productType;

  const categories =
    domainType?.ProductCategory || domainType?.["ProductCategory"];
  const chosenCat = Array.isArray(categories)
    ? categories.find((c: any) => c.Name === category)
    : categories;

  const products = chosenCat?.Product || chosenCat?.["Product"];
  const targetProduct = Array.isArray(products)
    ? products.find((p: any) => p.Name?.toLowerCase() === tld.toLowerCase())
    : products;

  const priceNodes = targetProduct?.Price;
  const rows = Array.isArray(priceNodes)
    ? priceNodes
    : priceNodes
    ? [priceNodes]
    : [];

  const prices: PricingRow[] = rows.map((p: any) => ({
    duration: Number(p?.Duration ?? 1),
    durationType: p?.DurationType ?? "YEAR",
    price: Number(p?.Price ?? p?.YourPrice ?? p?.RegularPrice ?? 0),
    regularPrice: Number(p?.RegularPrice ?? 0),
    yourPrice: Number(p?.YourPrice ?? 0),
    couponPrice: p?.CouponPrice ? Number(p.CouponPrice) : undefined,
    currency: p?.Currency ?? "USD",
  }));

  prices.sort((a, b) => a.duration - b.duration);

  return {
    ok: true,
    tld,
    category,
    prices,
    meta: extractMeta(parsed),
    raw: parsed,
  };
}


const check = await checkDomainNamecheap("abhishek.tech");
console.log(JSON.stringify(check, null, 2));

const pricing = await getDomainPriceNamecheap("tech");
console.log(JSON.stringify(pricing, null, 2));