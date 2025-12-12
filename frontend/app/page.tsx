/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, PlayCircle, Search, ShieldCheck } from "lucide-react";
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
import DemoDialog from "@/components/Landing/YoutubeDemo";
import TestimonialsComponent from "@/components/Landing/TestimonialsComponent";
import Navbar from "@/components/Landing/Navbar";

export default function HomePage() {
  const [domain, setDomain] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Navbar height
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

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
    <div className="relative min-h-[200vh] bg-linear-to-b from-[#05070A] via-[#070A0F] to-[#05070A]">
      <Navbar onNavigate={scrollToSection} searchRef={searchRef} />
      <div
        className="pointer-events-none absolute inset-0 block"
        style={{
          height: "50vh",
        }}
      >
        <DarkVeil hueShift={51} warpAmount={3} />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/40" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden -z-5"
      >
        <div className="absolute -top-40 -right-32 h-80 w-80 sm:h-96 sm:w-96 bg-[radial-linear(circle_at_30%_30%,rgba(20,184,166,.18),transparent_60%)] blur-2xl animate-float" />
        <div
          className="absolute -bottom-40 -left-32 h-80 w-80 sm:h-96 sm:w-96 bg-[radial-linear(circle_at_70%_70%,rgba(56,189,248,.16),transparent_60%)] blur-2xl animate-float"
          style={{ animationDelay: "1.2s" }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 h-112 w-md sm:h-136 sm:w-136 bg-[conic-linear(from_180deg_at_50%_50%,rgba(45,212,191,.08),rgba(14,165,233,.08),transparent_60%)] blur-3xl animate-slow-float"
          style={{ animationDelay: "2.4s" }}
        />
      </div>

      {/* Hero */}
      <header className="relative z-10 flex flex-col items-center justify-center min-h-[92vh] px-4 sm:px-6 pt-30">
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
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
                <Input
                  ref={searchRef}
                  type="text"
                  placeholder="Enter domain name e.g. example.com"
                  value={domain}
                  onChange={handleDomainChange}
                  className="glass-input pl-12 pr-4 py-6 text-base sm:text-lg rounded-2xl border-0"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch(e);
                    }
                  }}
                />
              </div>

              {validationError && (
                <Alert className="glass-card border-red-800 max-w-990">
                  <AlertDescription className="text-red-200 flex justify-center">
                    {validationError}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col sm:flex-row w-full gap-4">
                <OpenOnRegistrarsButton
                  domain={domain}
                  className="hidden md:block"
                  buttonText="Compare Manually"
                />
                <Button
                  type="submit"
                  className="sm:flex-1 w-full py-5 sm:py-6 text-base sm:text-lg font-bold rounded-2xl theme-button text-white active:scale-[0.98] border border-white/10"
                >
                  <span className="flex items-center gap-2">
                    Analyse Domain <ArrowRight className="w-5 h-5" />
                  </span>
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-700 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2 text-sm text-slate-400 px-3 py-1.5 rounded-full border border-slate-700/50">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Transparent prices. No markup.</span>
              </div>

              {/* Watch Demo - Redesigned to sit nicely in the footer of the card */}
              <button
                type="button"
                onClick={() => setDemoOpen(true)}
                className="group flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center group-hover:bg-teal-500 group-hover:scale-110 transition-all duration-300">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <span className="underline decoration-slate-600 underline-offset-4 group-hover:decoration-teal-400 transition-all">
                  Watch 1-min demo
                </span>
              </button>
            </div>
          </div>

          {/* Social Proof Badges - Moved outside main card for better aesthetics but kept in header */}
          <div
            className="mt-12 flex flex-col items-center animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
              Featured On
            </p>
            <div className="flex flex-wrap justify-center gap-6 items-center opacity-80 hover:opacity-100 transition-opacity duration-300">
              <a
                href="https://www.producthunt.com/products/namehunt?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-namehunt"
                target="_blank"
                className="hover:scale-105 transition-transform duration-300"
              >
                <img
                  src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1018702&theme=dark&t=1758538790646"
                  alt="NameHunt on Product Hunt"
                  style={{ width: "220px", height: "48px" }}
                  width="220"
                  height="48"
                />
              </a>
              <a
                href="https://peerlist.io/abhishekbr/project/namehunt"
                target="_blank"
                rel="noreferrer"
                className="hover:scale-105 transition-transform duration-300"
              >
                <img
                  src="https://peerlist.io/api/v1/projects/embed/PRJHDNDEKQARJPB88FA6OO7GAPKDDJ?showUpvote=true&theme=dark"
                  alt="NameHunt on Peerlist"
                  style={{ width: "220px", height: "48px" }}
                />
              </a>
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

      {/* Testimonials Section */}
      <section className="relative z-10 py-16 px-4 sm:px-6">
        <TestimonialsComponent />
      </section>

      <FAQ />

      <section className="w-full py-10">
        <div className="mx-auto max-w-5xl glass-card-gray rounded-2xl p-6 text-center">
          <h3 className="text-2xl font-semibold text-gray-100 mb-2">
            Ready to compare prices?
          </h3>
          <p className="text-gray-400 mb-4">
            Find the best deal in under a minute.
          </p>
          <Button
            onClick={() => searchRef?.current?.focus()}
            className="inline-flex items-center justify-center rounded-lg theme-button px-4 py-2 font-semibold text-black"
          >
            Start a search
          </Button>
        </div>
      </section>
      <DemoDialog
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        videoId="2xk4dPHinTo"
        title="NameHunt demo"
      />
      <FutureWork />
    </div>
  );
}
