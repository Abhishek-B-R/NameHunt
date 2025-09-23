"use client"

import { Zap, Globe, DollarSign } from "lucide-react"
import { CanvasRevealEffect } from "@/components/ui/canvas-reveal-effect"

export default function Features() {
  return (
    <section className="relative z-10 w-full px-4 sm:px-6 lg:px-10 py-12 mt-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Card 1 */}
          <FeatureCard
            title="Live pricing comparison"
            description="Real-time prices from top registrars in one place."
            icon={<Zap className="h-6 w-6" />}
          >
            <CanvasRevealEffect
              animationSpeed={4.2}
              colors={[[45, 212, 191]]} 
              dotSize={2}
              containerClassName="bg-[#07332f]" 
              showGradient={false}
            />
            <FadeMask />
          </FeatureCard>

          {/* Card 2 */}
          <FeatureCard
            title="Fast and reliable"
            description="Blazing fast lookups with native-feel scrolling."
            icon={<Globe className="h-6 w-6" />}
          >
            <CanvasRevealEffect
              animationSpeed={3.4}
              colors={[
                [56, 189, 248], // sky
                [59, 130, 246], // blue
              ]}
              dotSize={2}
              containerClassName="bg-[#0a1423]"
              showGradient={false}
            />
            <FadeMask />
          </FeatureCard>

          {/* Card 3 */}
          <FeatureCard
            title="Transparent, no markup"
            description="The exact price you will pay. No hidden fees."
            icon={<DollarSign className="h-6 w-6" />}
          >
            <CanvasRevealEffect
              animationSpeed={3.2}
              colors={[[16, 185, 129]]} // emerald
              dotSize={2}
              containerClassName="bg-[#071510]"
              showGradient={false}
            />
            <FadeMask />
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="
        group relative overflow-hidden rounded-2xl
        border border-white/10
      bg-white/[0.03]
        ring-1 ring-white/[0.04]
        shadow-[0_10px_50px_-20px_rgba(0,0,0,0.6)]
        hover:ring-white/10 transition-colors
      "
    >
      {/* Animated canvas background */}
      <div className="absolute inset-0 opacity-60 group-hover:opacity-80 transition-opacity">
        {children}
      </div>

      {/* Content overlay */}
      <div className="relative z-10 p-6 sm:p-7 text-center">
        <div
          className="
            mb-4 mx-auto flex h-12 w-12 items-center justify-center rounded-xl
            bg-gradient-to-br text-white
            shadow-lg shadow-teal-500/20
            from-teal-600 to-teal-700
          "
        >
          {icon}
        </div>
        <h3 className="mb-2 text-lg font-semibold text-white">
          {title}
        </h3>
        <p className="text-sm text-slate-300">
          {description}
        </p>
      </div>

      {/* Subtle top sheen */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
    </div>
  )
}

function FadeMask() {
  // Soft radial mask so the canvas doesn’t dominate
  return (
    <div className="absolute inset-0 [mask-image:radial-gradient(420px_at_center,white,transparent)] bg-black/70" />
  )
}