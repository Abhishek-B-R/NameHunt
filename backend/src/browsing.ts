import { check } from "zod";
import { checkDynadot } from "./playwright/providers/dynadot.js";
import { checkGoDaddy } from "./playwright/providers/godaddy.js";
import { checkDomainHover } from "./playwright/providers/hover.js";
import { checkDomainIONOS } from "./playwright/providers/ionos.js";
import type { DCResult } from "./playwright/providers/namecheap.js";
import { checkNamecheap } from "./playwright/providers/namecheap.js";
import { checkNetworkSolutions } from "./playwright/providers/networksolutions.js";
import { checkDomainPorkbun } from "./playwright/providers/porkbun.js";
import { checkSquarespace } from "./playwright/providers/squarespace.js";

import { ProviderNames }  from "./types/providerNames.js"
import { checkDomainSpaceship } from "./playwright/providers/spaceship.js";
import { checkHostingerDC } from "./adapters/hostinger.js";
import { checkNamecomDC } from "./adapters/namecom.js";
import { checkNamesiloDC } from "./adapters/namesilo.js";

const providerMap:Record<ProviderNames, (domain: string) => Promise<DCResult>> = {
  [ProviderNames.GODADDY]: async (domain: string) =>
    await checkGoDaddy(domain, {
      headless: true,
      ephemeralProfile: true,
    }),

  [ProviderNames.NAMECHEAP]: async (domain: string) =>
    await checkNamecheap(domain, {
      headless: true,
      ephemeralProfile: true,
    }),

  [ProviderNames.SQUARESPACE]: async (domain: string) =>
    await checkSquarespace(domain, {
      headless: true,
      ephemeralProfile: true,
    }),

  [ProviderNames.IONOS]: async (domain: string) =>
    await checkDomainIONOS(domain, {
      headless: true,
      ephemeralProfile: true,
    }),


  [ProviderNames.NETWORKSOLUTIONS]: async (domain: string) =>
    await checkNetworkSolutions(domain, {
      headless: true,
      ephemeralProfile: true,
    }),

  [ProviderNames.DYNADOT]: async (domain: string) =>
    await checkDynadot(domain, {
      headless: true,
      ephemeralProfile: true,
    }),

  [ProviderNames.HOVER]: async (domain: string) =>
    await checkDomainHover(domain, {
      headless: true,
      ephemeralProfile: true,
    }),

  [ProviderNames.PORKBUN]: async (domain: string) =>
    await checkDomainPorkbun(domain, {
      headless: true,
      ephemeralProfile: true,
    }),

  [ProviderNames.SPACESHIP]: async (domain: string) =>
    await checkDomainSpaceship(domain, {
      headless: true,
      ephemeralProfile: true,
    }),

  [ProviderNames.HOSTINGER]: (domain) => checkHostingerDC(domain),
  [ProviderNames.NAMECOM]: (domain) => checkNamecomDC(domain),
  [ProviderNames.NAMESILO]: (domain) => checkNamesiloDC(domain),
};

export type ProviderKey = keyof typeof providerMap;

export async function runBrowsingProvider(
  provider: ProviderKey,
  domain: string,
  opts?: { timeoutMs?: number }
): Promise<DCResult> {
  const run = providerMap[provider];
  if (!run) {
    return {
      ok: false,
      domain,
      error: `Unknown provider ${provider}`,
    };
  }

  const timeoutMs = opts?.timeoutMs ?? 30000;

  // Timeout guard
  const result = await Promise.race([
    run(domain),
    new Promise<DCResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            ok: false,
            domain,
            error: `Timed out after ${timeoutMs} ms`,
          }),
        timeoutMs
      )
    ),
  ]);

  return result;
}