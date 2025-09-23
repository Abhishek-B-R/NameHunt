import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

export function FAQ() {
  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-100">
        Frequently asked questions
      </h2>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="registrars">
          <AccordionTrigger>Which registrars do you check?</AccordionTrigger>
          <AccordionContent>
            We query GoDaddy, Namecheap, Squarespace, Hostinger, Network Solutions,
            Name.com, Porkbun, IONOS, Hover, Dynadot, NameSilo, and Spaceship. Some may
            time out or be temporarily unavailable; results stream as they arrive.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="freshness">
          <AccordionTrigger>How up-to-date is the pricing?</AccordionTrigger>
          <AccordionContent>
            Pricing is fetched live per request from each registrar. If a provider blocks
            or rate-limits, we show an error or cached fallback for a short period.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="account">
          <AccordionTrigger>Do I need an account to search?</AccordionTrigger>
          <AccordionContent>
            No account needed for searching. Registering a domain redirects you to the
            registrar checkout where you may need an account.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="currency">
          <AccordionTrigger>Do you support currency conversion?</AccordionTrigger>
          <AccordionContent>
            Yes. Prices are converted on the fly to your selected currency using current
            FX rates. We also show the original currency for transparency.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="seo-captcha">
          <AccordionTrigger>Will this affect SEO or trigger captchas?</AccordionTrigger>
          <AccordionContent>
            Searches are performed server-side with throttling and provider‑friendly
            settings. If a provider triggers a captcha, we skip it and show an error
            rather than looping.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="register-here">
          <AccordionTrigger>Can I register the domain here?</AccordionTrigger>
          <AccordionContent>
            We don’t sell domains. Clicking Register takes you to the registrar’s
            checkout with the domain prefilled when possible.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="errors">
          <AccordionTrigger>Why do some providers show errors or timeouts?</AccordionTrigger>
          <AccordionContent>
            Registrars rate‑limit, change markup, or block automation occasionally.
            When that happens we return a clear error for that provider and keep
            streaming others. You can retry or proceed with providers that succeeded.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  )
}