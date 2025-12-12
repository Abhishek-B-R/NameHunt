/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";
import { ExternalLink, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  // Ensure document.body exists
  if (typeof document === "undefined") return null;
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
const LS_HIDE_HELP = "nh_hide_popup_help_v1";

export default function OpenOnRegistrarsButton({
  className,
  domain,
  buttonText = "Compare Manually",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [selected, setSelected] = useState<Record<ProviderKey, boolean>>(() =>
    getDefaultSelection()
  );
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const closePermissionDialog = () => {
    try {
      if (dontShowAgain) localStorage.setItem(LS_HIDE_HELP, "1");
    } catch {}
    setShowPermissionDialog(false);
  };

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

  const openMany = async (
    targets: { key: ProviderKey; url: string }[]
  ): Promise<{ opened: number; blocked: number; firstBlocked: boolean }> => {
    let opened = 0;
    let blocked = 0;
    let firstBlocked = false;

    for (let i = 0; i < targets.length; i++) {
      try {
        const w = window.open(targets[i].url, "_blank", "noopener,noreferrer");
        if (w && !w.closed) {
          opened++;
        } else {
          blocked++;
          if (i === 0) firstBlocked = true;
        }
      } catch {
        blocked++;
        if (i === 0) firstBlocked = true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return { opened, blocked, firstBlocked };
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
    if (!domain.trim()) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(selected));
      localStorage.setItem(LS_SEEN, "1");
    } catch {}
    setOpen(false);

    const chosen = urls;
    if (chosen.length === 0) return;

    setBusy(true);
    const result = await openMany(chosen);
    setBusy(false);

    if (result.firstBlocked && !shouldHidePopupHelp()) {
      setShowPermissionDialog(true);
    }
  };

  const shouldHidePopupHelp = () => {
    try {
      return localStorage.getItem(LS_HIDE_HELP) === "1";
    } catch {
      return false;
    }
  };

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "sm:flex-1 w-full text-base sm:text-lg font-bold rounded-2xl border border-white/10 hover:border-teal-500/50 bg-white/5 hover:bg-white/10 text-slate-200 active:scale-[0.99] py-2",
          busy && "opacity-70 cursor-not-allowed",
          className
        )}
        title={
          !domain.trim() ? "Enter a domain first" : "Compare on registrars"
        }
        disabled={busy || !domain.trim()}
      >
        {busy ? (
          "Opening..."
        ) : (
          <div className="flex justify-center items-center gap-3">
            {buttonText}
            <ExternalLink size={20} className="opacity-70" />
          </div>
        )}
      </button>

      {open && (
        <Dialog onClose={onCancel}>
          <div className="text-foreground">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  Compare Registrars
                </h3>
                <p className="text-slate-400 text-sm">
                  We&apos;ll open search pages for{" "}
                  <span className="text-teal-400 font-mono">{domain}</span>
                </p>
              </div>
              <button
                onClick={onCancel}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 mb-6">
              <h4 className="font-semibold text-amber-200 text-sm flex items-center gap-2">
                Important Note
              </h4>
              <ul className="list-disc pl-5 text-xs text-amber-100/70 mt-2 space-y-1">
                <li>
                  Browsers often block multiple popups. You may need to allow
                  them.
                </li>
                <li>
                  Check the address bar for a popup blocker icon if tabs
                  don&apos;t open.
                </li>
              </ul>
            </div>

            <div className="mb-4 flex items-center justify-between bg-white/5 p-3 rounded-xl">
              <div className="text-sm font-medium text-slate-300">
                Selected <span className="text-white">{selectedCount}</span> of{" "}
                {Object.keys(providerWebsites).length}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors border border-teal-500/20"
                  onClick={selectAll}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-slate-400 hover:bg-white/10 transition-colors border border-white/5"
                  onClick={clearAll}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {(Object.keys(providerWebsites) as ProviderKey[]).map((key) => (
                <label
                  key={key}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all",
                    selected[key]
                      ? "bg-teal-500/10 border-teal-500/30"
                      : "bg-black/40 border-white/10 hover:border-white/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        selected[key]
                          ? "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)]"
                          : "bg-slate-600"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        selected[key] ? "text-white" : "text-slate-400"
                      )}
                    >
                      {PROVIDER_LABELS[key]}
                    </span>
                  </div>
                  <Switch
                    checked={!!selected[key]}
                    onChange={() => onToggle(key)}
                  />
                </label>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-white/10">
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-teal-400 to-teal-600 hover:from-teal-400 hover:to-cyan-500 text-white shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                onClick={onOk}
              >
                Open {selectedCount} Sites
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {showPermissionDialog && (
        <Dialog onClose={closePermissionDialog}>
          <div className="text-foreground">
            <h3 className="text-xl md:text-2xl font-semibold text-teal-400 mb-2 text-center">
              Popup permission required
            </h3>

            <p className="text-sm md:text-base text-white/80 mb-3 text-center">
              Enable popups to open all the registrar websites in new tabs.
            </p>

            <div className="rounded-xl bg-black border border-white/10 p-3">
              <h4 className="font-semibold text-teal-400 mb-3 text-sm md:text-base text-center">
                How to allow popups
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg p-2 border border-white/10 bg-black">
                  <p className="text-xs md:text-sm text-white/80 mb-2 font-medium">
                    Method 1: Popup notification
                  </p>
                  <div className="h-44 md:h-56 w-full overflow-hidden rounded border border-white/10 bg-black">
                    <img
                      src="/popup.png"
                      alt="Browser popup notification"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>

                <div className="rounded-lg p-2 border border-white/10 bg-black">
                  <p className="text-xs md:text-sm text-white/80 mb-2 font-medium">
                    Method 2: Site settings
                  </p>
                  <div className="h-44 md:h-56 w-full overflow-hidden rounded border border-white/10 bg-black">
                    <img
                      src="/popup2.png"
                      alt="Site settings popup toggle"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2 select-none cursor-pointer text-sm text-white/80">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-teal-500"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                />
                <span>Don’t show this again</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 mt-8">
              <button
                type="button"
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm"
                onClick={closePermissionDialog}
              >
                Close
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl font-semibold bg-teal-600 hover:bg-teal-600 text-white text-sm"
                onClick={closePermissionDialog}
              >
                If it still doesn’t work, follow the steps above and reload
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
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in-up" />
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 animate-scale-in"
          style={{
            background:
              "linear-gradient(145deg, rgba(20,25,35,0.98), rgba(15,18,25,0.99))",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
        >
          {children}
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
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-teal-500" : "bg-slate-700"
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}
