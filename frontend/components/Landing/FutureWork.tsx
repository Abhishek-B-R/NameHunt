export default function FutureWork() {
  return (
    <section className="w-full py-12">
      <div className="mx-auto max-w-5xl glass-card rounded-3xl p-6 sm:p-8">
        <header className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-semibold gradient-text">
            What’s next
          </h2>
          <p className="mt-2 text-medium-contrast">
            A short roadmap to make NameHunt faster and more useful.
          </p>
        </header>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/15 backdrop-blur-md p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 shrink-0 rounded-xl bg-teal-500/20 ring-1 ring-teal-400/30 flex items-center justify-center">
                <span className="text-teal-300 text-sm font-semibold">1</span>
              </div>
              <div className="flex-1">
                <h3 className="text-high-contrast font-semibold">
                  Add more registrar providers
                </h3>
                <p className="text-medium-contrast mt-1">
                  I’ll add more providers as usage grows. If there’s a registrar
                  you rely on, ping me and I’ll prioritize it.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 backdrop-blur-md p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 shrink-0 rounded-xl bg-sky-500/20 ring-1 ring-sky-400/30 flex items-center justify-center">
                <span className="text-sky-300 text-sm font-semibold">2</span>
              </div>
              <div className="flex-1">
                <h3 className="text-high-contrast font-semibold">
                  Official SDKs and faster fetching
                </h3>
                <p className="text-medium-contrast mt-1">
                  Right now, only name.com, NameSilo, and Hostinger are
                  integrated via their official SDKs. The rest are fetched by
                  headless browsing. I’ll adopt more official SDKs as providers
                  make them freely available, and integrate them to reduce
                  response times and improve reliability.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 backdrop-blur-md p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 shrink-0 rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/30 flex items-center justify-center">
                <span className="text-emerald-300 text-sm font-semibold">
                  3
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-high-contrast font-semibold">
                  Explore new sections and tools
                </h3>
                <p className="text-medium-contrast mt-1">
                  I’ll keep researching and brainstorming features like
                  watchlists, renewal reminders, bulk checks, and alerts to make
                  this genuinely useful for builders and founders.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 backdrop-blur-md p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-high-contrast font-semibold">
                  Found a bug or have a request?
                </h3>
                <p className="text-subtle-contrast mt-1">
                  Your feedback helps shape the roadmap. Thank you.
                </p>
              </div>
              <a
                href="https://x.com/abhi__br"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold theme-button"
              >
                Report on X/Twitter
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-white/10" />

        <p className="mt-4 text-center text-sm text-subtle-contrast">
          If you want a specific registrar supported, DM me with your list and
          use case. I prioritize based on real demand.
        </p>
      </div>
    </section>
  );
}
