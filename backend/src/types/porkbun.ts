import { z } from "zod";

// Availability
export const PBAvailability = z.object({
  status: z.literal("SUCCESS"),
  domains: z.array(
    z.object({
      domain: z.string(),
      status: z.enum(["available", "unavailable"]),
      // Porkbun sometimes includes premium flag and price fields
      premium: z.boolean().optional(),
      price: z.number().optional(), // registration price in USD
      renewalPrice: z.number().optional(),
      // note: sometimes prices are strings; normalize in code
    })
  ),
});

// Pricing by exact domain (authoritative)
export const PBPriceDomain = z.object({
  status: z.literal("SUCCESS"),
  domain: z.string(),
  tld: z.string().optional(),
  premium: z.boolean().optional(),
  registration: z
    .object({
      price: z.union([z.number(), z.string()]).optional(),
      currency: z.string().default("USD"),
    })
    .optional(),
  renewal: z
    .object({
      price: z.union([z.number(), z.string()]).optional(),
      currency: z.string().default("USD"),
    })
    .optional(),
  transfer: z
    .object({
      price: z.union([z.number(), z.string()]).optional(),
      currency: z.string().default("USD"),
    })
    .optional(),
});