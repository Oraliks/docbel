"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { CheckIcon, GlobeIcon, InfoIcon, LoaderCircleIcon } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { locales, localeNames, localeCountryCodes, type Locale } from "@/i18n/locales";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import "flag-icons/css/flag-icons.min.css";

export function LocaleSwitcher({
  localeList = locales,
  className = "",
}: {
  localeList?: readonly Locale[];
  className?: string;
} = {}) {
  const current = useLocale() as Locale;
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function switchTo(next: Locale) {
    if (next === current) return;
    setOpen(false);
    startTransition(async () => {
      await setLocale(next);
      window.location.reload();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${className}`}
          disabled={pending}
        >
          <span
            className={`fi fi-${localeCountryCodes[current]} rounded-sm`}
            style={{ width: "1.25em", height: "0.9375em", display: "inline-block" }}
          />
          {pending && (
            <LoaderCircleIcon className="size-3.5 animate-spin opacity-60" />
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GlobeIcon className="size-5" />
              {current === "nl"
                ? "Taal kiezen"
                : current === "en"
                  ? "Choose language"
                  : "Choisir la langue"}
            </DialogTitle>
          </DialogHeader>
          <div
            className={`grid gap-2 ${
              localeList.length <= 4
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3"
            }`}
          >
            {localeList.map((l) => {
              const isActive = l === current;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => switchTo(l)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border hover:border-primary/40 hover:bg-accent"
                  }`}
                >
                  <span
                    className={`fi fi-${localeCountryCodes[l]} shrink-0 rounded-sm shadow-sm`}
                    style={{ width: "1.5em", height: "1.125em", display: "inline-block" }}
                  />
                  <span className="flex-1">{localeNames[l]}</span>
                  {isActive && (
                    <CheckIcon className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
            <p>
              {current === "nl"
                ? "Vertalingen zijn AI-gegenereerd en kunnen fouten bevatten. De Franse versie is de enige officiële bron zonder fouten."
                : current === "en"
                  ? "Translations are AI-generated and may contain errors. The French version is the only official error-free source."
                  : "Les traductions sont générées par IA et peuvent contenir des erreurs. La version française est la seule source officielle sans erreur."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {pending && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-sm transition-opacity">
          <div className="flex items-center gap-3 rounded-xl bg-card px-5 py-3 shadow-lg ring-1 ring-border">
            <LoaderCircleIcon className="size-5 animate-spin text-primary" />
            <span className="text-sm font-medium">
              {current === "fr"
                ? "Changement de langue…"
                : current === "nl"
                  ? "Taal wijzigen…"
                  : "Switching language…"}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
