import { chromium, type BrowserContext } from "playwright";
import { FingerprintGenerator } from "fingerprint-generator";
import { FingerprintInjector } from "fingerprint-injector";
import type { ProxyOpts, StealthOpts } from "../types/browserTypes.js";

// Pull the same hard timeout you use in browsing.ts
const HARD_TIMEOUT_MS = Number(process.env.HARD_TIMEOUT_MS || 200_000);

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Creates a persistent Playwright context with stealth + fingerprinting.
 * Guarantees the context will be force-closed by a watchdog after HARD_TIMEOUT_MS.
 *
 * Important: Always ensure the caller closes the context when finished:
 *   const ctx = await newStealthContext(opts);
 *   try { ... } finally { await ctx.close().catch(() => {}); }
 *
 * The watchdog will also close it if the caller forgets or gets stuck.
 */
export async function newStealthContext(opts: StealthOpts): Promise<BrowserContext> {
  const width = randInt(1280, 1680);
  const height = randInt(720, 1000);

  const fg = new FingerprintGenerator({
    devices: ["desktop"],
    operatingSystems: ["windows", "macos"],
    browsers: [{ name: "chrome", minVersion: 120 }],
  });
  const fp = fg.getFingerprint();
  const userAgent = opts.userAgent || fp.headers["user-agent"];

  const launchOpts: any = {
    channel: "chrome",
    headless: opts.headless ?? false,
    proxy: opts.proxy as ProxyOpts | undefined,
    viewport: { width, height },
    locale: opts.locale || "en-US",
    timezoneId: opts.timezoneId || "America/New_York",
    userAgent,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      `--window-size=${width},${height}`,
    ],
  };

  // 1) Launch a persistent context as before
  const ctx = await chromium.launchPersistentContext(opts.profileDir, launchOpts);

  // 2) Apply fingerprint + stealth
  const injector = new FingerprintInjector();
  await injector.attachFingerprintToPlaywright(ctx, fp);

  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    // @ts-ignore
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "hardwareConcurrency", {
      get: () => 8,
    });
  });

  // 3) Start a watchdog to guarantee cleanup at HARD_TIMEOUT_MS
  // We attach the timer to the context so each call has its own guard.
  let hardTimedOut = false;
  const watchdog = setTimeout(async () => {
    try {
      hardTimedOut = true;
      // Best-effort close all pages then the context
      const pages = ctx.pages();
      await Promise.allSettled(pages.map((p) => p.close({ runBeforeUnload: false })));
      await ctx.close().catch(() => {});
    } catch {
      // ignore
    }
  }, HARD_TIMEOUT_MS);

  // 4) When the context closes normally, clear the watchdog
  // Playwright emits 'close' for BrowserContext
  ctx.on("close", () => {
    clearTimeout(watchdog);
  });

  // Optional: defensively clear timer on 'disconnected' events in case of crash
  // @ts-ignore - event exists in Browser, not always in Context
  // ctx.browser()?.on?.("disconnected", () => clearTimeout(watchdog));

  return ctx;
}