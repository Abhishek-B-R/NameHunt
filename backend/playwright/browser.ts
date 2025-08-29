import { chromium } from "playwright-extra";
import { type BrowserContext } from "playwright";
import StealthPlugin from "playwright-extra-plugin-stealth";
import { FingerprintGenerator } from "fingerprint-generator";
import { FingerprintInjector } from "fingerprint-injector";

chromium.use(StealthPlugin());

export type BrowserOpts = {
  proxyUrl?: string;
  profileDir?: string;
  locale?: string;
  timezoneId?: string;
  headless?: boolean;
};

export async function newStealthContext(
  opts: BrowserOpts = {}
): Promise<BrowserContext> {
  const ctx = await chromium.launchPersistentContext(
    opts.profileDir || "./profiles/godaddy",
    {
      headless: opts.headless ?? false,
      proxy: opts.proxyUrl ? { server: opts.proxyUrl } : undefined,
      viewport: { width: 1366, height: 800 },
      locale: opts.locale || "en-US",
      timezoneId: opts.timezoneId || "America/New_York",
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    }
  );

  const fg = new FingerprintGenerator({
    devices: ["desktop"],
    operatingSystems: ["windows", "macos"],
    browsers: [{ name: "chrome", minVersion: 120 }],
  });
  const fp = fg.getFingerprint();
  const injector = new FingerprintInjector();
  await injector.attachFingerprintToPlaywright(ctx, fp);

  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  return ctx;
}