"use client";

import { useEffect, useState } from "react";
import { GlobeIcon, CheckIcon } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { publicLocales, localeNames, defaultLocale, type Locale } from "@/i18n/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import "flag-icons/css/flag-icons.min.css";

const LS_KEY = "beldoc.locale.chosen";

const FLAG: Record<string, string> = {
  fr: "fr",
  nl: "nl",
  en: "gb",
};

export function WelcomeLocaleModal() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    try {
      if (!localStorage.getItem(LS_KEY)) setOpen(true);
    } catch {}
  }, []);

  async function choose(locale: Locale) {
    if (pending) return;
    setPending(true);
    try {
      localStorage.setItem(LS_KEY, locale);
      await setLocale(locale);
      if (locale !== defaultLocale) {
        window.location.reload();
      } else {
        setOpen(false);
        setPending(false);
      }
    } catch {
      setPending(false);
    }
  }

  // Dismiss via Escape → save FR default silently
  function handleOpenChange(next: boolean) {
    if (!next && !pending) {
      try {
        localStorage.setItem(LS_KEY, defaultLocale);
      } catch {}
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xs" showCloseButton={false}>
        <DialogHeader className="items-center text-center">
          <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-primary/10">
            <GlobeIcon className="size-5 text-primary" />
          </div>
          <DialogTitle className="text-base">
            Choisissez votre langue
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Kies uw taal &middot; Choose your language
          </p>
        </DialogHeader>

        <div className="mt-1 grid grid-cols-1 gap-2">
          {publicLocales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => choose(l)}
              disabled={pending}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 ${
                l === defaultLocale
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border hover:border-primary/40 hover:bg-accent"
              }`}
            >
              <span
                className={`fi fi-${FLAG[l] ?? l} shrink-0 rounded-sm shadow-sm`}
                style={{ width: "1.5em", height: "1.125em", display: "inline-block" }}
              />
              <span className="flex-1">{localeNames[l]}</span>
              {l === defaultLocale && (
                <CheckIcon className="size-4 shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/60">
          Vous pourrez changer la langue à tout moment.
        </p>
      </DialogContent>
    </Dialog>
  );
}
