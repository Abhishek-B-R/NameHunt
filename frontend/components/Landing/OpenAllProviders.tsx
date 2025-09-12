import React, { useMemo, useState } from "react";

type Props = {
  className?: string;
  domain: string;
  buttonText?: string;
};

const providerWebsites: Record<string, string> = {
  godaddy: "https://www.godaddy.com/domainsearch/find?domainToCheck=",
  namecheap: "https://www.namecheap.com/domains/registration/results/?domain=",
  squarespace: "https://domains.squarespace.com/domain-search?query=",
  hostinger: "https://www.hostinger.com/domain-name-results?domain=",
  networksolutions:
    "https://www.networksolutions.com/products/domain/domain-search-results?domainName=",
  namecom: "https://www.name.com/domain/search/",
  porkbun: "https://porkbun.com/checkout/search?q=",
  ionos:
    "https://www.ionos.com/domainshop/search?skipContractSelection=true&domains=",
  hover: "https://www.hover.com/domains/results?q=",
  dynadot: "https://www.dynadot.com/?domain=",
  namesilo: "https://www.namesilo.com/domain/search-domains?query=",
  spaceship: "https://www.spaceship.com/domain-search/?beast=false&query=",
};

export default function OpenOnRegistrarsButton({
  className,
  domain,
  buttonText = "Compare Manually",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const urls = useMemo(() => {
    const clean = domain.trim();
    if (!clean) return [];
    const encoded = encodeURIComponent(clean);
    return Object.entries(providerWebsites).map(([key, base]) => {
      return { key, url: `${base}${encoded}` };
    });
  }, [domain]);

  const handleClick = async () => {
    if (!urls.length || busy) return;
    setBusy(true);
    setResult(null);

    let opened = 0;
    let blocked = 0;

    for (let i = 0; i < urls.length; i++) {
      const { url } = urls[i];
      try {
        const w = window.open(url, "_blank", "noopener,noreferrer");
        if (w && !w.closed) opened++;
        else blocked++;
      } catch {
        blocked++;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    setBusy(false);
    setResult(
      blocked > 0
        ? `Opened ${opened}/${urls.length}. ${blocked} blocked by popup settings.`
        : `Opened all ${opened} registrar pages.`
    );
    setTimeout(() => setResult(null), 4000);
  };

  return (
    <>
      <button
        onClick={handleClick}
        title={
          urls.length === 0
            ? "Enter a domain first"
            : busy
            ? "Opening..."
            : "Open on all registrars"
        }
        className={[
          // base look aligned with your Analyse button
          "w-full px-4 py-4 text-base sm:text-lg font-semibold rounded-2xl theme-button",
          "transition active:scale-[0.99]",
          "cursor-pointer",
          className || "",
        ].join(" ")}
      >
        {busy ? "Opening..." : buttonText}
      </button>
      {result && (
        <div className="mt-2 text-sm text-neutral-300/90">{result}</div>
      )}
    </>
  );
}
