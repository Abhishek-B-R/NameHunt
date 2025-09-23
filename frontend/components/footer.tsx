"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-border bg-black">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Top row: brand + primary links */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-muted-foreground">
            <span className="font-semibold text-foreground">NameHunt</span>
            <span className="text-muted-foreground">
              {" "}
              • Live domain pricing
            </span>
          </div>

          <nav className="flex items-center gap-5 text-sm">
            {/* If you don’t have a privacy page yet, you can comment this out */}
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <a
              href="https://github.com/Abhishek-B-R"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://twitter.com/abhi__br"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Twitter
            </a>
            <a
              href="mailto:abhishek.br.work@gmail.com"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Email
            </a>
          </nav>
        </div>

        {/* Middle row: project repo callout */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Built with a streaming SSE backend and live registrar lookups.
          </div>
          <a
            href="https://github.com/Abhishek-B-R/NameHunt"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-teal-400 hover:text-teal-300"
          >
            View project on GitHub →
          </a>
        </div>

        {/* Bottom row: fine print */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            © {new Date().getFullYear()} NameHunt. No markup added. Prices and
            availability are shown as reported by registrars.
          </div>
          <div className="text-muted-foreground">
            Made by Abhishek • CSE student · full‑stack & blockchain dev
          </div>
        </div>
      </div>
    </footer>
  );
}
