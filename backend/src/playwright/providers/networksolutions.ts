import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { newStealthContext } from "../browser.js";
import type { DCResult } from "../../types/resultSchema.js";
import type { RunOpts } from "../../types/runOptions.js";

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
    headless: opts.headless ?? true,
    locale: opts.locale || "en-US",
    timezoneId: opts.timezoneId || "America/New_York",
    proxy: opts.proxy,
  });

  const page = await ctx.newPage();

  // hard ceiling 60 s since page created
  const PAGE_HARD_MS = 60_000;
  let finalized = false; // we have produced a result and should stop
  let pageTimedOut = false;

  const pageWatchdog = setTimeout(async () => {
    pageTimedOut = true;
    try {
      await page.close({ runBeforeUnload: false }).catch(() => {});
      await ctx.close().catch(() => {});
    } catch {}
  }, PAGE_HARD_MS);

  // Abort controller to cancel pending waits as soon as we finalize
  const abortController = new AbortController();
  const { signal } = abortController;

  // cancellable selector wait helper
  async function cancellableWait<T>(
    action: () => Promise<T>,
    timeoutMs: number
  ): Promise<T | undefined> {
    return await Promise.race([
      action().catch(() => undefined),
      new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), timeoutMs)
      ),
      new Promise<undefined>((resolve) => {
        signal.addEventListener(
          "abort",
          () => resolve(undefined),
          { once: true }
        );
      }),
    ]);
  }

  // one guard promise to ensure return at 90 s even if code hangs
  const guard = new Promise<DCResult>((resolve) =>
    setTimeout(() => {
      if (!finalized) resolve({ ok: false, domain, error: "NS blocked: 90s hard timeout" });
    }, PAGE_HARD_MS)
  );

  async function scrape(): Promise<DCResult> {
    try {
      const url = `https://www.networksolutions.com/products/domain/domain-search-results?domainName=${encodeURIComponent(
        domain
      )}`;

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: Math.min(opts.timeoutMs ?? 90_000, PAGE_HARD_MS),
      });

      await sleep(700 + Math.random() * 500);

      // Early banners
      const banner = await cancellableWait(
        () =>
          page
            .locator(
              [
                ':text("NOT SUPPORTED")',
                ':text("not supported")',
                ':text("This domain extension is not supported")',
                ':text("couldn\'t find any available domains")',
                ':text("Too many requests")',
                ':text("rate limit")',
              ].join(", ")
            )
            .first()
            .isVisible(),
        8_000
      );

      if (banner) {
        const raw = ((await page.innerText("body").catch(() => "")) || "").slice(0, 900);
        finalized = true;
        abortController.abort();
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

      // Prepare locators
      const parts = domain.split(".");
      const tld = "." + parts.pop();
      const base = parts.join(".");

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

      const cartCard = page
        .locator('div:has-text("is available")')
        .filter({ hasText: domain })
        .first();

      await cancellableWait(
        () =>
          Promise.race([
            tileCard.waitFor({ timeout: 12_000 }),
            cartCard.waitFor({ timeout: 12_000 }),
            page
              .locator(
                ':text("Add to cart"), :text("ADD TO CART"), :text("is available")'
              )
              .first()
              .waitFor({ timeout: 12_000 }),
          ]),
        12_000
      );

      // Choose visible card
      let card = tileCard;
      if (!(await tileCard.isVisible().catch(() => false))) card = cartCard;

      if (!(await card.isVisible().catch(() => false))) {
        const anyCard = page
          .locator("div.split-container.search-result-section")
          .filter({ hasText: domain })
          .first();
        if (!(await anyCard.isVisible().catch(() => false))) {
          finalized = true;
          abortController.abort();
          return { ok: false, domain, error: "Result card not found or blocked" };
        }
        card = anyCard;
      }

      const cardText = (await card.innerText().catch(() => "")) || "";

      const hasTakenBadge =
        (await card.locator('.pill .label:has-text("Domain Taken")').count()) >
        0;
      const sentenceTaken = /\bis taken\b/i.test(cardText);
      const explicitUnavailable =
        /\bunavailable\b/i.test(cardText) ||
        /certified offer/i.test(cardText) ||
        /backorder/i.test(cardText);
      const taken = hasTakenBadge || sentenceTaken || explicitUnavailable;

      const classAttr = (await card.getAttribute("class")) || "";
      const isPremium =
        classAttr.includes("premium") || /(^|\s)Premium(\s|$)/i.test(cardText);

      const hasAddToCart =
        (await card.locator("a:has-text('ADD TO CART')").count()) > 0 ||
        /ADD TO CART/i.test(cardText);
      const hasRemoveFromCart =
        (await card.locator(":text('REMOVE FROM CART')").count()) > 0 ||
        /REMOVE FROM CART/i.test(cardText);

      if (taken) {
        finalized = true;
        abortController.abort();
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

      // Price extraction with small, cancellable waits
      let priceText = "";

      if (await tileCard.isVisible().catch(() => false)) {
        const bold = tileCard.locator(".status b").first();
        if (await bold.isVisible().catch(() => false)) {
          priceText = (await cancellableWait(() => bold.innerText(), 2_000)) || "";
        }
        if (!priceText) {
          const status = tileCard.locator(".status").first();
          if (await status.isVisible().catch(() => false)) {
            priceText = (await cancellableWait(() => status.innerText(), 2_000)) || "";
          }
        }
      }

      if (!priceText && (await cartCard.isVisible().catch(() => false))) {
        const sentence = (await cancellableWait(() => cartCard.innerText(), 2_000)) || "";
        const match =
          sentence.match(
            /(is\s+available\s+for[^$₹€£]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*[0-9][\d,]*\.?\d*)/i
          ) ||
          sentence.match(/(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*[0-9][\d,]*\.?\d*/);
        priceText = match ? match[0] : "";
      }

      if (!priceText) {
        const anyPrice =
          (await cancellableWait(
            () =>
              card
                .locator("strong, b, span, div")
                .filter({ hasText: /\$|USD|₹|INR|€|EUR|£|GBP/ })
                .first()
                .innerText(),
            2_000
          )) || "";
        priceText = anyPrice;
      }

      const reg = parsePrice(priceText);
      const available = hasAddToCart || hasRemoveFromCart;

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

      finalized = true;
      abortController.abort();
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
      finalized = true;
      abortController.abort();
      return { ok: false, domain, error: e?.message || "Navigation failed" };
    } finally {
      clearTimeout(pageWatchdog);
      // If page already timed out, we already closed resources in watchdog
      if (!pageTimedOut) {
        await page.close().catch(() => {});
        await ctx.close().catch(() => {});
      }
      if (opts.ephemeralProfile !== false) {
        await fs.remove(profileDir).catch(() => {});
      }
    }
  }

  // Ensure we never outlive 90s
  return await Promise.race([scrape(), guard]);
}