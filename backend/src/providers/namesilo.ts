import axios from "axios";
import type { NameSiloDomainPricing } from "../types/namesilo.js";
export class NameSiloClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://www.namesilo.com/api") {
    if (!apiKey) throw new Error("Missing NameSilo API key");
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getDomainPricing(domain: string): Promise<NameSiloDomainPricing> {
    try {
      const resp = await axios.get(
        `${this.baseUrl}/checkRegisterAvailability`,
        {
          params: {
            version: 1,
            type: "json",
            key: this.apiKey,
            domains: domain,
          },
        }
      );

      const reply = resp.data?.reply;
      if (!reply || reply.code !== 300) {
        return {
          ok: false,
          domain,
          error: reply?.detail || "Invalid API response",
          rawText: resp.data,
        };
      }

      const available = reply.available?.domain;
      if (available) {
        return {
          ok: true,
          domain: available.domain,
          available: true,
          isPremium: available.premium === 1,
          registrationPrice: parseFloat(available.price),
          renewalPrice: parseFloat(available.renew),
          currency: "USD", // NameSilo always returns USD
        };
      }

      // If not in available, check unavailable
      if (reply.unavailable?.domain) {
        return {
          ok: true,
          domain,
          available: false,
          isPremium: false,
        };
      }

      // If invalid
      if (reply.invalid?.domain) {
        return {
          ok: false,
          domain,
          error: "Invalid domain name",
        };
      }

      return {
        ok: false,
        domain,
        error: "Domain not present in any list",
        rawText: reply,
      };
    } catch (err: any) {
      return {
        ok: false,
        domain,
        error: err.response?.data?.reply?.detail || err.message,
        rawText: err.response?.data,
      };
    }
  }
}

export default async function checkNamesilo(domain:string) {
  const ns = new NameSiloClient(process.env.NAMESILO_API_KEY || "");
  const result = await ns.getDomainPricing(domain);
  return result;
}

// Example usage
// (async () => {
//   const ns = new NameSiloClient(process.env.NAMESILO_API_KEY || "");
//   const result = await ns.getDomainPricing("abhishekbr.tech");
//   console.log("Domain pricing:", JSON.stringify(result, null, 2));
// })();