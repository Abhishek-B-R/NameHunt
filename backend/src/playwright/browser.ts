import { spawn, type ChildProcess } from "node:child_process";
import fs from "fs-extra";
import path from "node:path";
import crypto from "node:crypto";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { FingerprintGenerator } from "fingerprint-generator";
import { FingerprintInjector } from "fingerprint-injector";
import type { ProxyOpts, StealthOpts } from "../types/browserTypes.js";

const HARD_TIMEOUT_MS = Number(process.env.HARD_TIMEOUT_MS || 200_000);

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Launches a persistent Playwright context using the bundled Chromium.
 * Stealth + fingerprinting applied. A watchdog force-closes it at HARD_TIMEOUT_MS.
 */
export async function newStealthContext(
  opts: StealthOpts,
): Promise<BrowserContext> {
  const width = randInt(1280, 1680);
  const height = randInt(720, 1000);

  // Generate a realistic Chrome UA/fingerprint but we’ll run on Chromium
  const fg = new FingerprintGenerator({
    devices: ["desktop"],
    operatingSystems: ["windows", "linux", "macos"],
    browsers: [{ name: "chrome", minVersion: 120 }],
  });
  const fp = fg.getFingerprint();
  const userAgent = opts.userAgent || fp.headers["user-agent"];

  // Use Chromium bundled with the Playwright image.
  // If you ever want real Google Chrome, set PLAYWRIGHT_CHANNEL=chrome
  // and ensure your Dockerfile installs google-chrome-stable.
  const channel = process.env.PLAYWRIGHT_CHANNEL || undefined; // usually undefined

  const launchOpts: any = {
    // channel only if explicitly set; otherwise bundled Chromium
    ...(channel ? { channel } : {}),
    headless: opts.headless ?? true,
    proxy: (opts.proxy as ProxyOpts | undefined) || undefined,
    viewport: { width, height },
    locale: opts.locale || "en-US",
    timezoneId: opts.timezoneId || "America/New_York",
    userAgent,
    args: [
      "--disable-blink-features=AutomationControlled", // remove automationcontrolled flag
      "--disable-dev-shm-usage", // prevents chrome from crashing in docker containers
      "--no-sandbox",
      `--window-size=${width},${height}`,
    ],
  };

  const ctx = await chromium.launchPersistentContext(
    opts.profileDir,
    launchOpts,
  );

  // Apply fingerprint + stealth
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
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
  });

  // Watchdog to force-close after HARD_TIMEOUT_MS
  const watchdog = setTimeout(async () => {
    try {
      const pages = ctx.pages();
      await Promise.allSettled(
        pages.map((p) => p.close({ runBeforeUnload: false })),
      );
      await ctx.close().catch(() => {});
    } catch {
      // ignore
    }
  }, HARD_TIMEOUT_MS);

  ctx.on("close", () => clearTimeout(watchdog));

  return ctx;
}

// Cloudflare injects challenge-platform scripts into normal pages too,
// so only trust the interstitial's title / visible copy.
const CF_TITLE = /just a moment|attention required|cloudflare/i;
const CF_TEXT = /security check to access|verify you are human|checking your browser/i;
const AKAMAI_MARKERS = /errors\.edgesuite\.net|<title>access denied/i;

/**
 * Detects Cloudflare / Akamai bot walls. Cloudflare's JS challenge sometimes
 * clears by itself, so we give it `graceMs` before reporting the page as blocked.
 * Returns a short reason when blocked, otherwise null.
 */
export async function detectBotWall(
  page: Page,
  graceMs = 8_000,
): Promise<string | null> {
  const deadline = Date.now() + graceMs;
  for (;;) {
    const html = await page.content().catch(() => "");
    const title = await page.title().catch(() => "");
    const akamai = AKAMAI_MARKERS.test(html);
    const text = await page
      .evaluate(() => document.body?.innerText.slice(0, 500) || "")
      .catch(() => "");
    const cloudflare = CF_TITLE.test(title) || CF_TEXT.test(text);

    // A real page with a title and no wall markers: good to go
    if (!akamai && !cloudflare && title) return null;
    // Akamai denials are final, no point waiting
    if (akamai) return "Blocked by the registrar's bot protection (Akamai)";
    if (Date.now() >= deadline) {
      return cloudflare
        ? "Blocked by the registrar's bot protection (Cloudflare)"
        : null;
    }
    await page.waitForTimeout(1_000);
  }
}

/* ------------------------------------------------------------------ */
/* Real Chrome over CDP                                                */
/* ------------------------------------------------------------------ */
// Akamai (GoDaddy) and Cloudflare (Network Solutions, Namecheap, Spaceship) flag
// browsers that Playwright launches, even with stealth patches. They let through
// a normal, headful Google Chrome that we start ourselves and only attach to via
// the DevTools protocol. Ported from github.com/Abhishek-B-R/akamai-bot-detection-prevention.
// Headless Chrome is still blocked, so on Linux servers this needs a display (Xvfb).

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/opt/google/chrome/chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
].filter(Boolean) as string[];

const REAL_CHROME_PORT = Number(process.env.REAL_CHROME_PORT || 9222);
const REAL_CHROME_PROFILE =
  process.env.REAL_CHROME_PROFILE_DIR || "/tmp/namehunt-real-chrome";

let chromePath: string | null | undefined;
let realChrome: Promise<Browser> | null = null;
let chromeProc: ChildProcess | null = null;

function findChrome(): string | null {
  if (chromePath !== undefined) return chromePath;
  chromePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p)) || null;
  return chromePath;
}

/** Real Chrome is used when it's installed and can open a window (REAL_CHROME=0 disables). */
export function realChromeAvailable(): boolean {
  if (process.env.REAL_CHROME === "0") return false;
  if (process.platform === "linux" && !process.env.DISPLAY) return false;
  return findChrome() !== null;
}

async function launchRealChrome(): Promise<Browser> {
  const exe = findChrome();
  if (!exe) throw new Error("Google Chrome not found");
  await fs.ensureDir(REAL_CHROME_PROFILE);

  const cdpUrl = `http://127.0.0.1:${REAL_CHROME_PORT}`;

  // Reuse a Chrome that's still running from before (e.g. after a node restart)
  const existing = await chromium.connectOverCDP(cdpUrl).catch(() => null);
  if (existing) {
    existing.on("disconnected", () => {
      realChrome = null;
    });
    return existing;
  }

  // Nothing is listening, so any profile lock left by a killed Chrome is stale
  // and would make the new Chrome exit immediately.
  for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    await fs.remove(path.join(REAL_CHROME_PROFILE, f)).catch(() => {});
  }

  const args = [
    `--remote-debugging-port=${REAL_CHROME_PORT}`,
    `--user-data-dir=${REAL_CHROME_PROFILE}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    "--window-size=1440,960",
    // Chrome refuses to start as root (Docker) without this
    ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []),
    "about:blank",
  ];
  chromeProc = spawn(exe, args, { stdio: "ignore" });
  chromeProc.on("exit", () => {
    chromeProc = null;
    realChrome = null;
  });

  for (let i = 0; i < 40; i++) {
    try {
      const browser = await chromium.connectOverCDP(cdpUrl);
      browser.on("disconnected", () => {
        realChrome = null;
      });
      return browser;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  chromeProc?.kill();
  throw new Error(`Chrome did not open CDP on ${cdpUrl} within 20s`);
}

function getRealChrome(): Promise<Browser> {
  if (!realChrome) {
    realChrome = launchRealChrome().catch((e) => {
      realChrome = null;
      throw e;
    });
  }
  return realChrome;
}

process.once("exit", () => chromeProc?.kill());

export type ProviderPage = { page: Page; close: () => Promise<void> };

/**
 * Opens a page for a scraper. Prefers a tab in the shared real Chrome (its default
 * profile keeps bot-manager cookies warm between searches); falls back to a fresh
 * stealth Playwright browser when Chrome isn't available.
 */
export async function openProviderPage(
  name: string,
  opts: { headless?: boolean; proxy?: ProxyOpts; profileBaseDir?: string } = {},
): Promise<ProviderPage> {
  if (realChromeAvailable()) {
    try {
      const browser = await getRealChrome();
      const page = await browser.contexts()[0]!.newPage();
      const watchdog = setTimeout(
        () => page.close({ runBeforeUnload: false }).catch(() => {}),
        HARD_TIMEOUT_MS,
      );
      return {
        page,
        close: async () => {
          clearTimeout(watchdog);
          await page.close({ runBeforeUnload: false }).catch(() => {});
        },
      };
    } catch (e: any) {
      console.warn(`[real-chrome] ${name}: falling back to stealth browser:`, e?.message || e);
    }
  }

  const profileDir = path.join(
    opts.profileBaseDir || "/tmp",
    `${name}_${crypto.randomBytes(6).toString("hex")}`,
  );
  await fs.ensureDir(profileDir);
  const ctx = await newStealthContext({
    profileDir,
    headless: opts.headless ?? true,
    proxy: opts.proxy,
  });
  const page = await ctx.newPage();
  return {
    page,
    close: async () => {
      await ctx.close().catch(() => {});
      await fs.remove(profileDir).catch(() => {});
    },
  };
}
