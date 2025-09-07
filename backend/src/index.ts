import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { runBrowsingProvider } from "./browsing.js";
import { ProviderNames } from "./types/providerNames.js";

const app = new Hono();

app.use("*", cors());
app.use("*", prettyJSON());

app.get("/health", (c) => c.json({ ok: true }));

// Existing single-provider route
app.post("/search", async (c) => {
  try {
    const body = await c.req.json<{
      provider?: string;
      domain?: string;
      timeoutMs?: number;
    }>();

    const provider = (body.provider || "").trim().toLowerCase();
    const domain = (body.domain || "").trim();

    if (!provider)
      return c.json({ ok: false, error: 'Field "provider" is required' }, 400);
    if (!domain)
      return c.json({ ok: false, error: 'Field "domain" is required' }, 400);

    if (!Object.values(ProviderNames).includes(provider as ProviderNames)) {
      return c.json(
        {
          ok: false,
          error: `Only ${Object.values(ProviderNames).join(
            ", "
          )} are supported on this route right now`,
        },
        400
      );
    }

    const result = await runBrowsingProvider(
      provider as ProviderNames,
      domain,
      {
        timeoutMs: body.timeoutMs ?? 45000,
      }
    );

    return c.json(result, result.ok ? 200 : 502);
  } catch (e) {
    return c.json({ ok: false, error: "Invalid JSON payload" }, 400);
  }
});

// New multi-provider fan-out route
app.post("/search/all", async (c) => {
  try {
    const body = await c.req.json<{
      domain?: string;
      timeoutMs?: number;
      providers?: ProviderNames[]; // optional subset override
    }>();

    const domain = (body.domain || "").trim();
    if (!domain)
      return c.json({ ok: false, error: 'Field "domain" is required' }, 400);

    const allProviders = Object.values(ProviderNames);
    const providers =
      Array.isArray(body.providers) && body.providers.length > 0
        ? body.providers.map((p) => String(p).toLowerCase() as ProviderNames)
        : (allProviders as ProviderNames[]);

    // Validate subset
    const invalid = providers.filter(
      (p) => !allProviders.includes(p as ProviderNames)
    );
    if (invalid.length) {
      return c.json(
        {
          ok: false,
          error: `Invalid providers: ${invalid.join(
            ", "
          )}. Allowed: ${allProviders.join(", ")}`,
        },
        400
      );
    }

    const timeoutMs = body.timeoutMs ?? 45000;

    // Run in parallel with Promise.allSettled for resilience
    const settled = await Promise.allSettled(
      providers.map((p) => runBrowsingProvider(p, domain, { timeoutMs }))
    );

    // Build a result map keyed by provider
    const results: Record<string, any> = {};
    settled.forEach((s, idx) => {
      const provider = providers[idx];
      if (s.status === "fulfilled") {
        results[provider] = s.value;
      } else {
        results[provider] = {
          ok: false,
          domain,
          error:
            (s.reason?.response?.data?.message as string) ||
            (s.reason?.message as string) ||
            "Provider failed",
        };
      }
    });

    // ok is true if at least one provider succeeded
    const anyOk = Object.values(results).some(
      (r: any) => r && typeof r === "object" && r.ok === true
    );

    return c.json(
      {
        ok: anyOk,
        domain,
        results,
      },
      anyOk ? 200 : 502
    );
  } catch (e) {
    return c.json({ ok: false, error: "Invalid JSON payload" }, 400);
  }
});

// Start server
const port = Number(process.env.PORT || 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server listening on http://localhost:${port}`);
});