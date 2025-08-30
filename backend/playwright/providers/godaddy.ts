import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { newStealthContext } from "../browser";

export type CheckResult = {
  ok: boolean;
  domain: string;
  available?: boolean;
  isPremium?: boolean;
  registrationPrice?: number;
  renewalPrice?: number;
  currency?: string;
  error?: string;
  rawText?: string;
  via?: string;
};

type RunOpts = {
  proxy?: { server: string; username?: string; password?: string };
  headless?: boolean;
  locale?: string;
  timezoneId?: string;
  // If true, ephemerally creates a temp profile and deletes it
  ephemeralProfile?: boolean;
  profileBaseDir?: string; // default: /tmp
};

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function freshProfileDir(base = "/tmp") {
  const id = crypto.randomBytes(6).toString("hex");
  return path.join(base, `gd_${id}`);
}

function extractFirstPrice(text: string) {
  const m =
    text.match(/(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([0-9][\d,]*\.?\d*)/) ||
    text.match(/([0-9][\d,]*\.?\d*)\s*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)/);
  if (!m) return { amount: undefined, currency: undefined };
  const sym = (m[1] || m[2] || "").toUpperCase();
  const num = (m[2] || m[1] || "").replace(/[^\d.]/g, "");
  const amount = parseFloat(num);
  let currency: string | undefined;
  if (sym.includes("₹") || sym.includes("INR") || sym.includes("RS")) currency = "INR";
  else if (sym.includes("$") || sym.includes("USD")) currency = "USD";
  else if (sym.includes("€") || sym.includes("EUR")) currency = "EUR";
  else if (sym.includes("£") || sym.includes("GBP")) currency = "GBP";
  return { amount, currency };
}

function extractRenewal(text: string) {
  const m =
    text.match(/renews?\s+at[^0-9]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,\.]+)/i) ||
    text.match(/renewal[^0-9]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,\.]+)/i);
  if (!m) return { amount: undefined };
  return { amount: parseFloat(m[2].replace(/[^\d.]/g, "")) };
}

export async function checkGoDaddyDirect(
  domain: string,
  runOpts: RunOpts = {}
): Promise<CheckResult> {
  const profileDir = runOpts.ephemeralProfile !== false
    ? freshProfileDir(runOpts.profileBaseDir || "/tmp")
    : path.join(runOpts.profileBaseDir || "./profiles", "godaddy");

  await fs.ensureDir(profileDir);

  const ctx = await newStealthContext({
    profileDir,
    headless: runOpts.headless ?? false,
    locale: runOpts.locale || "en-US",
    timezoneId: runOpts.timezoneId || "America/New_York",
    proxy: runOpts.proxy,
  });

  const page = await ctx.newPage();

  try {
    // Go directly to the search page as requested.
    const searchUrl =
      "https://www.godaddy.com/en-in/domainsearch/find?domainToCheck=" +
      encodeURIComponent(domain);

    // Use referer to look like internal navigation
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
      referer: "https://www.godaddy.com/",
    });

    // Tiny human-like behavior to let any JS sensors run
    await sleep(1000 + Math.random() * 1500);
    await page.mouse.move(200 + Math.random() * 300, 300, { steps: 8 });
    await page.mouse.wheel(0, 400);
    await sleep(600 + Math.random() * 900);

    // Accept cookies if present
    const cookieBtn = page.locator('button:has-text("Accept")');
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click().catch(() => {});
    }

    // Wait for any of the key words to appear
    await page.waitForFunction(
      (d) => {
        const t = document.body?.innerText?.toLowerCase() || "";
        return (
          t.includes(d.toLowerCase()) &&
          (t.includes("available") ||
            t.includes("unavailable") ||
            t.includes("taken") ||
            t.includes("already registered") ||
            t.includes("premium"))
        );
      },
      domain,
      { timeout: 45000 }
    );

    const text = (await page.innerText("body")).trim();

    // Determine availability
    const isUnavailable = /isn'?t available|unavailable|taken|already registered/i.test(text);
    const isAvailable = /is available/i.test(text) && !isUnavailable;
    const isPremium = /premium/i.test(text);

    const price = extractFirstPrice(text);
    const renew = extractRenewal(text);

    return {
      ok: true,
      domain,
      available: isAvailable,
      isPremium,
      registrationPrice: price.amount,
      renewalPrice: renew.amount,
      currency: price.currency || "USD",
      rawText: text.slice(0, 900),
    };
  } catch (e: any) {
    return {
      ok: false,
      domain,
      error: e?.message?.slice(0, 300) || "Navigation or extraction failed",
    };
  } finally {
    await ctx.close();
    if (runOpts.ephemeralProfile !== false) {
      await fs.remove(profileDir).catch(() => {});
    }
  }
}