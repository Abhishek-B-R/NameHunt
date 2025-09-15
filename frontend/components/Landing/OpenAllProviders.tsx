import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

type Props = {
  className?: string;
  domain: string;
  buttonText?: string;
};

type ProviderKey =
  | "godaddy"
  | "namecheap"
  | "squarespace"
  | "hostinger"
  | "networksolutions"
  | "namecom"
  | "porkbun"
  | "ionos"
  | "hover"
  | "dynadot"
  | "namesilo"
  | "spaceship";

const providerWebsites: Record<ProviderKey, string> = {
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

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  godaddy: "GoDaddy",
  namecheap: "Namecheap",
  squarespace: "Squarespace",
  hostinger: "Hostinger",
  networksolutions: "Network Solutions",
  namecom: "Name.com",
  porkbun: "Porkbun",
  ionos: "IONOS",
  hover: "Hover",
  dynadot: "Dynadot",
  namesilo: "NameSilo",
  spaceship: "Spaceship",
};

const LS_KEY = "nh_selected_providers_v1";
const LS_SEEN = "nh_seen_popup_instructions_v1";

export default function OpenOnRegistrarsButton({
  className,
  domain,
  buttonText = "Compare Manually",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<ProviderKey, boolean>>(() =>
    getDefaultSelection()
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        const fixed = { ...getDefaultSelection() };
        (Object.keys(fixed) as ProviderKey[]).forEach((k) => {
          if (typeof parsed[k] === "boolean") fixed[k] = parsed[k]!;
        });
        setSelected(fixed);
      }
    } catch {}
  }, []);

  const urls = useMemo(() => {
    const clean = domain.trim();
    if (!clean) return [];
    const encoded = encodeURIComponent(clean);
    return (Object.keys(providerWebsites) as ProviderKey[])
      .filter((k) => selected[k])
      .map((key) => ({ key, url: `${providerWebsites[key]}${encoded}` }));
  }, [domain, selected]);

  const openMany = async (targets: { key: ProviderKey; url: string }[]) => {
    let opened = 0;
    let blocked = 0;
    for (let i = 0; i < targets.length; i++) {
      try {
        const w = window.open(targets[i].url, "_blank", "noopener,noreferrer");
        if (w && !w.closed) opened++;
        else blocked++;
      } catch {
        blocked++;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return { opened, blocked };
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!domain.trim() || busy) return;
    setOpen(true);
  };

  const onToggle = (k: ProviderKey) =>
    setSelected((s) => ({ ...s, [k]: !s[k] }));

  const selectAll = () =>
    setSelected((s) => {
      const out = { ...s };
      (Object.keys(out) as ProviderKey[]).forEach((k) => (out[k] = true));
      return out;
    });

  const clearAll = () =>
    setSelected((s) => {
      const out = { ...s };
      (Object.keys(out) as ProviderKey[]).forEach((k) => (out[k] = false));
      return out;
    });

  const onCancel = () => setOpen(false);

  const onOk = async () => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(selected));
      localStorage.setItem(LS_SEEN, "1");
    } catch {}
    setOpen(false);

    const chosen = urls;
    if (chosen.length === 0) return;

    setBusy(true);
    await openMany(chosen);
    setBusy(false);
  };

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  return (
    <>
      <button
        onClick={handleClick}
        className={[
          "flex-1 w-full sm:text-lg font-semibold rounded-2xl",
          "transition active:scale-[0.99]",
          className || "",
        ].join(" ")}
        title={
          !domain.trim() ? "Enter a domain first" : "Compare on registrars"
        }
      >
        {busy
          ? "Opening..."
          : selectedCount > 0
          ? `${buttonText}`
          : buttonText}
      </button>

      {open && (
        <Dialog onClose={onCancel}>
          <div className="text-foreground">
            <h3 className="text-xl font-semibold text-high-contrast mb-1.5">
              Compare across registrars
            </h3>
            <p className="text-medium-contrast text-sm mb-4">
              We will open the selected registrar search pages for
              <span className="font-semibold"> {domain} </span>
              in new tabs.
            </p>

            <div className="rounded-xl border border-white/14 bg-black px-4 py-3 mb-4">
              <h4 className="font-semibold text-high-contrast">Important</h4>
              <ul className="list-disc pl-5 text-sm text-subtle-contrast mt-1 space-y-1">
                <li>Browsers often block multiple popups by default.</li>
                <li>
                  When prompted, click the popup icon in the address bar and
                  allow popups for this site.
                </li>
                <li>You can choose exactly which providers to open below.</li>
              </ul>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm text-subtle-contrast">
                Selected {selectedCount} of{" "}
                {Object.keys(providerWebsites).length}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1 rounded-lg text-sm theme-button"
                  onClick={selectAll}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded-lg text-sm bg-white/10 hover:bg-white/15"
                  onClick={clearAll}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-auto pr-1">
              {(Object.keys(providerWebsites) as ProviderKey[]).map((key) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-black px-3 py-2"
                >
                  <span className="text-sm">{PROVIDER_LABELS[key]}</span>
                  <Switch
                    checked={!!selected[key]}
                    onChange={() => onToggle(key)}
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl font-semibold bg-teal-500 hover:bg-teal-600 text-white shadow-lg hover:shadow-xl "
                onClick={onOk}
              >
                OK
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}

function getDefaultSelection(): Record<ProviderKey, boolean> {
  return {
    godaddy: true,
    namecheap: true,
    squarespace: true,
    hostinger: true,
    networksolutions: false,
    namecom: true,
    porkbun: false,
    ionos: false,
    hover: false,
    dynadot: true,
    namesilo: true,
    spaceship: true,
  };
}

function Dialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70" />
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-[50vw] h-[70vh] rounded-2xl p-5 sm:p-6 shadow-2xl border border-white/12 overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(19,25,38,0.98), rgba(19,25,38,0.96))",
          }}
        >
          <div className="h-full overflow-auto">{children}</div>
        </div>
      </div>
    </Portal>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={[
        "relative inline-flex h-6 w-11 items-center rounded-full transition",
        checked ? "bg-teal-500" : "bg-white/15",
      ].join(" ")}
      aria-pressed={checked}
    >
      <span
        className={[
          "inline-block h-5 w-5 transform rounded-full bg-white transition",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}
