"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Search,
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
import { ThemeToggle } from "@/components/theme-toggle"
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
        return <Wifi className="w-4 h-4 text-green-500" />
      case "connecting":
        return <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
      case "disconnected":
        return <WifiOff className="w-4 h-4 text-red-500" />
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />
    }
  }

  // Fallback converter to avoid crashes if converter not ready
  const safeConvertPrice = (
    price: number,
    fromCurrency: string,
    toCurrency: string
  ) => {
    try {
      if (currencyLoading || currencyError) {
        // If converter not ready, just return original price
        return price
      }
      return convertPrice(price, fromCurrency, toCurrency)
    } catch {
      return price
    }
  }

  const errorText =
    typeof error === "string" ? error : error ? JSON.stringify(error) : null

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-indigo-500/10 to-teal-500/10 rounded-full blur-3xl animate-float" />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-teal-500/10 to-indigo-500/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="relative z-10 min-h-screen">
        <div className="glass-card border-b sticky top-0 z-20">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="text-gray-900 dark:text-gray-100 hover:bg-gray-100/20 dark:hover:bg-gray-800/20"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <form onSubmit={handleNewSearch} className="flex-1 max-w-2xl">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Enter domain name (e.g., example.com)"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="glass-input pl-10 pr-4 py-2 rounded-xl border-0"
                  />
                </div>
              </form>

              <div className="flex items-center gap-2">
                {isLoading && (
                  <>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                      {getConnectionIcon()}
                      <span className="hidden sm:inline capitalize">
                        {connectionStatus}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelSearch}
                      className="glass-card border-0 text-gray-900 dark:text-gray-100 hover:bg-gray-100/20 dark:hover:bg-gray-800/20 bg-transparent"
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
                    className="glass-card border-0 text-gray-900 dark:text-gray-100 hover:bg-gray-100/20 dark:hover:bg-gray-800/20 bg-transparent"
                  >
                    Try New Domain
                  </Button>
                )}

                <CurrencySelector
                  selectedCurrency={selectedCurrency}
                  onCurrencyChange={setSelectedCurrency}
                />

                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {/* Search status */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Domain Search Results
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Searching for:{" "}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {searchParams.get("q")}
              </span>
            </p>

            {isLoading && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>
                    Searching across {expectedProviders.length} providers...
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    ({results.length}/{expectedProviders.length})
                  </span>
                </div>
                <Progress value={progress} className="w-full h-2" />
              </div>
            )}

            {isComplete && !errorText && (
              <div className="flex items-center gap-2 mt-4 text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>
                  Search completed - Found {results.length} provider results
                </span>
              </div>
            )}

            {errorText && (
              <Alert className="mt-4 glass-card border-red-200 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-700 dark:text-red-300">
                  {errorText}
                </AlertDescription>
              </Alert>
            )}

            {currencyError && (
              <Alert className="mt-3 glass-card border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  Currency conversion unavailable. Showing original prices.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Results grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {results.map((result) => (
              <ProviderCard
                key={result.provider}
                result={result}
                logo={providerLogos[result.provider] || "/domain-provider-logo.jpg"}
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
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No results yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
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
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  )
}