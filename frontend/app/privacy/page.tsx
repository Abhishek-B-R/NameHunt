"use client"

export default function Privacy() {
  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-12 bg-black">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-teal-400">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm opacity-70">
            Last updated {new Date().toLocaleDateString()}
          </p>
        </header>

        <section className="backdrop-blur-md bg-opacity-10 bg-white dark:bg-opacity-10 dark:bg-black rounded-2xl p-6 sm:p-8 shadow-lg">
          <div className="space-y-8">
            <p className="leading-relaxed">
              We respect your privacy. We don&#39;t sell or share personal data. Searches
              are processed server-side to fetch live availability and pricing from
              registrars. Registration and payment happen on registrar websites and are
              subject to their policies.
            </p>

            <div className="border-t border-opacity-10 pt-6">
              <h2 className="text-lg font-semibold text-teal-400 mb-3">
                What we may collect
              </h2>
              <ul className="list-disc pl-5 space-y-2 text-sm opacity-80">
                <li>
                  Anonymous event logs like timestamps, provider latency, and error
                  rates to improve reliability and performance.
                </li>
                <li>
                  Aggregated metrics such as success/timeout ratios and median search
                  time. No user profiles are created.
                </li>
              </ul>
            </div>

            <div className="border-t border-opacity-10 pt-6">
              <h2 className="text-lg font-semibold text-teal-400 mb-3">
                What we do not collect
              </h2>
              <ul className="list-disc pl-5 space-y-2 text-sm opacity-80">
                <li>No account is required to search.</li>
                <li>No payment details are handled by us.</li>
                <li>No third-party ad trackers.</li>
              </ul>
            </div>

            <div className="border-t border-opacity-10 pt-6">
              <h2 className="text-lg font-semibold text-teal-400 mb-3">
                Cookies and storage
              </h2>
              <p className="text-sm opacity-80">
                We may use a lightweight cookie or local storage to remember preferences
                like theme or currency. These do not track you across sites.
              </p>
            </div>

            <div className="border-t border-opacity-10 pt-6">
              <h2 className="text-lg font-semibold text-teal-400 mb-3">
                Data retention
              </h2>
              <p className="text-sm opacity-80">
                Anonymous logs are kept only as long as necessary for debugging and
                service quality, then discarded.
              </p>
            </div>

            <div className="border-t border-opacity-10 pt-6">
              <h2 className="text-lg font-semibold text-teal-400 mb-3">
                Questions
              </h2>
              <p className="text-sm opacity-80">
                Have a concern or request? Reach out at{" "}
                <a
                  href="mailto:abhishek.br.work@gmail.com"
                  className="text-teal-400 hover:text-teal-300 transition-colors"
                >
                  abhishek.br.work@gmail.com
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}