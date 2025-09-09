"use client"
import { ChevronDown, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const currencies = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
]

interface CurrencySelectorProps {
  selectedCurrency: string
  onCurrencyChange: (currency: string) => void
}

export function CurrencySelector({ selectedCurrency, onCurrencyChange }: CurrencySelectorProps) {
  const currentCurrency = currencies.find((c) => c.code === selectedCurrency) || currencies[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="glass-card border-0 text-gray-900 dark:text-gray-100 hover:bg-gray-100/20 dark:hover:bg-gray-800/20 bg-transparent"
        >
          <DollarSign className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">{currentCurrency.code}</span>
          <span className="sm:hidden">{currentCurrency.symbol}</span>
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-card border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        {currencies.map((currency) => (
          <DropdownMenuItem
            key={currency.code}
            onClick={() => onCurrencyChange(currency.code)}
            className="cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
          >
            <span className="font-mono text-sm w-8">{currency.symbol}</span>
            <span className="font-medium">{currency.code}</span>
            <span className="text-gray-600 dark:text-gray-400 ml-2">{currency.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
