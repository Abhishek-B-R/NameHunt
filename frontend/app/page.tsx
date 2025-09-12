"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { validateDomain } from "@/lib/domain-validation";
import FeaturesComponent from "@/components/Landing/FeaturesComponent";
// import Plasma from '@/components/ui/Plasma';
import DarkVeil from "@/components/ui/DarkVeil";
import { FAQ } from "@/components/Landing/AccordianSection";
import OpenOnRegistrarsButton from "@/components/Landing/OpenAllProviders";
import FutureWork from "@/components/Landing/FutureWork";

export default function HomePage() {
  const [domain, setDomain] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!domain.trim()) {
      setValidationError("Please enter a domain name");
      return;
    }

    const validation = validateDomain(domain.trim());
    if (!validation.success) {
      setValidationError(validation.error || "Invalid domain format");
      return;
    }

    setValidationError(null);
    router.push(`/search?q=${encodeURIComponent(validation.data!)}`);
  };

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDomain(e.target.value);
    if (validationError) setValidationError(null);
  };

  return (
    <div className="relative min-h-[200vh] bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#05070A] dark:via-[#070A0F] dark:to-[#05070A]">
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          height: "50vh",
        }}
      >
        <DarkVeil hueShift={51} warpAmount={3} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 dark:to-black/40" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden -z-[5]"
      >
        <div className="absolute -top-40 -right-32 h-80 w-80 sm:h-96 sm:w-96 bg-[radial-gradient(circle_at_30%_30%,rgba(20,184,166,.18),transparent_60%)] blur-2xl animate-float" />
        <div
          className="absolute -bottom-40 -left-32 h-80 w-80 sm:h-96 sm:w-96 bg-[radial-gradient(circle_at_70%_70%,rgba(56,189,248,.16),transparent_60%)] blur-2xl animate-float"
          style={{ animationDelay: "1.2s" }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[28rem] w-[28rem] sm:h-[34rem] sm:w-[34rem] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(45,212,191,.08),rgba(14,165,233,.08),transparent_60%)] blur-3xl animate-slow-float"
          style={{ animationDelay: "2.4s" }}
        />
      </div>

      {/* Hero */}
      <header className="relative z-10 flex flex-col items-center justify-center min-h-[92vh] px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12 animate-fade-in-up">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold gradient-text">
              NameHunt
            </h1>
          </div>
          <p className="text-xl md:text-3xl text-high-contrast font-semibold mb-2">
            Find the perfect domain at the best price
          </p>
          <p className="text-base md:text-lg text-medium-contrast max-w-3xl mx-auto">
            Compare prices across registrars in real-time and secure your ideal
            domain instantly
          </p>
        </div>

        <div
          className="w-full max-w-3xl animate-scale-in"
          style={{ animationDelay: "0.15s" }}
        >
          <div className="glass-card rounded-3xl p-4 sm:p-6 md:p-8">
            <form onSubmit={handleSearch} className="space-y-4 sm:space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 w-6 h-6" />
                <Input
                  ref={searchRef}
                  type="text"
                  placeholder="Enter domain name e.g. example.com"
                  value={domain}
                  onChange={handleDomainChange}
                  className="glass-input pl-12 pr-4 py-5 text-base sm:text-lg rounded-2xl border-0"
                  autoFocus
                />
              </div>

              {validationError && (
                <Alert className="glass-card border-red-200 dark:border-red-800 max-w-990">
                  <AlertDescription className="text-red-700 dark:text-red-200 flex justify-center">
                    {validationError}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex w-full gap-3">
                <OpenOnRegistrarsButton
                  domain={domain}
                  className="flex-1 w-full sm:text-lg font-semibold rounded-2xl transition active:scale-[0.99]"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1 w-full py-7 md:py-7.5 sm:text-lg font-semibold rounded-2xl theme-button transition active:scale-[0.99]"
                >
                  Analyse
                </Button>
              </div>
            </form>

            <div className="mt-4 flex items-center justify-center gap-3 text-sm text-medium-contrast">
              <ShieldCheck className="h-4 w-4" />
              <span>No markup. Transparent prices only</span>
            </div>
          </div>
        </div>
      </header>

      {/* Scroll indicator */}
      <div className="absolute left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-muted-foreground/50 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>

      <FeaturesComponent />
      <FAQ />

      <section className="w-full py-10">
        <div className="mx-auto max-w-5xl glass-card rounded-2xl p-6 text-center">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Ready to compare prices?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Find the best deal in under a minute.
          </p>
          <Button
            onClick={() => searchRef?.current?.focus()}
            className="inline-flex items-center justify-center rounded-lg theme-button px-4 py-2 font-semibold text-white dark:text-black"
          >
            Start a search
          </Button>
        </div>
      </section>
      
      <FutureWork/>
    </div>
  );
}
