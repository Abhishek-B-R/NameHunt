import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
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
  return path.join(base, `dc_${id}`);
}

function parsePrice(text: string) {
  const m =
    text.match(/(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([0-9][\d,]*\.?\d*)/) ||
    text.match(/([0-9][\d,]*\.?\d*)\s*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)/);
  if (!m) return { amount: undefined, currency: undefined };
  const sym = (m[1] || m[2] || "").toUpperCase();
  const num = (m[2] || m[1] || "").replace(/[^\d.]/g, "");
  const amount = parseFloat(num);
  let currency: string | undefined;
  if (sym.includes("₹") || sym.includes("INR") || sym.includes("RS"))
    currency = "INR";
  else if (sym.includes("$") || sym.includes("USD")) currency = "USD";
  else if (sym.includes("€") || sym.includes("EUR")) currency = "EUR";
  else if (sym.includes("£") || sym.includes("GBP")) currency = "GBP";
  return { amount, currency };
}

export async function checkNetworkSolutions(
  domain: string,
  opts: RunOpts = {}
): Promise<DCResult> {
  const profileDir =
    opts.ephemeralProfile === false
      ? path.join(opts.profileBaseDir || "./profiles", "domaincom")
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
    const url = `https://www.networksolutions.com/products/domain/domain-search-results?domainName=${encodeURIComponent(
      domain
    )}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 60000,
    });

    // small human-ish pause
    await sleep(900 + Math.random() * 600);

    // Fast path: detect "Not supported" banners and return early
    const notSupportedVisible =
      (await page
        .locator(
          [
            ':text("NOT SUPPORTED")',
            ':text("not supported")',
            ':text("This domain extension is not supported")',
            ':text("couldn\'t find any available domains")',
          ].join(", ")
        )
        .first()
        .isVisible()
        .catch(() => false)) || false;

    if (notSupportedVisible) {
      const raw = ((await page.innerText("body").catch(() => "")) || "").slice(
        0,
        900
      );
      await ctx.close();
      if (opts.ephemeralProfile !== false) {
        await fs.remove(profileDir).catch(() => {});
      }
      return {
        ok: true,
        domain,
        available: undefined,
        isPremium: undefined,
        registrationPrice: undefined,
        renewalPrice: undefined,
        currency: "USD",
        rawText: raw,
      };
    }

    // Split domain to match exact card in tile UI
    const parts = domain.split(".");
    const tld = "." + parts.pop();
    const base = parts.join(".");

    // A) Tile UI with domain-base and domain-tld split
    const tileCard = page
      .locator(
        "div.split-container.search-result-section:has(.domain-name-container)"
      )
      .filter({
        has: page
          .locator(".domain-name-container")
          .filter({ has: page.locator(`.domain-base:has-text("${base}")`) })
          .filter({ has: page.locator(`.domain-tld:has-text("${tld}")`) }),
      })
      .first();

    // B) Cart-style UI: exact domain text plus “is available for …”
    const cartCard = page
      .locator('div:has-text("is available")')
      .filter({ hasText: domain })
      .first();

    // Wait for either card type or a general results container
    await Promise.race([
      tileCard.waitFor({ timeout: 3000 }).catch(() => {}),
      cartCard.waitFor({ timeout: 3000 }).catch(() => {}),
      page
        .locator(
          ':text("Add to cart"), :text("ADD TO CART"), :text("is available")'
        )
        .first()
        .waitFor({ timeout: 3000 })
        .catch(() => {}),
    ]);

    // Choose whichever is actually visible
    let card = tileCard;
    if (!(await tileCard.isVisible().catch(() => false))) {
      card = cartCard;
    }
    if (!(await card.isVisible().catch(() => false))) {
      // As a final fallback, try any split-container that includes the domain text
      const anyCard = page
        .locator("div.split-container.search-result-section")
        .filter({ hasText: domain })
        .first();
      if (await anyCard.isVisible().catch(() => false)) {
        card = anyCard;
      } else {
        return { ok: false, domain, error: "Result card not found" };
      }
    }

    const cardText = (await card.innerText().catch(() => "")) || "";

    // Taken detection across UIs
    const hasTakenBadge =
      (await card.locator('.pill .label:has-text("Domain Taken")').count()) > 0;
    const sentenceTaken = /\bis taken\b/i.test(cardText);
    const explicitUnavailable =
      /\bunavailable\b/i.test(cardText) ||
      /certified offer/i.test(cardText) ||
      /backorder/i.test(cardText);
    const taken = hasTakenBadge || sentenceTaken || explicitUnavailable;

    // Premium detection
    const classAttr = (await card.getAttribute("class")) || "";
    const isPremium =
      classAttr.includes("premium") || /(^|\s)Premium(\s|$)/i.test(cardText);

    // CTA detection
    const hasAddToCart =
      (await card.locator("a:has-text('ADD TO CART')").count()) > 0 ||
      /ADD TO CART/i.test(cardText);
    const hasRemoveFromCart =
      (await card.locator(":text('REMOVE FROM CART')").count()) > 0 ||
      /REMOVE FROM CART/i.test(cardText);

    // If taken, return immediately with no price wait
    if (taken) {
      await ctx.close();
      if (opts.ephemeralProfile !== false) {
        await fs.remove(profileDir).catch(() => {});
      }
      return {
        ok: true,
        domain,
        available: false,
        isPremium: isPremium || undefined,
        registrationPrice: undefined,
        renewalPrice: undefined,
        currency: "USD",
        rawText: cardText.slice(0, 900),
      };
    }

    // Otherwise read price from the exact card
    let priceText = "";

    // Tile UI: price in .status b or .status
    if (await tileCard.isVisible().catch(() => false)) {
      const bold = tileCard.locator(".status b").first();
      if (await bold.isVisible().catch(() => false)) {
        priceText = (await bold.innerText().catch(() => "")) || "";
      }
      if (!priceText) {
        const status = tileCard.locator(".status").first();
        if (await status.isVisible().catch(() => false)) {
          priceText = (await status.innerText().catch(() => "")) || "";
        }
      }
    }

    // Cart UI: “is available for $X …” sentence
    if (!priceText && (await cartCard.isVisible().catch(() => false))) {
      const sentence = (await cartCard.innerText().catch(() => "")) || "";
      const match =
        sentence.match(
          /(is\s+available\s+for[^$₹€£]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*[0-9][\d,]*\.?\d*)/i
        ) ||
        sentence.match(/(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*[0-9][\d,]*\.?\d*/);
      priceText = match ? match[0] : "";
    }

    // Last resort: any currency-looking node inside this card
    if (!priceText) {
      const anyPrice =
        (await card
          .locator("strong, b, span, div")
          .filter({ hasText: /\$|USD|₹|INR|€|EUR|£|GBP/ })
          .first()
          .innerText()
          .catch(() => "")) || "";
      priceText = anyPrice;
    }

    const reg = parsePrice(priceText);
    const available = hasAddToCart || hasRemoveFromCart;

    // Optional renewal detection in card text
    const renewMatch =
      cardText.match(
        /renews?\s+at[^0-9]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,\.]+)/i
      ) ||
      cardText.match(
        /renewal[^0-9]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,\.]+)/i
      );
    const renewalPrice = renewMatch
      ? parseFloat((renewMatch[2] || "").replace(/[^\d.]/g, ""))
      : undefined;

    await ctx.close();
    if (opts.ephemeralProfile !== false) {
      await fs.remove(profileDir).catch(() => {});
    }

    return {
      ok: true,
      domain,
      available,
      isPremium: isPremium || (reg.amount ? reg.amount > 100 : undefined),
      registrationPrice: reg.amount,
      renewalPrice,
      currency: reg.currency || "USD",
      rawText: cardText.slice(0, 900),
    };
  } catch (e: any) {
    try {
      await ctx.close();
    } catch {}
    if (opts.ephemeralProfile !== false) {
      await fs.remove(profileDir).catch(() => {});
    }
    return { ok: false, domain, error: e?.message || "Navigation failed" };
  }
}
