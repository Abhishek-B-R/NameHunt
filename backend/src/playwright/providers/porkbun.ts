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

export async function checkDomainPorkbun(
  domain: string,
  opts: RunOpts = {}
): Promise<DCResult> {
  const profileDir =
    opts.ephemeralProfile === false
      ? path.join(opts.profileBaseDir || "./profiles", "porkbun")
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
    // Directly open Porkbun search page for the requested domain
    const q = encodeURIComponent(domain);
    await page.goto(`https://porkbun.com/checkout/search?q=${q}`, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 90000,
    });

    // The exact-match row is tagged availableDomainRow / unavailableDomainRow once
    // the lookup resolves, and its wrapper carries data-price / data-renewal-price.
    const exactRow = page.locator(
      "#searchResultsSectionContainer_exact .searchResultRow.availableDomainRow, " +
        "#searchResultsSectionContainer_exact .searchResultRow.unavailableDomainRow",
    );
    await exactRow.first().waitFor({ timeout: 20_000 }).catch(() => {});

    const info = await page.evaluate(() => {
      const row = document.querySelector(
        "#searchResultsSectionContainer_exact .searchResultRow",
      );
      const wrap = row?.parentElement;
      return row
        ? {
            available: row.classList.contains("availableDomainRow"),
            unavailable: row.classList.contains("unavailableDomainRow"),
            domain: row.querySelector(".searchResultRowDomain")?.textContent?.trim() || "",
            price: wrap?.getAttribute("data-price"),
            renewal: wrap?.getAttribute("data-renewal-price"),
            text: (row as HTMLElement).innerText || "",
          }
        : null;
    });

    await ctx.close();
    if (opts.ephemeralProfile !== false) {
      await fs.remove(profileDir).catch(() => {});
    }

    if (!info || info.domain.toLowerCase() !== domain.toLowerCase()) {
      return { ok: false, domain, error: "Exact-match result not found" };
    }

    if (info.unavailable) {
      return {
        ok: true,
        domain,
        available: false,
        rawText: info.text.slice(0, 900),
      };
    }

    if (!info.available) {
      return {
        ok: false,
        domain,
        error: "Porkbun did not finish the lookup",
        rawText: info.text.slice(0, 900),
      };
    }

    const num = (v?: string | null) => {
      const n = v == null ? NaN : parseFloat(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const textPrice = parsePrice(info.text);

    return {
      ok: true,
      domain,
      available: true,
      isPremium: /premium/i.test(info.text),
      registrationPrice: num(info.price) ?? textPrice.amount,
      renewalPrice: num(info.renewal),
      currency: "USD",
      rawText: info.text.slice(0, 900),
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