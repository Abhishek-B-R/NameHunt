"use client"

import { useState, useEffect, useCallback } from "react"

interface ExchangeRates {
  [key: string]: number
}

interface CurrencyConverterHook {
  convertPrice: (price: number, fromCurrency: string, toCurrency: string) => number
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useCurrencyConverter(): CurrencyConverterHook {
  const [rates, setRates] = useState<ExchangeRates>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchRates = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Using exchangerate-api.com (free tier: 1500 requests/month)
      const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD")

      if (!response.ok) {
        throw new Error("Failed to fetch exchange rates")
      }

      const data = await response.json()
      setRates(data.rates)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch exchange rates")
      console.error("[v0] Currency conversion error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRates()

    // Refresh rates every 30 minutes
    const interval = setInterval(fetchRates, 30 * 60 * 1000)

    return () => clearInterval(interval)
  }, [fetchRates])

  const convertPrice = useCallback(
    (price: number, fromCurrency: string, toCurrency: string): number => {
      if (fromCurrency === toCurrency) return price
      if (!rates || Object.keys(rates).length === 0) return price

      try {
        // Convert to USD first (base currency)
        let usdPrice = price
        if (fromCurrency !== "USD") {
          const fromRate = rates[fromCurrency]
          if (!fromRate) return price
          usdPrice = price / fromRate
        }

        // Convert from USD to target currency
        if (toCurrency === "USD") {
          return Math.round(usdPrice * 100) / 100
        }

        const toRate = rates[toCurrency]
        if (!toRate) return price

        const convertedPrice = usdPrice * toRate
        return Math.round(convertedPrice * 100) / 100
      } catch (err) {
        console.error("[v0] Price conversion error:", err)
        return price
      }
    },
    [rates],
  )

  return {
    convertPrice,
    isLoading,
    error,
    lastUpdated,
  }
}
