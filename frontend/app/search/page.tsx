"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Search as SearchIcon,
  CheckCircle,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ProviderCard } from "@/components/provider-card"
import { ProviderSkeleton } from "@/components/provider-skeleton"
import { useDomainSearch } from "@/hooks/use-domain-search"
import { CurrencySelector } from "@/components/currency-selector"
import { useCurrencyConverter } from "@/hooks/use-currency-converter"

function SearchResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [domain, setDomain] = useState(searchParams.get("q") || "")
  const [selectedCurrency, setSelectedCurrency] = useState("USD")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [successfulResults, setSuccessfulResults] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [errorResults, setErrorResults] = useState<any[]>([])

  // Currency conversion hook
  const {
    convertPrice,
    isLoading: currencyLoading,
    error: currencyError,
  } = useCurrencyConverter()

  // Domain search hook
  const {
    results,
    isLoading,
    isComplete,
    error,
    progress,
    startSearch,
    cancelSearch,
    connectionStatus,
    expectedProviders,
  } = useDomainSearch()

  const providerLogos: Record<string, string> = {
    godaddy: "/godaddy.png",
    namecheap: "/namecheap.png",
    squarespace: "/squarespace.jpg",
    hostinger: "/hostinger.png",
    networksolutions: "/networksolutions.png",
    namecom: "/namecom.png",
    porkbun: "/porkbun.png",
    ionos: "/ionos.png",
    hover: "/hover.png",
    dynadot: "/dynadot.png",
    namesilo: "/namesilo.png",
    spaceship: "/spaceship.jpeg",
  }

  useEffect(() => {
    const queryDomain = searchParams.get("q")
    if (queryDomain) {
      setDomain(queryDomain)
      startSearch(queryDomain)
    }
  }, [searchParams, startSearch])

  useEffect(() => {
    const successful = results.filter((r) => r.ok)
    const errors = results.filter((r) => !r.ok)
    setSuccessfulResults(successful)
    setErrorResults(errors)
    if (errors.length > 0) {
      console.log("Error results found:", errors)
    }
  }, [results])

  const handleNewSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = domain.trim()
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`)
    }
  }

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi className="h-4 w-4 text-teal-400" />
      case "connecting":
        return <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
      case "disconnected":
        return <WifiOff className="h-4 w-4 text-red-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  // Fallback converter to avoid crashes if converter not ready
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      {/* keep subtle accents but do not change bg */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-40 h-80 w-80 animate-float rounded-full bg-gradient-to-br from-indigo-500/10 to-teal-500/10 blur-3xl" />
        <div
          className="absolute -bottom-40 -left-40 h-80 w-80 animate-float rounded-full bg-gradient-to-tr from-teal-500/10 to-indigo-500/10 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="relative z-10 min-h-screen">
        {/* Sticky header aligned with your glass pattern */}
        <div className="sticky top-0 z-20 border-b border-white/10 bg-black/60 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="text-gray-100 hover:bg-white/10"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <form onSubmit={handleNewSearch} className="flex-1">
                <div className="relative mx-auto w-full max-w-2xl">
                  <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Enter domain name (e.g., example.com)"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="glass-input w-full rounded-xl border-0 py-2 pl-10 pr-4"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </form>

              <div className="flex items-center gap-2">
                {isLoading && (
                  <>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      {getConnectionIcon()}
                      <span className="hidden capitalize sm:inline">
                        {connectionStatus}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelSearch}
                      className="border-white/10 bg-white/10 text-gray-100 hover:bg-white/20"
                    >
                      Cancel
                    </Button>
                  </>
                )}

                {!isLoading && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/")}
                    className="border-white/10 bg-white/10 text-gray-100 hover:bg-white/20"
                  >
                    Try New Domain
                  </Button>
                )}

                <CurrencySelector
                  selectedCurrency={selectedCurrency}
                  onCurrencyChange={setSelectedCurrency}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-8">
          {/* Status header */}
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold text-gray-100">
              Domain Search Results
            </h1>
            <p className="text-gray-400">
              Searching for:{" "}
              <span className="font-semibold text-teal-400">
                {searchParams.get("q")}
              </span>
            </p>

            {isLoading && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-gray-300">
                  <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                  <span>
                    Searching across {expectedProviders.length} providers...
                  </span>
                  <span className="text-gray-500">
                    ({results.length}/{expectedProviders.length})
                  </span>
                </div>
                <Progress value={progress} className="h-2 w-full" />
              </div>
            )}

            {isComplete && !errorText && (
              <div className="mt-4 flex items-center gap-2 text-teal-400">
                <CheckCircle className="h-4 w-4" />
                <span>
                  Search completed − Found {successfulResults.length} successful
                  results and {errorResults.length} error results
                </span>
              </div>
            )}

            {errorText && (
              <Alert className="glass-card mt-4 border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300">
                  {errorText}
                </AlertDescription>
              </Alert>
            )}

            {currencyError && (
              <Alert className="glass-card mt-3 border-yellow-800">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                <AlertDescription className="text-yellow-300">
                  Currency conversion unavailable. Showing original prices.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Results grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* successful first */}
            {successfulResults.map((result) => (
              <ProviderCard
                key={result.provider}
                result={result}
                logo={
                  providerLogos[result.provider] || "/domain-provider-logo.jpg"
                }
                selectedCurrency={selectedCurrency}
                convertPrice={safeConvertPrice}
              />
            ))}

            {/* errors after completion */}
            {isComplete &&
              errorResults.map((result) => (
                <ProviderCard
                  key={result.provider}
                  result={result}
                  logo={
                    providerLogos[result.provider] ||
                    "/domain-provider-logo.jpg"
                  }
                  selectedCurrency={selectedCurrency}
                  convertPrice={safeConvertPrice}
                />
              ))}

            {isLoading && results.length < expectedProviders.length && (
              <>
                {Array.from({
                  length: Math.max(0, expectedProviders.length - results.length),
                }).map((_, i) => (
                  <ProviderSkeleton key={`skeleton-${i}`} />
                ))}
              </>
            )}
          </div>

          {/* Empty state */}
          {!isLoading && results.length === 0 && !errorText && (
            <div className="py-12 text-center">
              <Clock className="mx-auto mb-4 h-16 w-16 text-gray-500" />
              <h3 className="mb-2 text-xl font-semibold text-gray-100">
                No results yet
              </h3>
              <p className="text-gray-400">
                Start a search to see domain availability and pricing
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="text-gray-100">Loading...</div>
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  )
}