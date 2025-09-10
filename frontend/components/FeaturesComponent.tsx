import SpotlightCard from "@/components/SpotlightCard";
import { Zap, Globe, DollarSign } from "lucide-react";

export default function FeaturesComponent() {
  return (
    <section className="relative mt-8 z-10 w-full overflow-x-hidden px-4 sm:px-6 lg:px-10 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Card 1 */}
          <SpotlightCard
            className="
              group relative rounded-2xl p-6 sm:p-7
              bg-gradient-to-b from-white to-slate-50
              border border-slate-800/70
              shadow-[0_6px_30px_-12px_rgba(0,0,0,0.18)]
              ring-1 ring-black/[0.02]
              transition-all duration-300
              hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)]
              dark:from-[#0b1220] dark:to-[#0a101b]
              dark:border-white/10
              dark:ring-white/5
              dark:shadow-[0_10px_50px_-20px_rgba(0,0,0,0.6)]
              dark:hover:ring-white/10
            "
            spotlightColor="rgba(45, 212, 191, 0.35)"
          >
            <div className="relative z-10 text-center">
              <div className="mb-4 mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-500/20">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                Live pricing comparison
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Real-time prices from top registrars in one place.
              </p>
            </div>
          </SpotlightCard>

          {/* Card 2 */}
          <SpotlightCard
            className="
              group relative rounded-2xl p-6 sm:p-7
              bg-gradient-to-b from-white to-slate-50
              border border-slate-800/70
              shadow-[0_6px_30px_-12px_rgba(0,0,0,0.18)]
              ring-1 ring-black/[0.02]
              transition-all duration-300
              hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)]
              dark:from-[#0a131f] dark:to-[#08111b]
              dark:border-white/10
              dark:ring-white/5
              dark:shadow-[0_10px_50px_-20px_rgba(0,0,0,0.6)]
              dark:hover:ring-white/10
            "
            spotlightColor="rgba(56, 189, 248, 0.35)"
          >
            <div className="relative z-10 text-center">
              <div className="mb-4 mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-sky-500/20">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                Fast and reliable
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Blazing fast lookups with native-feel scrolling.
              </p>
            </div>
          </SpotlightCard>

          {/* Card 3 */}
          <SpotlightCard
            className="
              group relative rounded-2xl p-6 sm:p-7
              bg-gradient-to-b from-white to-slate-50
              border border-slate-800/70
              shadow-[0_6px_30px_-12px_rgba(0,0,0,0.18)]
              ring-1 ring-black/[0.02]
              transition-all duration-300
              hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)]
              dark:from-[#081712] dark:to-[#071510]
              dark:border-white/10
              dark:ring-white/5
              dark:shadow-[0_10px_50px_-20px_rgba(0,0,0,0.6)]
              dark:hover:ring-white/10
            "
            spotlightColor="rgba(16, 185, 129, 0.35)"
          >
            <div className="relative z-10 text-center">
              <div className="mb-4 mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                <DollarSign className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                Transparent, no markup
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                The exact price you will pay. No hidden fees.
              </p>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}