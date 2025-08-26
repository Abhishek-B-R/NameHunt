import { z } from "zod";

// Availability response schema
const NamecomAvailabilityItem = z.object({
  domainName: z.string(),
  premium: z.boolean().optional(),
  purchasable: z.boolean(),
  purchasePrice: z.number().optional(),
  renewalPrice: z.number().optional(),
});

export const NamecomAvailabilityResponse = z.object({
  results: z.array(NamecomAvailabilityItem),
});
