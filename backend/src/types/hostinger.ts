import { z } from "zod";
// Zod schemas
export const AvailabilityResponse = z.array(
  z.object({
    domain: z.string(),
    is_available: z.boolean(),
    is_alternative: z.boolean().optional(),
    restriction: z.string().nullable().optional(),
  })
);

export const CatalogItem = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  metadata: z.record(z.string(), z.any()).nullable(),
  prices: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      currency: z.string(),
      price: z.number(), // in cents
      first_period_price: z.number().optional(),
      period: z.number(),
      period_unit: z.string(),
    })
  ),
});
export const CatalogResponse = z.array(CatalogItem);
