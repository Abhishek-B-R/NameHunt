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

app.get("/search/stream", async (c) => {
  const url = new URL(c.req.url)
  const domain = (url.searchParams.get("domain") || "").trim()
  const timeoutMs = Number(url.searchParams.get("timeoutMs") || 90000)
  const providersParam = url.searchParams.get("providers") || ""
  const allProviders = Object.values(ProviderNames)
  const providers = providersParam
    ? providersParam
        .split(",")
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p.length > 0)
    : allProviders

  if (!domain) {
    return c.json({ ok: false, error: 'Query param "domain" is required' }, 400)
  }
  const invalid = providers.filter(
    (p) => !allProviders.includes(p as ProviderNames)
  )
  if (invalid.length) {
    return c.json(
      {
        ok: false,
        error: `Invalid providers: ${invalid.join(", ")}. Allowed: ${allProviders.join(", ")}`,
      },
      400
    )
  }

  const headers = new Headers()
  headers.set("Content-Type", "text/event-stream")
  headers.set("Cache-Control", "no-cache")
  headers.set("Connection", "keep-alive")
  headers.set("Access-Control-Allow-Origin", "http://localhost:3000")
  headers.set("X-Accel-Buffering", "no")

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`))
        controller.enqueue(
          encoder.encode(
            `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`
          )
        )
      }

      // reconnection hint
      controller.enqueue(encoder.encode(`retry: 5000\n\n`))

      // heartbeat
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: keep-alive\n\n`))
      }, 10000)

      // init event
      send("init", { ok: true, domain, providers, timeoutMs, ts: Date.now() })

      const abort = new AbortController()
      const tasks = providers.map(async (p) => {
        try {
          const res = await runBrowsingProvider(p as ProviderNames, domain, {
            timeoutMs,
            signal: abort.signal as any,
          })
          send("result", { provider: p, result: res, ts: Date.now() })
        } catch (err: any) {
          send("result", {
            provider: p,
            result: {
              ok: false,
              domain,
              error:
                err?.response?.data?.message ||
                err?.message ||
                "Provider failed",
            },
            ts: Date.now(),
          })
        }
      })

      Promise.allSettled(tasks)
        .then(() => {
          send("done", { ok: true, ts: Date.now() })
        })
        .finally(() => {
          clearInterval(heartbeat)
          controller.close()
        })
    },
    cancel() {
      // client disconnected
    },
  })

  return new Response(stream, { headers })
})

// Start server
const port = Number(process.env.PORT || 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server listening on http://localhost:${port}`);
});