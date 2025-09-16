"use client";

import { useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
];

interface CurrencySelectorProps {
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
}

const LS_KEY = "nh_selected_currency";

export function CurrencySelector({
  selectedCurrency,
  onCurrencyChange,
}: CurrencySelectorProps) {
  // On mount, restore saved currency if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const code = saved.toUpperCase();
        if (currencies.some((c) => c.code === code) && code !== selectedCurrency) {
          onCurrencyChange(code);
        }
      }
    } catch {
      // ignore storage errors
    }
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentCurrency =
    currencies.find((c) => c.code === (selectedCurrency || "USD")) ||
    currencies[0];

  const handleChange = (code: string) => {
    onCurrencyChange(code);
    try {
      localStorage.setItem(LS_KEY, code);
    } catch {
      // ignore storage errors
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="glass-card border-0 bg-transparent text-gray-100 hover:bg-white/10"
        >
          <span className="mr-1 font-mono">{currentCurrency.symbol}</span>
          <span className="hidden sm:inline">{currentCurrency.code}</span>
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="glass-card border-0 bg-gray-900/80 backdrop-blur-md"
      >
        {currencies.map((currency) => {
          const active = currency.code === currentCurrency.code;
          return (
            <DropdownMenuItem
              key={currency.code}
              onClick={() => handleChange(currency.code)}
              className={`cursor-pointer hover:bg-white/10 ${
                active ? "bg-white/5" : ""
              }`}
            >
              <span className="w-8 font-mono text-sm">{currency.symbol}</span>
              <span className="font-medium">{currency.code}</span>
              <span className="ml-2 text-gray-400">{currency.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}