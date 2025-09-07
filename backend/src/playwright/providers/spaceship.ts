// src/playwright/spaceship.ts
import fs from "fs-extra";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { newStealthContext } from "../browser.js";

export type DCResult = {
  ok: boolean;
  domain: string;
  available?: boolean;
  isPremium?: boolean;
  registrationPrice?: number;
  renewalPrice?: number;
  currency?: string;
  error?: string;
  rawText?: string;
};

type RunOpts = {
  proxy?: { server: string; username?: string; password?: string };
  headless?: boolean;
  locale?: string;
  timezoneId?: string;
  ephemeralProfile?: boolean;
  profileBaseDir?: string;
  timeoutMs?: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function freshProfileDir(base = "/tmp") {
  const id = crypto.randomBytes(6).toString("hex");
  return path.join(base, `spaceship_${id}`);
}

function parsePrice(text: string) {
  const m =
    text.match(/(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([0-9][\d,.\u00A0\s]*\d)/) ||
    text.match(/([0-9][\d,.\u00A0\s]*\d)\s*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)/);
  if (!m) return { amount: undefined as number | undefined, currency: undefined as string | undefined };

  const sym = ((m[1] || m[2] || "") + "").toUpperCase();
  const rawNum = (m[2] || m[1] || "") + "";
  const cleaned = rawNum
    .replace(/\u00A0/g, " ")
    .replace(/(?<=\d)[ ,](?=\d{3}\b)/g, "")
    .replace(/,(?=\d{2}\b)/, ".")
    .replace(/[^\d.]/g, "");
  const amount = parseFloat(cleaned);

  let currency: string | undefined;
  if (sym.includes("₹") || sym.includes("INR") || sym.includes("RS")) currency = "INR";
  else if (sym.includes("$") || sym.includes("USD")) currency = "USD";
  else if (sym.includes("€") || sym.includes("EUR")) currency = "EUR";
  else if (sym.includes("£") || sym.includes("GBP")) currency = "GBP";

  return { amount: Number.isFinite(amount) ? amount : undefined, currency };
}

export async function checkDomainSpaceship(
  domain: string,
  opts: RunOpts = {}
): Promise<DCResult> {
  const profileDir =
    opts.ephemeralProfile === false
      ? path.join(opts.profileBaseDir || "./profiles", "spaceship")
      : freshProfileDir(opts.profileBaseDir || "/tmp");

  await fs.ensureDir(profileDir);

  const ctx = await newStealthContext({
    profileDir,
    headless: opts.headless ?? false,
    locale: opts.locale || "en-US",
    timezoneId: opts.timezoneId || "America/New_York",
    proxy: opts.proxy,
  });

  const page = await ctx.newPage();

  try {
    const url = `https://www.spaceship.com/domain-search/?query=${encodeURIComponent(
      domain
    )}&beast=false&tab=domains`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 60000,
    });

    await sleep(700);
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    // Click Search if present
    try {
      const searchBtn = page.locator('button:has-text("Search")').first();
      if (await searchBtn.isVisible().catch(() => false)) {
        await searchBtn.click().catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      }
    } catch {}

    // Containers
    const fullContainer = page.locator(".main-result__full__container").first();
    const availableContainer = page.locator(".main-result__available__container").first();
    const unavailableContainer = page.locator(".main-result__unavailable__container").first();
    const pricesContainer = page
      .locator(".main-result__available__prices__container")
      .first();

    await Promise.race([
      availableContainer.waitFor({ timeout: 8000 }).catch(() => {}),
      unavailableContainer.waitFor({ timeout: 8000 }).catch(() => {}),
      fullContainer.waitFor({ timeout: 8000 }).catch(() => {}),
    ]);

    const containerText =
      ((await fullContainer.innerText().catch(() => "")) ||
        (await availableContainer.innerText().catch(() => "")) ||
        (await unavailableContainer.innerText().catch(() => "")) ||
        "") + "";

    const isUnavailable =
      (await unavailableContainer.count()) > 0 ||
      /taken/i.test(containerText) ||
      /unavailable/i.test(containerText);

    if (isUnavailable) {
      await ctx.close().catch(() => {});
      if (opts.ephemeralProfile !== false) await fs.remove(profileDir).catch(() => {});
      return {
        ok: true,
        domain,
        available: false,
        isPremium: undefined,
        rawText: containerText.slice(0, 900),
      };
    }

    const isAvailable =
      (await availableContainer.count()) > 0 || (await pricesContainer.count()) > 0;

    // Premium badge
    const premiumTag =
      (await page
        .locator(".main-result__available__content__tag .gb-tag__text")
        .filter({ hasText: "Premium" })
        .count()) > 0 || /premium/i.test(containerText);

    const purchaseSel =
      ".main-result__available__prices__container .main-result__available__prices__text__purchase";
    const renewalSel =
      ".main-result__available__prices__container .main-result__available__prices__text__renewal__line";

    if (isAvailable) {
      await pricesContainer.waitFor({ timeout: 6000 }).catch(() => {});
    }

    let registrationPrice: number | undefined;
    let renewalPrice: number | undefined;
    let currency: string | undefined;

    // Wait for nonzero prices up to ~6 seconds
    const maxTries = 20;
    for (let i = 0; i < maxTries; i++) {
      const purchaseNode = page.locator(purchaseSel).first();
      const renewalNode = page.locator(renewalSel).first();

      if ((await purchaseNode.count()) > 0) {
        const t = (await purchaseNode.textContent().catch(() => "")) || "";
        const p = parsePrice(t);
        if (p.amount !== undefined && p.amount > 0) {
          registrationPrice = p.amount;
          currency = currency || p.currency;
        }
      }

      if ((await renewalNode.count()) > 0) {
        const t = (await renewalNode.textContent().catch(() => "")) || "";
        const p = parsePrice(t);
        if (p.amount !== undefined && p.amount > 0) {
          renewalPrice = p.amount;
          currency = currency || p.currency;
        }
      }

      // stop early if we have a nonzero registration or renewal
      if ((registrationPrice && registrationPrice > 0) || (renewalPrice && renewalPrice > 0)) {
        break;
      }

      await sleep(300);
    }

    // Fallback: parse from prices container text, and ignore zero values
    if (
      (registrationPrice === undefined || renewalPrice === undefined || currency === undefined) &&
      (await pricesContainer.count()) > 0
    ) {
      const pricesText = (await pricesContainer.innerText().catch(() => "")) || "";
      const hits =
        pricesText.match(
          /(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*[0-9][\d,.\u00A0\s]*\d/g
        ) || [];

      const parsed = hits
        .map((t) => parsePrice(t))
        .filter((p) => p.amount !== undefined && p.amount > 0) as {
        amount: number;
        currency?: string;
      }[];

      if (parsed.length) {
        const amounts = parsed.map((p) => p.amount);
        const max = Math.max(...amounts);
        const min = Math.min(...amounts);
        if (renewalPrice === undefined) renewalPrice = max;
        if (registrationPrice === undefined) registrationPrice = min;
        currency = currency || parsed[0]?.currency || currency;
      }
    }

    const available =
      !isUnavailable &&
      (isAvailable || (registrationPrice !== undefined && registrationPrice > 0));

    const isPremium =
      premiumTag ||
      (registrationPrice !== undefined && registrationPrice > 50) ||
      undefined;

    await ctx.close().catch(() => {});
    if (opts.ephemeralProfile !== false) await fs.remove(profileDir).catch(() => {});

    return {
      ok: true,
      domain,
      available,
      isPremium,
      registrationPrice,
      renewalPrice,
      currency: currency || "USD",
      rawText: containerText.slice(0, 900),
    };
  } catch (e: any) {
    try {
      await ctx.close();
    } catch {}
    if (opts.ephemeralProfile !== false) await fs.remove(profileDir).catch(() => {});
    return { ok: false, domain, error: e?.message || "Navigation failed" };
  }
}