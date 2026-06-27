"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import {
  CheckIcon,
  ChevronRightIcon,
  GlobeIcon,
  InfoIcon,
  LoaderCircleIcon,
  SearchIcon,
  ShieldIcon,
  XIcon,
} from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { locales, localeNames, localeCountryCodes, type Locale } from "@/i18n/locales";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import "flag-icons/css/flag-icons.min.css";

const COPY = {
  title:      { fr: "Choisir la langue",          nl: "Taal kiezen",                    en: "Choose language" },
  subtitle:   { fr: "Sélectionnez votre langue préférée pour continuer.",
                nl: "Selecteer uw voorkeurstaal om door te gaan.",
                en: "Select your preferred language to continue." },
  search:     { fr: "Rechercher une langue…",      nl: "Zoek een taal…",                 en: "Search a language…" },
  disclaimer: { fr: "Les traductions sont générées par IA et peuvent contenir des erreurs. La version française est la seule source officielle sans erreur.",
                nl: "Vertalingen zijn AI-gegenereerd en kunnen fouten bevatten. De Franse versie is de enige officiële bron zonder fouten.",
                en: "Translations are AI-generated and may contain errors. The French version is the only official error-free source." },
  privacy:    { fr: "Vos préférences linguistiques seront enregistrées.",
                nl: "Uw taalvoorkeur wordt opgeslagen.",
                en: "Your language preference will be saved." },
  cta:        { fr: "Continuer",                   nl: "Doorgaan",                       en: "Continue" },
  loading:    { fr: "Changement de langue…",       nl: "Taal wijzigen…",                 en: "Switching language…" },
  empty:      { fr: "Aucune langue trouvée.",      nl: "Geen taal gevonden.",             en: "No language found." },
};

function t(key: keyof typeof COPY, locale: string): string {
  const map = COPY[key] as Record<string, string>;
  return map[locale] ?? map.fr;
}

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
  const [selected, setSelected] = useState<Locale>(current);
  const [search, setSearch] = useState("");

  function handleOpenChange(v: boolean) {
    if (v) {
      setSelected(current);
      setSearch("");
    }
    setOpen(v);
  }

  function confirm() {
    if (selected === current) { setOpen(false); return; }
    setOpen(false);
    startTransition(async () => {
      await setLocale(selected);
      window.location.reload();
    });
  }

  const filtered = localeList.filter((l) =>
    localeNames[l].toLowerCase().includes(search.toLowerCase()),
  );

  /* Bouton fermer réutilisé dans les deux panneaux */
  const CloseBtn = () => (
    <DialogClose className="flex size-8 shrink-0 items-center justify-center rounded-lg opacity-60 transition-opacity hover:bg-accent hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
      <XIcon className="size-4" />
      <span className="sr-only">Fermer</span>
    </DialogClose>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${className}`}
          disabled={pending}
        >
          <span
            className={`fi fi-${localeCountryCodes[current]} rounded-sm`}
            style={{ width: "1.25em", height: "0.9375em", display: "inline-block" }}
          />
          {pending && <LoaderCircleIcon className="size-3.5 animate-spin opacity-60" />}
        </DialogTrigger>

        {/* showCloseButton=false : on gère notre propre croix pour éviter le chevauchement */}
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {/* Titre accessible (sr-only) — toujours dans le DOM */}
          <DialogTitle className="sr-only">{t("title", current)}</DialogTitle>

          <div className="flex h-[82dvh] flex-col sm:h-[520px] sm:flex-row">

            {/* ════ PANNEAU GAUCHE — desktop ════ */}
            <div className="hidden w-60 shrink-0 flex-col border-r bg-muted/20 p-6 sm:flex">
              {/* Globe + croix */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
                  <GlobeIcon className="size-6 text-primary" />
                </div>
                <CloseBtn />
              </div>

              <p aria-hidden="true" className="text-xl font-bold leading-tight">
                {t("title", current)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("subtitle", current)}
              </p>

              {/* Recherche */}
              <div className="relative mt-4">
                <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("search", current)}
                  className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {/* Disclaimer IA */}
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                <div className="flex gap-2">
                  <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                    {t("disclaimer", current)}
                  </p>
                </div>
              </div>

              {/* Note confidentialité */}
              <div className="mt-auto flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldIcon className="mt-0.5 size-4 shrink-0 text-primary/40" />
                <span>{t("privacy", current)}</span>
              </div>
            </div>

            {/* ════ EN-TÊTE COMPACT — mobile ════ */}
            <div className="flex shrink-0 items-center gap-3 border-b p-4 sm:hidden">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                <GlobeIcon className="size-4 text-primary" />
              </div>
              <p aria-hidden="true" className="flex-1 text-base font-bold">
                {t("title", current)}
              </p>
              <CloseBtn />
            </div>

            {/* ════ RECHERCHE + DISCLAIMER — mobile ════ */}
            <div className="shrink-0 space-y-2 p-3 sm:hidden">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("search", current)}
                  className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  {t("disclaimer", current)}
                </p>
              </div>
            </div>

            {/* ════ LISTE DES LANGUES ════ */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {filtered.map((l) => {
                  const isActive = l === selected;
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setSelected(l)}
                      className={`flex w-full items-center gap-3 border-b px-4 py-3.5 text-left text-sm transition-colors last:border-0 hover:bg-accent/60 ${
                        isActive ? "bg-primary/5" : ""
                      }`}
                    >
                      <span
                        className={`fi fi-${localeCountryCodes[l]} shrink-0 rounded-sm shadow-sm`}
                        style={{ width: "1.5em", height: "1.125em", display: "inline-block" }}
                      />
                      <span className="flex-1 font-medium">{localeNames[l]}</span>
                      {isActive ? (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
                          <CheckIcon className="size-3.5 text-primary-foreground" />
                        </span>
                      ) : (
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {t("empty", current)}
                  </p>
                )}
              </div>

              {/* Pied : note confidentialité (mobile) + bouton Continuer */}
              <div className="flex shrink-0 items-center justify-between border-t p-4">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:hidden">
                  <ShieldIcon className="size-3.5 shrink-0 text-primary/40" />
                  <span>{t("privacy", current)}</span>
                </div>
                <Button onClick={confirm} disabled={pending} className="ml-auto">
                  {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
                  {t("cta", current)} →
                </Button>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {pending && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-sm transition-opacity">
          <div className="flex items-center gap-3 rounded-xl bg-card px-5 py-3 shadow-lg ring-1 ring-border">
            <LoaderCircleIcon className="size-5 animate-spin text-primary" />
            <span className="text-sm font-medium">{t("loading", current)}</span>
          </div>
        </div>
      )}
    </>
  );
}
