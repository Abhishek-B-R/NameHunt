import { chromium, type Browser } from "playwright";
import pLimit from "p-limit";
import { createClient } from "redis";
import { getRedisUrl } from "./redisConnection.js";
import { ProviderNames } from "./types/providerNames.js";
import type { DCResult } from "./types/resultSchema.js";

import { checkDynadot } from "./playwright/providers/dynadot.js";
import { checkGoDaddy } from "./playwright/providers/godaddy.js";
import { checkDomainIONOS } from "./playwright/providers/ionos.js";
import { checkNamecheap } from "./playwright/providers/namecheap.js";
import { checkNetworkSolutions } from "./playwright/providers/networksolutions.js";
import { checkDomainPorkbun } from "./playwright/providers/porkbun.js";
import { checkHostingerDC } from "./adapters/hostinger.js";
import { checkHoverDC } from "./adapters/hover.js";
import { checkNamecomDC } from "./adapters/namecom.js";
import { checkNamesiloDC } from "./adapters/namesilo.js";
import { checkSpaceshipDC } from "./adapters/spaceship.js";
import { checkSquarespaceDC } from "./adapters/squarespace.js";

const ONE_DAY = 24 * 60 * 60;
// Failures are usually transient (bot walls, timeouts), so only remember them briefly
const ERROR_TTL = Number(process.env.ERROR_CACHE_TTL_S || 10 * 60);
const HARD_TIMEOUT_MS = Number(process.env.HARD_TIMEOUT_MS || 200_000);

// Playwright browser pool
let browser: Browser | null = null;
const globalLimit = pLimit(Number(process.env.PW_CONCURRENCY || 6));

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
    getRedisUrl();

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

// Each Playwright provider launches its own Chromium, so cap how many run at once.
// HTTP/API providers bypass this limit and never queue behind browsers.
const browserJob =
  (fn: (domain: string) => Promise<DCResult>) => (domain: string) =>
    globalLimit(() => fn(domain));

const pwOpts = { headless: true, ephemeralProfile: true } as const;

const providerMap: Record<
  ProviderNames,
  (domain: string) => Promise<DCResult>
> = {
  // Playwright scrapers
  [ProviderNames.GODADDY]: browserJob((d) => checkGoDaddy(d, pwOpts)),
  [ProviderNames.NAMECHEAP]: browserJob((d) => checkNamecheap(d, pwOpts)),
  [ProviderNames.IONOS]: browserJob((d) => checkDomainIONOS(d, pwOpts)),
  [ProviderNames.NETWORKSOLUTIONS]: browserJob((d) =>
    checkNetworkSolutions(d, pwOpts),
  ),
  [ProviderNames.DYNADOT]: browserJob((d) => checkDynadot(d, pwOpts)),
  [ProviderNames.PORKBUN]: browserJob((d) => checkDomainPorkbun(d, pwOpts)),

  // HTTP/API adapters
  [ProviderNames.SQUARESPACE]: (domain) => checkSquarespaceDC(domain),
  [ProviderNames.HOVER]: (domain) => checkHoverDC(domain),
  [ProviderNames.SPACESHIP]: (domain) => checkSpaceshipDC(domain),
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
    if (r)
      await r.set(key, JSON.stringify(result), {
        EX: result.ok ? ONE_DAY : ERROR_TTL,
      });
  } catch (e: any) {
    console.warn("[redis] set failed:", e?.message || e);
  }

  return result;
}
