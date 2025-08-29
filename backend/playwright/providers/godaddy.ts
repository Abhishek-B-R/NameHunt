import { newStealthContext } from "../browser";

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function checkGoDaddy(domain: string) {
  const ctx = await newStealthContext({
    profileDir: "./profiles/godaddy", // cookies persist here
    headless: false,
    locale: "en-US",
    timezoneId: "America/New_York",
    proxy: { server: "http://user:pass@residential-proxy:port" }, // optional
  });
  const page = await ctx.newPage();

  try {
    // Warm-up: visit homepage first
    await page.goto("https://www.godaddy.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Human-like actions
    await sleep(2000 + Math.random() * 2000);
    await page.mouse.move(200 + Math.random() * 300, 300, { steps: 10 });
    await page.mouse.wheel(0, 400);
    await sleep(1000 + Math.random() * 1000);
    await page.mouse.move(200, 300, { steps: 20 });
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(2000 + Math.random() * 2000);

    // Now go to search page
    const url =
      "https://www.godaddy.com/en-in/domainsearch/find?domainToCheck=" +
      encodeURIComponent(domain);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Accept cookies if present
    const cookieBtn = page.locator('button:has-text("Accept")');
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click().catch(() => {});
    }

    // Wait for domain text
    await page.waitForSelector(`text=${domain}`, { timeout: 45000 });

    // Scroll again
    await page.mouse.wheel(0, 600);
    await sleep(1500 + Math.random() * 1500);

    // Extract text
    const text = await page.innerText("body");

    const available =
      /is available/i.test(text) &&
      !/isn'?t available|unavailable|taken/i.test(text);
    const unavailable =
      /isn'?t available|unavailable|taken|already registered/i.test(text);
    const premium = /premium/i.test(text);

    const priceMatch = text.match(
      /(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*[0-9][\d,]*\.?\d*/
    );
    const renewMatch = text.match(
      /renews?\s+at[^0-9]*(₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s*([\d,\.]+)/
    );

    return {
      ok: true,
      domain,
      available: available && !unavailable,
      isPremium: premium,
      registrationPrice: priceMatch
        ? parseFloat(priceMatch[0].replace(/[^\d.]/g, ""))
        : undefined,
      renewalPrice: renewMatch
        ? parseFloat(renewMatch[2].replace(/[^\d.]/g, ""))
        : undefined,
      currency: priceMatch ? priceMatch[1] : "USD",
    };
  } catch (e: any) {
    return { ok: false, domain, error: e.message };
  } finally {
    await ctx.close();
  }
}