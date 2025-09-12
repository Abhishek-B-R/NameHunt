import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { ProviderNames } from "./types/providerNames.js";
import { providerQueue, providerEvents } from "./queue.js";

const app = new Hono();

app.use("*", cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use("*", prettyJSON());

app.get("/health", (c) => c.json({ ok: true }));

app.post("/search", async (c) => {
  try {
    const body = await c.req.json<{
      provider?: string;
      domain?: string;
      timeoutMs?: number;
    }>();

    const provider = (body.provider || "").trim().toLowerCase() as ProviderNames;
    const domain = (body.domain || "").trim();
    const timeoutMs = body.timeoutMs ?? 45_000;

    if (!provider) return c.json({ ok: false, error: 'Field "provider" is required' }, 400);
    if (!domain) return c.json({ ok: false, error: 'Field "domain" is required' }, 400);

    if (!Object.values(ProviderNames).includes(provider)) {
      return c.json(
        { ok: false, error: `Only ${Object.values(ProviderNames).join(", ")} are supported` },
        400
      );
    }

    const job = await providerQueue.add(
      "check",
      { provider, domain, timeoutMs },
      { jobId: `check:${provider}:${domain}` }
    );

    const result = await job.waitUntilFinished(providerEvents, timeoutMs + 5_000).catch(() => null);
    if (!result) return c.json({ ok: false, domain, error: "Job failed or timed out" }, 502);

    return c.json(result, result.ok ? 200 : 502);
  } catch {
    return c.json({ ok: false, error: "Invalid JSON payload" }, 400);
  }
});

app.post("/search/all", async (c) => {
  try {
    const body = await c.req.json<{
      domain?: string;
      timeoutMs?: number;
      providers?: ProviderNames[];
    }>();

    const domain = (body.domain || "").trim();
    if (!domain) return c.json({ ok: false, error: 'Field "domain" is required' }, 400);

    const allProviders = Object.values(ProviderNames);
    const providers =
      Array.isArray(body.providers) && body.providers.length > 0
        ? body.providers.map((p) => String(p).toLowerCase() as ProviderNames)
        : (allProviders as ProviderNames[]);

    const invalid = providers.filter((p) => !allProviders.includes(p));
    if (invalid.length) {
      return c.json(
        { ok: false, error: `Invalid providers: ${invalid.join(", ")}. Allowed: ${allProviders.join(", ")}` },
        400
      );
    }

    const timeoutMs = body.timeoutMs ?? 45_000;

    const jobs = await Promise.all(
      providers.map((p) =>
        providerQueue.add(
          "check",
          { provider: p, domain, timeoutMs },
          { jobId: `check:${p}:${domain}:${Date.now()}` }
        )
      )
    );

    const settled = await Promise.allSettled(
      jobs.map((j) => j.waitUntilFinished(providerEvents, timeoutMs + 5_000))
    );

    const results: Record<string, any> = {};
    settled.forEach((s, idx) => {
      const provider = providers[idx];
      if (s.status === "fulfilled") results[provider] = s.value;
      else
        results[provider] = {
          ok: false,
          domain,
          error: s.reason?.message || "Provider failed",
        };
    });

    const anyOk = Object.values(results).some((r: any) => r && typeof r === "object" && r.ok === true);

    return c.json({ ok: anyOk, domain, results }, anyOk ? 200 : 502);
  } catch {
    return c.json({ ok: false, error: "Invalid JSON payload" }, 400);
  }
});

app.get("/search/stream", async (c) => {
  const url = new URL(c.req.url);
  const domain = (url.searchParams.get("domain") || "").trim();
  const timeoutMs = Number(url.searchParams.get("timeoutMs") || 90_000);
  const providersParam = url.searchParams.get("providers") || "";
  const allProviders = Object.values(ProviderNames);
  const providers = providersParam
    ? providersParam
        .split(",")
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p.length > 0)
    : allProviders;

  if (!domain) return c.json({ ok: false, error: 'Query param "domain" is required' }, 400);

  const invalid = providers.filter((p) => !allProviders.includes(p as ProviderNames));
  if (invalid.length) {
    return c.json(
      { ok: false, error: `Invalid providers: ${invalid.join(", ")}. Allowed: ${allProviders.join(", ")}` },
      400
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("Connection", "keep-alive");
  headers.set("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  headers.set("X-Accel-Buffering", "no");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(
          encoder.encode(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`)
        );
      };

      controller.enqueue(encoder.encode(`retry: 5000\n\n`));
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: keep-alive\n\n`));
      }, 10000);

      send("init", { ok: true, domain, providers, timeoutMs, ts: Date.now() });

      try {
        const jobs = await Promise.all(
          providers.map((p) =>
            providerQueue.add(
              "check",
              { provider: p, domain, timeoutMs },
              { jobId: `check:${p}:${domain}:${Date.now()}` }
            )
          )
        );

        jobs.forEach((job, i) => {
          job
            .waitUntilFinished(providerEvents, timeoutMs + 5_000)
            .then((res) => send("result", { provider: providers[i], result: res, ts: Date.now() }))
            .catch((err) =>
              send("result", {
                provider: providers[i],
                result: { ok: false, domain, error: err?.message || "Provider failed" },
                ts: Date.now(),
              })
            );
        });

        // wait for all jobs to finish
        await Promise.allSettled(
          jobs.map((j) => j.waitUntilFinished(providerEvents, timeoutMs + 5_000))
        );
        send("done", { ok: true, ts: Date.now() });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
});

// Boot server and the worker (import side-effect starts worker in queue.ts)
const port = Number(process.env.PORT || 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server listening on http://localhost:${port}`);
});