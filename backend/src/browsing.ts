import { chromium, type Browser } from "playwright";
import pLimit from "p-limit";
import { createClient } from "redis";
import { ProviderNames } from "./types/providerNames.js";
import type { DCResult } from "./types/resultSchema.js";

import { checkDynadot } from "./playwright/providers/dynadot.js";
import { checkGoDaddy } from "./playwright/providers/godaddy.js";
import { checkDomainHover } from "./playwright/providers/hover.js";
import { checkDomainIONOS } from "./playwright/providers/ionos.js";
import { checkNamecheap } from "./playwright/providers/namecheap.js";
import { checkNetworkSolutions } from "./playwright/providers/networksolutions.js";
import { checkDomainPorkbun } from "./playwright/providers/porkbun.js";
import { checkSquarespace } from "./playwright/providers/squarespace.js";
import { checkDomainSpaceship } from "./playwright/providers/spaceship.js";
import { checkHostingerDC } from "./adapters/hostinger.js";
import { checkNamecomDC } from "./adapters/namecom.js";
import { checkNamesiloDC } from "./adapters/namesilo.js";

const ONE_DAY = 24 * 60 * 60;
const HARD_TIMEOUT_MS = Number(process.env.HARD_TIMEOUT_MS || 200_000);

// Playwright browser pool
let browser: Browser | null = null;
const globalLimit = pLimit(Number(process.env.PW_CONCURRENCY || 8));

async function getBrowser() {
  if (browser) return browser;
  browser = await chromium.launch({ headless: true });
  return browser;
}

// Expose a helper for provider adapters that want a shared context
export async function withContext<T>(
  fn: (ctx: { browser: Browser; context: any; page: any }) => Promise<T>
) {
  return globalLimit(async () => {
    const b = await getBrowser();
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();

    let hardTimedOut = false;
    const watchdog = setTimeout(async () => {
      try {
        hardTimedOut = true;
        await page.close({ runBeforeUnload: false }).catch(() => {});
        await ctx.close().catch(() => {});
      } catch {
        // ignore
      }
    }, HARD_TIMEOUT_MS);

    try {
      const result = await fn({ browser: b, context: ctx, page });
      return result;
    } finally {
      clearTimeout(watchdog);

      try {
        if (!hardTimedOut) {
          await page.close({ runBeforeUnload: false }).catch(() => {});
          await ctx.close().catch(() => {});
        }
      } catch {
        // ignore
      }
    }
  });
}
// Redis cache
type RedisClient = ReturnType<typeof createClient>;
let redisClient: RedisClient | null = null;

async function getRedis(): Promise<RedisClient | null> {
  if (redisClient) return redisClient;
  const url =
    process.env.REDIS_URL ||
    process.env.REDIS_CONNECTION_STRING ||
    "redis://localhost:6379";
  try {
    const client = createClient({ url });
    client.on("error", (err) => {
      console.error("[redis] client error:", (err as any)?.message || err);
    });
    await client.connect();
    redisClient = client;
    return redisClient;
  } catch (e: any) {
    console.warn("[redis] connect failed, caching disabled:", e?.message || e);
    return null;
  }
}

function cacheKey(provider: string, domain: string) {
  const d = domain.trim().toLowerCase();
  return `dc:${provider}:${d}`;
}

// If your providers can accept withContext, you can rewrite them like:
// await withContext(({ page }) => checkGoDaddy(domain, { page }))
// For now, keep your existing signatures and enable headless reuse inside those modules when you migrate.
const providerMap: Record<
  ProviderNames,
  (domain: string) => Promise<DCResult>
> = {
  [ProviderNames.GODADDY]: (domain) =>
    checkGoDaddy(domain, { headless: true, ephemeralProfile: true }),
  [ProviderNames.NAMECHEAP]: (domain) =>
    checkNamecheap(domain, { headless: true, ephemeralProfile: true }),
  [ProviderNames.SQUARESPACE]: (domain) =>
    checkSquarespace(domain, { headless: true, ephemeralProfile: true }),
  [ProviderNames.IONOS]: (domain) =>
    checkDomainIONOS(domain, { headless: true, ephemeralProfile: true }),
  [ProviderNames.NETWORKSOLUTIONS]: (domain) =>
    checkNetworkSolutions(domain, { headless: true, ephemeralProfile: true }),
  [ProviderNames.DYNADOT]: (domain) =>
    checkDynadot(domain, { headless: true, ephemeralProfile: true }),
  [ProviderNames.HOVER]: (domain) =>
    checkDomainHover(domain, { headless: true, ephemeralProfile: true }),
  [ProviderNames.PORKBUN]: (domain) =>
    checkDomainPorkbun(domain, { headless: true, ephemeralProfile: true }),
  [ProviderNames.SPACESHIP]: (domain) =>
    checkDomainSpaceship(domain, { headless: true, ephemeralProfile: true }),

  // SDK adapters
  [ProviderNames.HOSTINGER]: (domain) => checkHostingerDC(domain),
  [ProviderNames.NAMECOM]: (domain) => checkNamecomDC(domain),
  [ProviderNames.NAMESILO]: (domain) => checkNamesiloDC(domain),
};

export type ProviderKey = keyof typeof providerMap;

export async function runBrowsingProvider(
  provider: ProviderKey,
  domain: string,
  opts?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<DCResult> {
  const run = providerMap[provider];
  if (!run) {
    return { ok: false, domain, error: `Unknown provider ${provider}` };
  }

  const timeoutMs = opts?.timeoutMs ?? 30000;
  const key = cacheKey(provider, domain);

  // cache read
  try {
    const r = await getRedis();
    if (r) {
      const cached = await r.get(key);
      if (cached) return JSON.parse(cached) as DCResult;
    }
  } catch (e: any) {
    console.warn("[redis] get failed:", e?.message || e);
  }

  // compute with timeout
  const result = await Promise.race<DCResult>([
    run(domain),
    new Promise<DCResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            ok: false,
            domain,
            error: `Timed out after ${timeoutMs} ms`,
          }),
        timeoutMs
      )
    ),
  ]);

  // cache write
  try {
    const r = await getRedis();
    if (r) await r.set(key, JSON.stringify(result), { EX: ONE_DAY });
  } catch (e: any) {
    console.warn("[redis] set failed:", e?.message || e);
  }

  return result;
}
