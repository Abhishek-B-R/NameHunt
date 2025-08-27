import axios, { type AxiosInstance } from "axios";

export interface DomainPricingResult {
  ok: boolean;
  domain: string;
  available?: boolean;
  isPremium?: boolean;
  registrationPrice?: number;
  renewalPrice?: number;
  currency?: string;
  error?: string;
}

export class IonosClient {
  private http: AxiosInstance;

  constructor(opts?: {
    baseUrl?: string;
    username?: string;
    token?: string;
    timeoutMs?: number;
  }) {
    const baseURL =
      opts?.baseUrl || process.env.IONOS_BASE || "https://api.hosting.ionos.com";

    const username = opts?.username || process.env.IONOS_USERNAME || "";
    const token = opts?.token || process.env.IONOS_TOKEN || "";

    if (!username || !token) {
      throw new Error("Missing IONOS_USERNAME or IONOS_TOKEN.");
    }

    this.http = axios.create({
      baseURL,
      timeout: opts?.timeoutMs ?? 10000,
      auth: { username, password: token },
      headers: { Accept: "application/json" },
    });
  }

  /**
   * Validate domain syntax (does not check availability or pricing).
   */
  async validateDomainSyntax(domains: string[]): Promise<any> {
    const resp = await this.http.post("/v1/validation/domains", domains, {
      headers: { "Content-Type": "application/json" },
    });
    return resp.data;
  }

  /**
   * Get TLD info (features supported, not pricing).
   */
  async getTldInfo(tld: string): Promise<any> {
    const resp = await this.http.get(`/v1/tlds/${tld}`);
    return resp.data;
  }

  /**
   * Get domain pricing + availability.
   * NOTE: IONOS docs you pasted do not show the pricing endpoint.
   * Replace `/v1/domains/availability` with the correct one once confirmed.
   */
  async getDomainPricing(domain: string): Promise<DomainPricingResult> {
    try {
      // This endpoint is a placeholder. Replace with the real IONOS pricing API.
      const resp = await this.http.post(
        "/v1/domains/availability",
        { domains: [domain] },
        { headers: { "Content-Type": "application/json" } }
      );

      const item = resp.data?.results?.[0];
      if (!item) {
        return { ok: false, domain, error: "No result" };
      }

      return {
        ok: true,
        domain,
        available: item.available ?? false,
        isPremium: item.premium ?? false,
        registrationPrice: item.registrationPrice ?? null,
        renewalPrice: item.renewalPrice ?? null,
        currency: item.currency ?? "USD",
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
(async () => {
  const ionos = new IonosClient();

  const result = await ionos.getDomainPricing("abhishek.tech");
  console.log("Domain pricing:", JSON.stringify(result, null, 2));
})();