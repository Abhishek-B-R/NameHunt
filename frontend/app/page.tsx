"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Zap, Globe, DollarSign, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ThemeToggle } from "@/components/theme-toggle"
import { validateDomain } from "@/lib/domain-validation"

export default function HomePage() {
  const [domain, setDomain] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    if (!domain.trim()) {
      setValidationError("Please enter a domain name")
      return
    }

    const validation = validateDomain(domain.trim())
    if (!validation.success) {
      setValidationError(validation.error || "Invalid domain format")
      return
    }

    setValidationError(null)
    router.push(`/search?q=${encodeURIComponent(validation.data!)}`)
  }

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDomain(e.target.value)
    if (validationError) {
      setValidationError(null)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-60 h-60 sm:w-80 sm:h-80 bg-gradient-to-br from-teal-400/20 to-teal-600/20 rounded-full blur-3xl animate-float" />
        <div
          className="absolute -bottom-40 -left-40 w-60 h-60 sm:w-80 sm:h-80 bg-gradient-to-tr from-teal-500/20 to-teal-300/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-96 sm:h-96 bg-gradient-to-r from-teal-400/15 to-blue-400/15 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "4s" }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12 animate-fade-in-up">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="p-2 sm:p-3 glass-card rounded-xl sm:rounded-2xl">
              <Globe className="w-6 h-6 sm:w-8 sm:h-8 text-teal-600 dark:text-teal-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold gradient-text text-high-contrast">NameHunt</h1>
          </div>
          <p className="text-xl sm:text-2xl text-high-contrast font-medium mb-2">
            Find the perfect domain at the best price
          </p>
          <p className="text-base sm:text-lg text-medium-contrast max-w-2xl mx-auto px-4">
            Compare prices across multiple registrars in real-time and discover your ideal domain name instantly
          </p>
        </div>

        <div className="w-full max-w-2xl animate-scale-in" style={{ animationDelay: "0.3s" }}>
          <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12">
            <form onSubmit={handleSearch} className="space-y-4 sm:space-y-6">
              <div className="relative">
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 w-5 h-5 sm:w-6 sm:h-6" />
                <Input
                  type="text"
                  placeholder="Enter domain name (e.g., example.com)"
                  value={domain}
                  onChange={handleDomainChange}
                  className="glass-input pl-10 sm:pl-14 pr-4 py-4 sm:py-6 text-base sm:text-lg rounded-xl sm:rounded-2xl border-0"
                  autoFocus
                />
              </div>

              {validationError && (
                <Alert className="glass-card border-red-200 dark:border-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-700 dark:text-red-300">{validationError}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full py-4 sm:py-6 text-base sm:text-lg font-semibold theme-button rounded-xl sm:rounded-2xl"
              >
                Search Domains
              </Button>
            </form>
          </div>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-12 sm:mt-16 w-full max-w-4xl animate-fade-in-up"
          style={{ animationDelay: "0.5s" }}
        >
          <div className="glass-card interactive-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-high-contrast mb-2">Real-time Results</h3>
            <p className="text-medium-contrast text-sm sm:text-base">
              Get live pricing from multiple registrars as they stream in
            </p>
          </div>

          <div className="glass-card interactive-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-teal-500 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-high-contrast mb-2">Multiple Providers</h3>
            <p className="text-medium-contrast text-sm sm:text-base">
              Compare GoDaddy, Namecheap, Squarespace, Hostinger, and 8 more providers
            </p>
          </div>

          <div className="glass-card interactive-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center sm:col-span-2 lg:col-span-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-teal-500 to-blue-500 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-high-contrast mb-2">Best Prices</h3>
            <p className="text-medium-contrast text-sm sm:text-base">
              Find the lowest registration and renewal costs instantly
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
