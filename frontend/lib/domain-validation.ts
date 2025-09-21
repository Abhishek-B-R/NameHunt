import { z } from "zod"

async function fetchValidTLDs(): Promise<string[]> {
  const res = await fetch("https://data.iana.org/TLD/tlds-alpha-by-domain.txt");
  const text = await res.text();
  return text
    .split("\n")
    .filter(line => line && !line.startsWith("#"))
    .map(tld => tld.toLowerCase());
}

const VALID_TLDS = await fetchValidTLDs();

export const domainSchema = z.object({
  domain: z
    .string()
    .min(1, "Domain name is required")
    .max(253, "Domain name is too long")
    .regex(
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
      "Invalid domain format",
    )
    .refine((domain) => {
      // Extract TLD (everything after the last dot)
      const parts = domain.split(".")
      if (parts.length < 2) return false

      const tld = parts[parts.length - 1].toLowerCase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return VALID_TLDS.includes(tld as any)
    }, "Invalid or unsupported TLD")
    .refine((domain) => {
      // Additional checks
      const parts = domain.split(".")

      // Check each part length (max 63 characters per label)
      if (parts.some((part) => part.length > 63)) return false

      // Check for consecutive dots or starting/ending with dots
      if (domain.includes("..") || domain.startsWith(".") || domain.endsWith(".")) return false

      // Check for valid characters in each part
      return parts.every((part) => /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(part))
    }, "Invalid domain structure"),
})

export type DomainInput = z.infer<typeof domainSchema>

// Validation function
export function validateDomain(domain: string): { success: boolean; error?: string; data?: string } {
  try {
    const result = domainSchema.parse({ domain: domain.trim().toLowerCase() })
    return { success: true, data: result.domain }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: "Invalid domain format" }
  }
}
