import axios, { type AxiosInstance } from "axios";

export interface SpaceshipDomainPricing {
  ok: boolean;
  domain: string;
  available?: boolean;
  isPremium?: boolean;
  registrationPrice?: number;
  renewalPrice?: number;
  currency?: string;
  error?: string;
  raw?: unknown;
}

export class SpaceshipClient {
  private http: AxiosInstance;

  constructor(apiKey: string, baseUrl = "https://api.spaceship.com") {
    if (!apiKey) throw new Error("Missing Spaceship API key");

    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 10000,
    });
  }

  /**
   * Check domain availability + pricing
   */
  async getDomainPricing(domain: string): Promise<SpaceshipDomainPricing> {
    try {
      const resp = await this.http.post("/domains/check", {
        domains: [domain],
      });

      const result = resp.data?.results?.[0];
      if (!result) {
        return { ok: false, domain, error: "No result", raw: resp.data };
      }

      return {
        ok: true,
        domain: result.domain,
        available: result.available,
        isPremium: result.premium,
        registrationPrice: result.registrationPrice,
        renewalPrice: result.renewalPrice,
        currency: result.currency || "USD",
      };
    } catch (err: any) {
      return {
        ok: false,
        domain,
        error: err.response?.data?.message || err.message,
        raw: err.response?.data,
      };
    }
  }
}

// Example usage
(async () => {
  const ss = new SpaceshipClient(process.env.SPACESHIP_API_KEY || "");

  const result = await ss.getDomainPricing("abhishek.tech");
  console.log("Domain pricing:", JSON.stringify(result, null, 2));
})();