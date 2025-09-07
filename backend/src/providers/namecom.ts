import axios, { type AxiosInstance } from "axios";
import { NamecomAvailabilityResponse } from "../types/namecom.js";

class NamecomClient {
  private http: AxiosInstance;

  constructor(opts?: {
    baseUrl?: string;
    username?: string;
    token?: string;
    timeoutMs?: number;
  }) {
    const baseURL =
      opts?.baseUrl ||
      process.env.NAMECOM_BASE ||
      "https://api.name.com";

    const username = opts?.username || process.env.NAMECOM_USERNAME || "";
    const token = opts?.token || process.env.NAMECOM_TOKEN || "";

    if (!username || !token) {
      throw new Error("Missing NAMECOM_USERNAME or NAMECOM_TOKEN.");
    }

    this.http = axios.create({
      baseURL,
      timeout: opts?.timeoutMs ?? 10000,
      auth: { username, password: token },
      headers: { Accept: "application/json" },
    });
  }

  async getDomainPricing(domain: string) {
    const resp = await this.http.post(
      "/core/v1/domains:checkAvailability",
      { domainNames: [domain] },
      { headers: { "Content-Type": "application/json" } }
    );

    const parsed = NamecomAvailabilityResponse.parse(resp.data);
    const item = parsed.results[0];

    if (!item) {
      return { ok: false, error: "No result" };
    }

    if (!item.purchasable) {
      return {
        ok: true,
        domain,
        available: false,
        isPremium: item.premium ?? false,
      };
    }

    return {
      ok: true,
      domain,
      available: true,
      isPremium: item.premium ?? false,
      registrationPrice: item.purchasePrice,
      renewalPrice: item.renewalPrice,
      currency: "USD",
    };
  }
}

export default async function checkNamecom(domain: string) {
  const nc = new NamecomClient();

  const result = await nc.getDomainPricing(domain);
  return result;
}