import { chromium, type BrowserContext } from "playwright";
import { FingerprintGenerator } from "fingerprint-generator";
import { FingerprintInjector } from "fingerprint-injector";

export type ProxyOpts = { server: string; username?: string; password?: string };
export type StealthOpts = {
  profileDir: string;
  headless?: boolean;
  locale?: string;
  timezoneId?: string;
  proxy?: ProxyOpts;
  userAgent?: string;
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function newStealthContext(
  opts: StealthOpts
): Promise<BrowserContext> {
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
    proxy: opts.proxy,
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

  return ctx;
}