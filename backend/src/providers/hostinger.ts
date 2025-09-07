import axios from "axios";
import { AvailabilityResponse, CatalogResponse } from "../types/hostinger.js";

const HOSTINGER_BASE =
  process.env.HOSTINGER_BASE_URL || "https://developers.hostinger.com/api";

function getAuthHeaders() {
  if (!process.env.HOSTINGER_API_TOKEN) {
    throw new Error("Missing HOSTINGER_API_TOKEN in env");
  }
  return {
    Authorization: `Bearer ${process.env.HOSTINGER_API_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function checkDomainHostinger(
  domain: string,
  tlds: string[],
  withAlternatives = false
) {
  const response = await axios.post(
    `${HOSTINGER_BASE}/domains/v1/availability`,
    {
      domain,
      tlds,
      with_alternatives: withAlternatives,
    },
    { headers: getAuthHeaders() }
  );

  const parsed = AvailabilityResponse.parse(response.data);
  return parsed;
}

export async function getDomainPricingHostinger(tld: string) {
  const response = await axios.get(`${HOSTINGER_BASE}/billing/v1/catalog`, {
    headers: getAuthHeaders(),
    params: {
      category: "DOMAIN",
      name: `.${tld.toUpperCase()}*`,
    },
  });

  const parsed = CatalogResponse.parse(response.data);

  const exact = parsed.find(
    (item) =>
      item.name.toLowerCase() === `.${tld.toLowerCase()} domain`
  );

  if (!exact) {
    throw new Error(`No pricing found for .${tld}`);
  }

  const normalized = {
    id: exact.id,
    name: exact.name,
    category: exact.category,
    prices: exact.prices.map((p) => ({
      ...p,
      price: p.price / 100,
      first_period_price: p.first_period_price
        ? p.first_period_price / 100
        : undefined,
    })),
  };

  return normalized;
}

export async function getPremiumDomainPricingHostinger(domain: string) {
  const response = await axios.post(
    `${HOSTINGER_BASE}/domains/v1/premium/price`,
    {
      domain,
      action: "REGISTER", // or RENEW / TRANSFER
    },
    { headers: getAuthHeaders() }
  );

  return {
    domain: response.data.domain,
    is_premium: true,
    currency: response.data.currency,
    registrationPrice: response.data.registration_price / 100,
    renewalPrice: response.data.renewal_price / 100,
    transferPrice: response.data.transfer_price / 100,
  };
}

export async function resolveDomainPricing(domain: string, tld: string) {
  const availability = await checkDomainHostinger(domain, [tld]);

  const result = availability.find((d) => d.domain.endsWith(tld));
  if (!result) throw new Error("No availability result");

  if (!result.is_available) {
    return { domain: `${domain}.${tld}`, available: false };
  }

  if ((result as any).is_premium === true) {
    return await getPremiumDomainPricingHostinger(`${domain}.${tld}`);
  }

  const catalog = await getDomainPricingHostinger(tld);
  return { domain: `${domain}.${tld}`, available: true, catalog };
}

export default async function checkHostinger(domain: string, tld: string) {
  domain = domain;
  tld = tld;

  const pricing = await resolveDomainPricing(domain, tld);
  return pricing;
}

// console.log(JSON.stringify(await checkHostinger('abhishek','tech'), null, 2));