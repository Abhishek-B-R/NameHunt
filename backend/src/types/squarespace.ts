import { z } from "zod";

export const SquarespaceQuote = z.object({
  available: z.boolean(),
  isPremium: z.boolean().optional(),
  price: z.number(),
  currency: z.string(),
  renewalPrice: z.number().optional(),
  transferPrice: z.number().optional(),
  icannFee: z.number().optional(),
});
export type SquarespaceQuote = z.infer<typeof SquarespaceQuote>;