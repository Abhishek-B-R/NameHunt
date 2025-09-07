import { z } from "zod";

const Success = z.object({
  available: z.boolean(),
  currency: z.string(),
  definitive: z.boolean(),
  domain: z.string(), // just a string, not URL
  period: z.number().min(1).optional(),
  price: z.number().min(0),
  isPremium: z.boolean().optional(),
});

const Taken = z.object({
  available: z.boolean().default(false),
  definitive: z.boolean().default(true),
  domain: z.string(),
  price: z.number().min(0).default(NaN),
});

const ErrorSchema = z.object({
  code: z.string(),
  fields: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      path: z.string(),
      pathRelated: z.string(),
    })
  ),
  message: z.string(),
});

const GoDaddyResponse = z.union([Success, Taken, ErrorSchema])
  .describe("Domain Availability Response Schema");

export type GoDaddyResponseType = z.infer<typeof GoDaddyResponse>;
export default GoDaddyResponse;
