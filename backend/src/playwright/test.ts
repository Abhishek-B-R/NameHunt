import { chromium } from "playwright";
import { FingerprintGenerator } from "fingerprint-generator";
import { FingerprintInjector } from "fingerprint-injector";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  // Generate fingerprint
  const fg = new FingerprintGenerator();
  const fp = fg.getFingerprint();
  const injector = new FingerprintInjector();
  await injector.attachFingerprintToPlaywright(context, fp);

  const page = await context.newPage();

  // Hide webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  await page.goto("https://httpbin.org/headers");
  console.log(await page.textContent("pre"));

  await browser.close();
})();