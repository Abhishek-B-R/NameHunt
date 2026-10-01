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

function extractDomainSection(fullText: string, domain: string): string {
  const lines = fullText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  const domainIndex = lines.findIndex((line) => line === domain);
  if (domainIndex === -1) return "";

  // Extract the domain line and the next several lines that belong to it
  let section = [lines[domainIndex]];
  let i = domainIndex + 1;

  // Continue adding lines until we hit another domain name
  while (i < lines.length) {
    const line = lines[i];
    // Stop if we hit another domain (contains a dot and looks like a domain)
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(line || "") && line !== domain) {
      break;
    }
    section.push(line);
    i++;
    // Limit to reasonable number of lines
    if (section.length > 15) break;
  }

  return section.join("\n");
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

    // Give time for dynamic rendering similar to old behavior
    await Promise.race([
      page.waitForSelector('[class*="result"]', { timeout: 12000 }),
      page.waitForSelector(".domain-result", { timeout: 12000 }),
      page.waitForSelector('[data-testid*="result"]', { timeout: 12000 }),
      page.waitForSelector(':has-text("available")', { timeout: 12000 }),
      page.waitForSelector(':has-text("registered")', { timeout: 12000 }),
      page.waitForSelector(':has-text("Inquire")', { timeout: 12000 }),
      sleep(12000),
    ]);

    // Additional wait for dynamic content
    await sleep(3000);

    const bodyText = await page.textContent("body").catch(() => "");

    // Check if domain appears in results
    if (!(bodyText || "").toLowerCase().includes(domain.toLowerCase())) {
      await ctx.close();
      if (opts.ephemeralProfile !== false) {
        await fs.remove(profileDir).catch(() => {});
      }
      return {
        ok: false,
        domain,
        error: "Domain not found in search results",
        rawText: (bodyText || "").slice(0, 900),
      };
    }

    // Extract only the section related to our specific domain
    const domainSection = extractDomainSection(bodyText || "", domain);

    if (!domainSection) {
      await ctx.close();
      if (opts.ephemeralProfile !== false) {
        await fs.remove(profileDir).catch(() => {});
      }
      return {
        ok: false,
        domain,
        error: "Could not isolate domain section from results",
        rawText: (bodyText || "").slice(0, 900),
      };
    }

    // Check for unavailable indicators specifically in domain section
    const unavailableIndicators = [
      /registered/i.test(domainSection) && !/year/i.test(domainSection),
      /inquire/i.test(domainSection) && !domainSection.includes("$"),
      /taken/i.test(domainSection),
      /unavailable/i.test(domainSection),
      /not\s*available/i.test(domainSection),
    ];

    const isUnavailable = unavailableIndicators.some(Boolean);

    // If domain is unavailable, return immediately
    if (isUnavailable) {
      await ctx.close();
      if (opts.ephemeralProfile !== false) {
        await fs.remove(profileDir).catch(() => {});
      }

      return {
        ok: true,
        domain,
        available: false,
        isPremium: /premium/i.test(domainSection) || undefined,
        registrationPrice: undefined,
        renewalPrice: undefined,
        currency: undefined,
        rawText: domainSection.slice(0, 900),
      };
    }

    // Extract pricing information from domain section
    const reg = parsePrice(domainSection);

    // Check if domain is available (has pricing)
    const available = reg.amount !== undefined;

    // Premium detection
    const isPremium = /premium/i.test(domainSection);

    // Extract renewal price from domain section
    const renewMatch = domainSection.match(
      /renews?\s+at[^$€£₹]*(\$|€|£|₹)\s*([0-9][\d,]*\.?\d*)/i
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
      isPremium: isPremium || undefined,
      registrationPrice: reg.amount,
      renewalPrice,
      currency: reg.currency || "USD",
      rawText: domainSection.slice(0, 900),
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