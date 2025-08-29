import { chromium, BrowserContext } from "playwright";
import { FingerprintGenerator } from "fingerprint-generator";
import { FingerprintInjector } from "fingerprint-injector";

export async function newStealthContext(p0: { profileDir: string; headless: boolean; locale: string; timezoneId: string; proxy: { server: string; }; }): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext("./profiles/godaddy", {
    headless: false,
    proxy: {
      server: "http://gate.decodo.com:10004", // pick any port from your dashboard
      username: "sp9h0i91ik",                 // your Decodo username
      password: "a8Vgu17GhINbnl_k9w",                // your Decodo password
    },
    viewport: { width: 1366, height: 768 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  // Fingerprint injection
  const fg = new FingerprintGenerator({
    devices: ["desktop"],
    operatingSystems: ["windows", "macos"],
    browsers: [{ name: "chrome", minVersion: 120 }],
  });
  const fp = fg.getFingerprint();
  const injector = new FingerprintInjector();
  await injector.attachFingerprintToPlaywright(context, fp);

  // Hide webdriver
  await context.addInitScript(() => {
    // webdriver
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });

    // plugins
    Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3],
    });

    // languages
    Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
    });

    // hardwareConcurrency
    Object.defineProperty(navigator, "hardwareConcurrency", {
        get: () => [4, 6, 8][Math.floor(Math.random() * 3)],
    });

    // chrome.runtime
    (window as any).chrome = { runtime: {} };
    });

  return context;
}

// Test proxy
// (async () => {
//   const ctx = await newStealthContext();
//   const page = await ctx.newPage();
//   await page.goto("https://ipv4.icanhazip.com", { waitUntil: "domcontentloaded" });
//   console.log("Proxy IP:", (await page.textContent("body"))?.trim());
//   await ctx.close();
// })();