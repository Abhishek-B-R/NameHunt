import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { z } from "zod";

export type HostingerConfig = {
  baseUrl: string; // e.g. https://api.partner.hostinger.com/domains
  clientId: string;
  clientSecret: string;
  scope?: string; // if required
  timeoutMs?: number;
};

const TokenResponse = z.object({
  access_token: z.string(),
  token_type: z.string(), // expect "Bearer"
  expires_in: z.number(),
});
type TokenResponseT = z.infer<typeof TokenResponse>;

// Example response schemas. Replace with real partner schema once you have docs.
export const AvailabilitySchema = z.object({
  domain: z.string(),
  available: z.boolean(),
  // optional hints if provided
  isPremium: z.boolean().optional(),
});
export type Availability = z.infer<typeof AvailabilitySchema>;

export const QuoteSchema = z.object({
  domain: z.string(),
  currency: z.string(),
  isPremium: z.boolean().optional(),
  registrationPrice: z.number().optional(),
  renewalPrice: z.number().optional(),
  transferPrice: z.number().optional(),
  fees: z
    .object({
      icann: z.number().optional(),
    })
    .partial()
    .optional(),
});
export type Quote = z.infer<typeof QuoteSchema>;

export class HostingerDomains {
  private http: AxiosInstance;
  private cfg: HostingerConfig;
  private token?: { value: string; exp: number };

  constructor(cfg?: Partial<HostingerConfig>) {
    // Read from env by default
    const baseUrl = cfg?.baseUrl || process.env.HOSTINGER_BASE_URL || "";
    const clientId = cfg?.clientId || process.env.HOSTINGER_CLIENT_ID || "";
    const clientSecret =
      cfg?.clientSecret || process.env.HOSTINGER_CLIENT_SECRET || "";
    const scope = cfg?.scope || process.env.HOSTINGER_SCOPE || undefined;

    if (!baseUrl || !clientId || !clientSecret) {
      throw new Error(
        "Hostinger provider missing env: HOSTINGER_BASE_URL, HOSTINGER_CLIENT_ID, HOSTINGER_CLIENT_SECRET"
      );
    }

    this.cfg = {
      baseUrl,
      clientId,
      clientSecret,
      scope,
      timeoutMs: cfg?.timeoutMs ?? 8000,
    };

    this.http = axios.create({
      baseURL: this.cfg.baseUrl,
      timeout: this.cfg.timeoutMs,
    });
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.exp - 60_000) {
      return this.token.value;
    }

    // Replace with the actual OAuth token URL provided by Hostinger partner docs
    const tokenUrl = `${this.cfg.baseUrl}/oauth2/token`;

    const params = new URLSearchParams();
    params.set("grant_type", "client_credentials");
    if (this.cfg.scope) params.set("scope", this.cfg.scope);

    const resp = await axios.post(tokenUrl, params, {
      auth: {
        username: this.cfg.clientId,
        password: this.cfg.clientSecret,
      },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: this.cfg.timeoutMs,
    });

    const parsed = TokenResponse.parse(resp.data);
    const exp = Date.now() + parsed.expires_in * 1000;
    this.token = { value: parsed.access_token, exp };
    return parsed.access_token;
  }

  private async authed<T>(
    config: AxiosRequestConfig
  ): Promise<{ data: T; status: number }> {
    const token = await this.getToken();
    const resp = await this.http.request<T>({
      ...config,
      headers: {
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    return { data: resp.data as T, status: resp.status };
  }

  // Check availability for a domain
  async availability(domain: string): Promise<Availability> {
    // Placeholder path. Replace with Hostinger partner path.
    const { data } = await this.authed<any>({
      method: "GET",
      url: "/domains/availability",
      params: { domain },
    });
    return AvailabilitySchema.parse(data);
  }

  // Get a quote for a domain for a specific action
  async quote(
    domain: string,
    action: "REGISTER" | "RENEW" | "TRANSFER" = "REGISTER"
  ): Promise<Quote> {
    // Placeholder path. Replace with Hostinger partner path.
    const { data } = await this.authed<any>({
      method: "GET",
      url: "/domains/quote",
      params: { domain, action },
    });

    const parsed = QuoteSchema.parse({
      domain: data.domain ?? domain,
      currency: data.currency ?? "USD",
      isPremium: !!data.isPremium,
      registrationPrice:
        data.registrationPrice ??
        data.price ??
        (action === "REGISTER" ? data.amount : undefined),
      renewalPrice: data.renewalPrice ?? undefined,
      transferPrice: data.transferPrice ?? undefined,
      fees: {
        icann: data.icannFee ? Number(data.icannFee) : undefined,
      },
    });

    return parsed;
  }
}