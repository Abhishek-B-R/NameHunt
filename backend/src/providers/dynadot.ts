import axios from "axios";

export interface DynadotDomainPricing {
  ok: boolean;
  domain: string;
  available?: boolean;
  isPremium?: boolean;
  registrationPrice?: number;
  renewalPrice?: number;
  currency?: string;
  error?: string;
}

export class DynadotClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.dynadot.com/api3.json") {
    if (!apiKey) throw new Error("Missing Dynadot API key");
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Check domain availability and pricing
   */
  async getDomainPricing(domain: string): Promise<DynadotDomainPricing> {
    try {
      const resp = await axios.get(this.baseUrl, {
        params: {
          key: this.apiKey,
          command: "search",
          domain0: domain,
        },
      });

      const result = resp.data?.SearchResponse?.SearchResults?.[0];
      if (!result) {
        return { ok: false, domain, error: "No result" };
      }

      return {
        ok: true,
        domain,
        available: result.available === "yes",
        isPremium: result.is_premium === "yes",
        registrationPrice: parseFloat(result.price) || undefined,
        renewalPrice: parseFloat(result.renew_price) || undefined,
        currency: result.currency || "USD",
      };
    } catch (err: any) {
      return {
        ok: false,
        domain,
        error: err.response?.data?.message || err.message,
      };
    }
  }
}

// Example usage
// (async () => {
//   const dynadot = new DynadotClient(process.env.DYNADOT_API_KEY || "");

//   const result = await dynadot.getDomainPricing("abhishek.tech");
//   console.log("Domain pricing:", JSON.stringify(result, null, 2));
// })();