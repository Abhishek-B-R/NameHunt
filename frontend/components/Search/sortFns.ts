// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRegistrationPrice(r: any) {
  // If missing or not a number, push to end
  return typeof r.registrationPrice === "number"
    ? r.registrationPrice
    : Number.POSITIVE_INFINITY
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRenewalPriceNormalized(r: any) {
  // If renewalPrice missing, treat registrationPrice as renewal
  if (typeof r.renewalPrice === "number") return r.renewalPrice
  if (typeof r.registrationPrice === "number") return r.registrationPrice
  return Number.POSITIVE_INFINITY
}

export function useConvertHelpers({
  currencyLoading,
  currencyError,
  convertPrice,
  error,
}: {
  currencyLoading: boolean
  currencyError: unknown
  convertPrice: (p: number, f: string, t: string) => number
  error: unknown
}) {
  const safeConvertPrice = (
    price: number,
    fromCurrency: string,
    toCurrency: string
  ) => {
    try {
      if (currencyLoading || currencyError) return price
      return convertPrice(price, fromCurrency, toCurrency)
    } catch {
      return price
    }
  }

  const errorText =
    typeof error === "string" ? error : error ? JSON.stringify(error) : null

  return { safeConvertPrice, errorText }
}