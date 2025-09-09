"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DomainResult } from "@/hooks/use-domain-search"

function safeText(val: unknown): string | undefined {
  if (val == null) return undefined
  if (typeof val === "string") return val
  if (typeof val === "number" || typeof val === "boolean") return String(val)
  try {
    return JSON.stringify(val)
  } catch {
    return undefined
  }
}

function truncate(s: string, n = 220) {
  return s.length > n ? s.slice(0, n) + "..." : s
}

function getCurrencySymbol(currency: string | undefined) {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CAD: "C$",
    AUD: "A$",
    CHF: "Fr",
    CNY: "¥",
    INR: "₹",
    KRW: "₩",
  }
  if (!currency) return "$"
  return symbols[currency.toUpperCase()] || currency.toUpperCase()
}

export function ProviderCard({
  result,
  logo,
  selectedCurrency,
  convertPrice,
}: {
  result: DomainResult
  logo?: string
  selectedCurrency: string
  convertPrice: (price: number, fromCurrency: string, toCurrency: string) => number
}) {
  const fromCurrency = result.currency || "USD"
  const targetCurrency = selectedCurrency || "USD"
  const targetSymbol = getCurrencySymbol(targetCurrency)

  const formatConverted = (price: number | undefined) => {
    if (typeof price !== "number" || Number.isNaN(price)) return undefined
    try {
      const converted = convertPrice(price, fromCurrency, targetCurrency)
      if (typeof converted !== "number" || !isFinite(converted)) return undefined
      return `${targetSymbol} ${converted.toFixed(2)}`
    } catch {
      return undefined
    }
  }

  const price = formatConverted(result.registrationPrice)
  const renewal = formatConverted(result.renewalPrice)

  const raw = result.rawText ? truncate(String(result.rawText)) : undefined
  const err = safeText(result.error)

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={`${result.provider} logo`}
            className="h-6 w-6 rounded"
          />
        ) : null}
        <CardTitle className="text-base flex items-center gap-2">
          <span className="capitalize">{result.provider}</span>
          <Badge
            variant={result.ok ? "default" : "destructive"}
            className="text-xs"
          >
            {result.ok ? "OK" : "ERR"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Domain</span>
          <span className="font-medium">{result.domain}</span>
        </div>

        {typeof result.available === "boolean" && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Available</span>
            <Badge
              variant={result.available ? "default" : "secondary"}
              className="capitalize"
            >
              {result.available ? "yes" : "no"}
            </Badge>
          </div>
        )}

        {price && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Registration</span>
            <span className="font-medium">{price}</span>
          </div>
        )}

        {renewal && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Renewal</span>
            <span className="font-medium">{renewal}</span>
          </div>
        )}

        {/* Show original currency for transparency if conversion happened */}
        {targetCurrency.toUpperCase() !== (fromCurrency || "USD").toUpperCase() &&
          (result.registrationPrice || result.renewalPrice) && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Original</span>
              <span>
                {getCurrencySymbol(fromCurrency)}{" "}
                {[
                  typeof result.registrationPrice === "number"
                    ? result.registrationPrice.toFixed(2)
                    : undefined,
                  typeof result.renewalPrice === "number"
                    ? result.renewalPrice.toFixed(2)
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(" / ")}
              </span>
            </div>
          )}

        {err && (
          <div className="pt-1">
            <span className="text-muted-foreground">Error</span>
            <div className="mt-1 rounded bg-red-500/10 text-red-700 dark:text-red-300 p-2">
              <code className="text-xs break-words">{truncate(err, 300)}</code>
            </div>
          </div>
        )}

        {raw && !err && (
          <div className="pt-1">
            <span className="text-muted-foreground">Raw</span>
            <div className="mt-1 rounded bg-muted p-2">
              <code className="text-xs break-words">{raw}</code>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}