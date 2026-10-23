"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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

// Identité stable entre deux saisies : le bouton ne doit pas être remonté
// à chaque rendu du sélecteur et perdre son focus clavier.
function LocaleCloseButton() {
  const translate = useTranslations("public.dossier");
  return (
    <DialogClose className="flex size-11 shrink-0 items-center justify-center rounded-lg opacity-60 transition-opacity hover:bg-accent hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
      <XIcon className="size-4" />
      <span className="sr-only">{translate("close")}</span>
    </DialogClose>
  );
}

export function LocaleSwitcher({
  localeList = locales,
  className = "",
  compact = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  renderTrigger = true,
}: {
  localeList?: readonly Locale[];
  className?: string;
  /** Espacement réduit pour les emplacements discrets, nom de langue toujours visible. */
  compact?: boolean;
  /** Ouverture pilotée par le parent (ex: item de menu). Si fourni, le composant
   *  devient contrôlé et n'utilise plus son state interne. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** false = ne rend pas le déclencheur (le parent ouvre le dialog). */
  renderTrigger?: boolean;
} = {}) {
  const current = useLocale() as Locale;
  const t = useTranslations("public.localeSwitcher");
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const [selected, setSelected] = useState<Locale>(current);
  const [search, setSearch] = useState("");

  function handleOpenChange(v: boolean) {
    setError(false);
    if (v) {
      setSelected(current);
      setSearch("");
    }
    if (isControlled) controlledOnOpenChange?.(v);
    else setInternalOpen(v);
  }

  function confirm() {
    if (selected === current) { handleOpenChange(false); return; }
    setError(false);
    startTransition(async () => {
      try {
        await setLocale(selected);
        router.refresh();
        handleOpenChange(false);
      } catch {
        setError(true);
      }
    });
  }

  const filtered = localeList.filter((l) =>
    localeNames[l].toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {renderTrigger && (
          <DialogTrigger
            aria-label={`${t("title")} : ${localeNames[current]}`}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
              compact ? "px-1.5 py-1 text-xs" : "px-2.5 py-1.5 text-sm"
            } ${className}`}
            disabled={pending}
          >
            <GlobeIcon className="size-4 shrink-0" aria-hidden />
            <bdi lang={current}>{localeNames[current]}</bdi>
            {pending && <LoaderCircleIcon className="size-3.5 animate-spin opacity-60" />}
          </DialogTrigger>
        )}

        {/* showCloseButton=false : on gère notre propre croix pour éviter le chevauchement */}
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {/* Titre accessible (sr-only) — toujours dans le DOM */}
          <DialogTitle className="sr-only">{t("title")}</DialogTitle>

          <div className="flex h-[82dvh] max-h-[calc(100dvh-2rem)] flex-col sm:h-[520px] sm:flex-row">

            {/* ════ PANNEAU GAUCHE — desktop ════ */}
            <div className="hidden w-60 shrink-0 flex-col overflow-y-auto border-e bg-muted/20 p-6 sm:flex">
              {/* Globe + croix */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
                  <GlobeIcon className="size-6 text-primary" />
                </div>
                <LocaleCloseButton />
              </div>

              <p aria-hidden="true" className="text-xl font-bold leading-tight">
                {t("title")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("subtitle")}
              </p>

              {/* Recherche */}
              <div className="relative mt-4">
                <SearchIcon className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={t("search")}
                  placeholder={t("search")}
                  className="min-h-11 w-full rounded-lg border bg-background py-2 ps-8 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {/* Disclaimer IA */}
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                <div className="flex gap-2">
                  <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                    {t("disclaimer")}
                  </p>
                </div>
              </div>

              {/* Note confidentialité */}
              <div className="mt-auto flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldIcon className="mt-0.5 size-4 shrink-0 text-primary/40" />
                <span>{t("privacy")}</span>
              </div>
            </div>

            {/* ════ EN-TÊTE COMPACT — mobile ════ */}
            <div className="flex shrink-0 items-center gap-3 border-b p-4 sm:hidden">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                <GlobeIcon className="size-4 text-primary" />
              </div>
              <p aria-hidden="true" className="flex-1 text-base font-bold">
                {t("title")}
              </p>
              <LocaleCloseButton />
            </div>

            {/* ════ RECHERCHE + DISCLAIMER — mobile ════ */}
            <div className="shrink-0 space-y-2 p-3 sm:hidden">
              <div className="relative">
                <SearchIcon className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={t("search")}
                  placeholder={t("search")}
                  className="min-h-11 w-full rounded-lg border bg-background py-2 ps-8 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  {t("disclaimer")}
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
                      aria-pressed={isActive}
                      className={`flex w-full items-center gap-3 border-b px-4 py-3.5 text-start text-sm transition-colors last:border-0 hover:bg-accent/60 ${
                        isActive ? "bg-primary/5" : ""
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`fi fi-${localeCountryCodes[l]} shrink-0 rounded-sm shadow-sm`}
                        style={{ width: "1.5em", height: "1.125em", display: "inline-block" }}
                      />
                      <bdi lang={l} className="flex-1 font-medium">{localeNames[l]}</bdi>
                      {isActive ? (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
                          <CheckIcon className="size-3.5 text-primary-foreground" />
                        </span>
                      ) : (
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {t("empty")}
                  </p>
                )}
              </div>

              {error && <p role="alert" className="px-4 py-2 text-sm text-destructive">{t("error")}</p>}

              {/* Pied : note confidentialité (mobile) + bouton Continuer */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t p-4">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:hidden">
                  <ShieldIcon className="size-3.5 shrink-0 text-primary/40" />
                  <span>{t("privacy")}</span>
                </div>
                <Button onClick={confirm} disabled={pending} className="ms-auto min-h-11">
                  {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
                  {t("cta")}
                </Button>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {pending && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-sm transition-opacity">
          <div className="flex items-center gap-3 rounded-xl bg-card px-5 py-3 shadow-lg ring-1 ring-border">
            <LoaderCircleIcon className="size-5 animate-spin text-primary" />
            <span className="text-sm font-medium">{t("loading")}</span>
          </div>
        </div>
      )}
    </>
  );
}
