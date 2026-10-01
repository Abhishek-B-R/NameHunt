import { chromium, type BrowserContext } from "playwright";
import { FingerprintGenerator } from "fingerprint-generator";
import { FingerprintInjector } from "fingerprint-injector";
import type { ProxyOpts, StealthOpts } from "../types/browserTypes.js";

const HARD_TIMEOUT_MS = Number(process.env.HARD_TIMEOUT_MS || 200_000);

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Launches a persistent Playwright context using the bundled Chromium.
 * Stealth + fingerprinting applied. A watchdog force-closes it at HARD_TIMEOUT_MS.
 */
export async function newStealthContext(
  opts: StealthOpts
): Promise<BrowserContext> {
  const width = randInt(1280, 1680);
  const height = randInt(720, 1000);

  // Generate a realistic Chrome UA/fingerprint but we’ll run on Chromium
  const fg = new FingerprintGenerator({
    devices: ["desktop"],
    operatingSystems: ["windows", "macos"],
    browsers: [{ name: "chrome", minVersion: 120 }],
  });
  const fp = fg.getFingerprint();
  const userAgent = opts.userAgent || fp.headers["user-agent"];

  // Use Chromium bundled with the Playwright image.
  // If you ever want real Google Chrome, set PLAYWRIGHT_CHANNEL=chrome
  // and ensure your Dockerfile installs google-chrome-stable.
  const channel = process.env.PLAYWRIGHT_CHANNEL || undefined; // usually undefined

  const launchOpts: any = {
    // channel only if explicitly set; otherwise bundled Chromium
    ...(channel ? { channel } : {}),
    headless: opts.headless ?? true,
    proxy: (opts.proxy as ProxyOpts | undefined) || undefined,
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

  const ctx = await chromium.launchPersistentContext(
    opts.profileDir,
    launchOpts
  );

  // Apply fingerprint + stealth
  const injector = new FingerprintInjector();
  await injector.attachFingerprintToPlaywright(ctx, fp);

  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    // @ts-ignore
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
  });

  // Watchdog to force-close after HARD_TIMEOUT_MS
  const watchdog = setTimeout(async () => {
    try {
      const pages = ctx.pages();
      await Promise.allSettled(
        pages.map((p) => p.close({ runBeforeUnload: false }))
      );
      await ctx.close().catch(() => {});
    } catch {
      // ignore
    }
  }, HARD_TIMEOUT_MS);

  ctx.on("close", () => clearTimeout(watchdog));

  return ctx;
}