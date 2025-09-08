/* eslint-disable @next/next/no-img-element */
import { CheckCircle, XCircle, AlertCircle, DollarSign } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface DomainResult {
  provider: string
  ok: boolean
  domain: string
  available?: boolean
  registrationPrice?: number
  renewalPrice?: number
  currency?: string
  rawText?: string
  error?: string
}

interface ProviderCardProps {
  result: DomainResult
  logo: string
}

export function ProviderCard({ result, logo }: ProviderCardProps) {
  const getStatusIcon = () => {
    if (!result.ok) {
      return <XCircle className="w-5 h-5 text-red-500" />
    }
    if (result.available) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    return <AlertCircle className="w-5 h-5 text-yellow-500" />
  }

  const getStatusBadge = () => {
    if (!result.ok) {
      return <Badge variant="destructive">Error</Badge>
    }
    if (result.available) {
      return <Badge className="bg-green-500 hover:bg-green-600 text-white">Available</Badge>
    }
    return <Badge variant="secondary">Unavailable</Badge>
  }

  const getProviderName = () => {
    const names: Record<string, string> = {
      godaddy: "GoDaddy",
      namecheap: "Namecheap",
      squarespace: "Squarespace",
      hostinger: "Hostinger",
      porkbun: "Porkbun",
      cloudflare: "Cloudflare",
      google: "Google Domains",
    }
    return names[result.provider] || result.provider.charAt(0).toUpperCase() + result.provider.slice(1)
  }

  return (
    <Card className="glass-card interactive-card animate-fade-in-up p-4 sm:p-6 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={logo || "/placeholder.svg"}
              alt={`${result.provider} logo`}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-contain bg-white/10 dark:bg-gray-800/30 p-1 transition-transform duration-300 group-hover:scale-110"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = "/placeholder.svg?key=hf3q8"
              }}
            />
            <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-gradient-to-r from-indigo-500 to-teal-500 rounded-full animate-pulse"></div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">{getProviderName()}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{result.domain}</p>
          </div>
        </div>
        <div className="flex-shrink-0">{getStatusIcon()}</div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">Status:</span>
          {getStatusBadge()}
        </div>

        {result.ok && result.available && (
          <div className="space-y-3">
            <div className="glass-card rounded-lg p-3 space-y-2 animate-scale-in">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-xs">Registration:</span>
                <div className="flex items-center gap-1 text-gray-900 dark:text-gray-100 font-bold">
                  <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                  <span className="text-base">{result.registrationPrice?.toFixed(2)}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{result.currency}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-xs">Renewal:</span>
                <div className="flex items-center gap-1 text-gray-900 dark:text-gray-100 font-semibold">
                  <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-teal-500" />
                  <span className="text-sm">{result.renewalPrice?.toFixed(2)}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{result.currency}</span>
                </div>
              </div>
            </div>

            <Button className="w-full py-2 sm:py-3 text-sm font-semibold theme-button rounded-lg">
              <span className="hidden sm:inline">Register at {getProviderName()}</span>
              <span className="sm:hidden">Register</span>
            </Button>
          </div>
        )}

        {!result.ok && (
          <div className="text-red-700 dark:text-red-300 text-xs glass-card border-red-200 dark:border-red-800 p-3 sm:p-4 rounded-lg animate-fade-in-up">
            <div className="flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <strong>Connection Error</strong>
                <p className="mt-1 text-xs break-words">{result.error}</p>
              </div>
            </div>
          </div>
        )}

        {result.ok && !result.available && (
          <div className="text-yellow-700 dark:text-yellow-300 text-xs glass-card border-yellow-200 dark:border-yellow-800 p-3 sm:p-4 rounded-lg animate-fade-in-up">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Domain Unavailable</strong>
                <p className="mt-1 text-xs">This domain is already registered or not available for purchase</p>
              </div>
            </div>
          </div>
        )}

        {result.rawText && (
          <details className="text-xs text-gray-500 dark:text-gray-400 group/details">
            <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200 select-none text-xs">
              <span className="group-open/details:hidden">Show raw response</span>
              <span className="hidden group-open/details:inline">Hide raw response</span>
            </summary>
            <pre className="mt-3 p-3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg text-xs overflow-auto max-h-32 border border-gray-200 dark:border-gray-700 animate-fade-in-up">
              {result.rawText}
            </pre>
          </details>
        )}
      </div>
    </Card>
  )
}
