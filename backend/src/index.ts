// src/index.ts
import "dotenv/config"
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { runBrowsingProvider } from "./browsing.js";
import { ProviderNames }  from "./types/providerNames.js"
const app = new Hono();

app.use("*", cors());
app.use("*", prettyJSON());

app.get("/health", (c) => c.json({ ok: true }));

app.post("/search", async (c) => {
  try {
    const body = await c.req.json<{
      provider?: string;
      domain?: string;
      timeoutMs?: number;
    }>();

    const provider = (body.provider || "").trim().toLowerCase();
    const domain = (body.domain || "").trim();

    if (!provider) return c.json({ ok: false, error: 'Field "provider" is required' }, 400);
    if (!domain) return c.json({ ok: false, error: 'Field "domain" is required' }, 400);

    if (!Object.values(ProviderNames).includes(provider as ProviderNames)) {
      return c.json(
        { ok: false, error: `Only ${Object.values(ProviderNames).join(", ")} are supported on this route right now` },
        400
      );
    }

    const result = await runBrowsingProvider(provider as ProviderNames, domain, {
      timeoutMs: body.timeoutMs ?? 45000,
    });

    return c.json(result, result.ok ? 200 : 502);
  } catch (e) {
    return c.json({ ok: false, error: "Invalid JSON payload" }, 400);
  }
});

// actually start the server in Node
const port = Number(process.env.PORT || 8080);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server listening on http://localhost:${port}`);
});