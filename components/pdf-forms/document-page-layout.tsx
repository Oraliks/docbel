"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ClockIcon,
  ShieldCheckIcon,
  HelpCircleIcon,
  ChevronRightIcon,
  UserIcon,
  SparklesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PdfFormRunner } from "./pdf-form-runner";
import type { PublicForm } from "@/lib/pdf-forms/public-serializer";

interface Props {
  /// Si le PDF est ouvert dans le contexte d'un dossier codé, les "types"
  /// du dossier alimentent l'illustration animée. Sans valeur, fallback sur
  /// la liste par défaut côté composant.
  dossierTypes?: readonly string[];
  form: PublicForm;
  bundlePrefill?: Record<string, string>;
  bundleRunId?: string;
  bundleSlug?: string;
  /// Filet de sécurité : si true, affiche l'ancien rendu dense du PDF.
  legacyLayout?: boolean;
}

/// Page publique de remplissage d'un PDF — reprend le langage visuel "glass"
/// du reste du site (fond dégradé hérité de .glass-root, surfaces translucides)
/// et le layout du mockup : header riche avec illustration décorative, pills
/// meta, puis 2 colonnes (formulaire à gauche, résumé live à droite).
export function DocumentPageLayout({ form, bundlePrefill, bundleRunId, bundleSlug, dossierTypes, legacyLayout }: Props) {
  const t = useTranslations("public.dossier");

  const timeEstimate = useMemo(() => {
    const seconds = Math.max(2 * 60, Math.min(30 * 60, form.fields.length * 30));
    return t("docPageTimeEstimateMin", { value: Math.round(seconds / 60) });
  }, [form.fields.length, t]);

  // Abréviation pour l'illustration : "C32_Travailleur" → "C32".
  const docAbbrev = useMemo(() => {
    const head = form.title.split(/[_\s—–-]/)[0]?.trim() || form.title;
    return head.slice(0, 4).toUpperCase();
  }, [form.title]);

  return (
    // Pleine largeur : le formulaire remplit le shell public (max-w-[1840px])
    // comme le reste du front. La grille 2 colonnes (formulaire + résumé live)
    // occupe donc toute la largeur disponible — choix d'uniformité assumé.
    <div className="flex w-full flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-[color:var(--glass-ink-soft)]" aria-label={t("breadcrumbLabel")}>
        <Link href="/" className="hover:underline">{t("breadcrumbHome")}</Link>
        <ChevronRightIcon className="size-3" />
        {bundleSlug ? (
          <>
            <Link href={`/d/${bundleSlug}`} className="hover:underline">{t("breadcrumbCurrent")}</Link>
            <ChevronRightIcon className="size-3" />
          </>
        ) : (
          <>
            <Link href="/mon-dossier" className="hover:underline">{t("breadcrumbCurrent")}</Link>
            <ChevronRightIcon className="size-3" />
          </>
        )}
        {form.issuer && (
          <>
            <span>{form.issuer}</span>
            <ChevronRightIcon className="size-3" />
          </>
        )}
        <span className="truncate text-[color:var(--glass-ink)]">{form.title}</span>
      </nav>

      {/* En-tête : texte à gauche, illustration décorative à droite */}
      <header className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-3 pr-0 lg:pr-48">
          {form.issuer && (
            <Badge
              variant="outline"
              className="w-fit border-[color:var(--glass-accent-deep)] bg-[color:var(--glass-pop-bg)] text-[11px] uppercase tracking-wide text-[color:var(--glass-accent-deep)]"
            >
              {form.issuer}
            </Badge>
          )}
          <h1 className="glass-display text-3xl font-semibold sm:text-4xl">{form.title}</h1>
          {form.description && (
            <p className="max-w-3xl text-sm text-[color:var(--glass-ink-soft)] sm:text-base">
              {form.description}
            </p>
          )}

          {/* Barre meta : une seule barre blanche avec 3 segments (cf. mockup) */}
          <div className="glass-surface mt-1 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-2xl px-2 py-1.5">
            <MetaSegment icon={<ClockIcon className="size-4" />} label={t("docPageMetaTimeLabel")} value={timeEstimate} />
            <span className="mx-1 hidden h-8 w-px bg-[color:var(--glass-border)] sm:block" />
            <MetaSegment icon={<ShieldCheckIcon className="size-4" />} label={t("docPageMetaSecurityLabel")} value={t("docPageMetaSecurityValue")} />
            <span className="mx-1 hidden h-8 w-px bg-[color:var(--glass-border)] sm:block" />
            <MetaSegment icon={<HelpCircleIcon className="size-4" />} label={t("helpTitle")} value={t("docPageMetaHelpValue")} href="#aide" accent />
          </div>
        </div>

        {/* Illustration décorative — masquée sur mobile.
            Si on est dans le contexte d'un dossier codé, les libellés cyclés
            viennent des `types` du dossier (ex. les 7 motifs de chômage
            temporaire). Sinon, le composant garde sa liste par défaut. */}
        <DocIllustration
          abbrev={docAbbrev}
          cyclingLabels={dossierTypes ? [...dossierTypes] : undefined}
        />
      </header>

      {/* Formulaire pleine largeur : le résumé live en colonne a été retiré
          (le PdfFormRunner porte déjà son aide contextuelle à droite via
          FormShell). Le formulaire occupe donc toute la largeur du shell. */}
      <PdfFormRunner
        form={form}
        bundlePrefill={bundlePrefill}
        bundleRunId={bundleRunId}
        legacyLayout={legacyLayout}
      />
    </div>
  );
}

// Libellés cyclés par défaut : les types de chômage temporaire du dossier
// actif. Exposés en prop pour rester génériques (futurs dossiers) et seront
// à terme pilotés par la config du dossier plutôt que codés en dur. Les
// chaînes ici sont des CLÉS i18n résolues côté composant via `t(key)`.
const DEFAULT_CYCLING_LABEL_KEYS = [
  "docPageCyclingEconomic",
  "docPageCyclingSocialAction",
  "docPageCyclingAnnualLeave",
  "docPageCyclingCompensatoryRest",
  "docPageCyclingBadWeather",
  "docPageCyclingTechnicalAccident",
  "docPageCyclingForceMajeure",
] as const;

// Cadence : on commence rapide (~3,5 s) pour attirer l'œil, puis on ralentit
// à 5 s après quelques transitions "pour pas que ça charge trop le site".
const FAST_INTERVAL_MS = 3500;
const SLOW_INTERVAL_MS = 5000;
const FAST_TRANSITIONS = 3;

function DocIllustration({
  abbrev,
  cyclingLabels,
}: {
  abbrev: string;
  cyclingLabels?: string[];
}) {
  const t = useTranslations("public.dossier");
  // Libellés effectifs : ceux passés en prop (issus du dossier — DB, on ne
  // les traduit pas) sinon ceux par défaut résolus via i18n.
  const labels = useMemo<string[]>(
    () =>
      cyclingLabels && cyclingLabels.length > 0
        ? cyclingLabels
        : DEFAULT_CYCLING_LABEL_KEYS.map((k) => t(k as Parameters<typeof t>[0])),
    [cyclingLabels, t],
  );
  const [index, setIndex] = useState(0);
  // Nombre de swaps déjà effectués (sert à basculer rapide → lent).
  const swapsRef = useRef(0);

  useEffect(() => {
    if (labels.length <= 1) return;

    // Respect de prefers-reduced-motion : pas de cycle, libellé statique.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const delay = swapsRef.current < FAST_TRANSITIONS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
      timeoutId = setTimeout(() => {
        swapsRef.current += 1;
        setIndex((i) => (i + 1) % labels.length);
        schedule();
      }, delay);
    };

    schedule();
    return () => clearTimeout(timeoutId);
  }, [labels.length]);

  const label = labels[index] ?? labels[0] ?? "";

  return (
    <div className="pointer-events-none absolute -top-2 right-0 hidden h-36 w-44 lg:block" aria-hidden>
      <SparklesIcon className="absolute left-4 top-4 size-4 text-[color:var(--glass-accent-deep)] opacity-60" />
      <SparklesIcon className="absolute left-11 top-20 size-3 text-[color:var(--glass-accent-deep)] opacity-40" />
      <SparklesIcon className="absolute right-1 top-1 size-2.5 text-[color:var(--glass-accent-deep)] opacity-50" />
      {/* Feuille de document inclinée */}
      <div className="absolute right-11 top-3 flex h-32 w-28 rotate-6 flex-col gap-1.5 rounded-2xl bg-white p-3.5 shadow-xl ring-1 ring-black/5">
        <span className="h-1.5 w-16 rounded-full bg-[color:var(--glass-ink-faint)]" />
        <span className="h-1.5 w-11 rounded-full bg-[color:var(--glass-ink-faint)]" />
        <span className="h-1.5 w-12 rounded-full bg-[color:var(--glass-ink-faint)]" />
        {/* Badge abréviation + libellé cyclé du type de dossier */}
        <div className="mt-auto flex flex-col gap-1">
          <span className="w-fit rounded-lg bg-[color:var(--glass-accent-deep)] px-2 py-1 text-xs font-bold text-white">
            {abbrev}
          </span>
          {/* Crossfade : conteneur de hauteur fixe → aucun layout shift. */}
          <span className="relative block h-3 w-full overflow-hidden">
            <span
              key={index}
              className="glass-cycling-label absolute inset-0 truncate text-[10px] font-semibold leading-3 text-[color:var(--glass-accent-deep)]"
            >
              {label}
            </span>
          </span>
        </div>
      </div>
      {/* Pastille "personne" en bas à droite, en superposition */}
      <div className="absolute bottom-2 right-4 flex size-11 items-center justify-center rounded-2xl bg-[color:var(--glass-accent-deep)] shadow-xl">
        <UserIcon className="size-5 text-white" />
      </div>
      {/* Animation de crossfade ; désactivée si prefers-reduced-motion. */}
      <style>{`
        @keyframes glass-cycling-fade {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .glass-cycling-label {
          animation: glass-cycling-fade 360ms ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .glass-cycling-label { animation: none; }
        }
      `}</style>
    </div>
  );
}

function MetaSegment({
  icon,
  label,
  value,
  href,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-2.5 rounded-xl px-3 py-1.5">
      <span className="flex size-8 items-center justify-center rounded-full bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]">
        {icon}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] text-[color:var(--glass-ink-faint)]">{label}</span>
        <span
          className={`text-[13px] font-semibold ${
            accent ? "text-[color:var(--glass-accent-deep)]" : "text-[color:var(--glass-ink)]"
          }`}
        >
          {value}
        </span>
      </span>
    </div>
  );
  return href ? (
    <a href={href} className="rounded-xl hover:bg-[color:var(--glass-pop-bg)]/40">
      {inner}
    </a>
  ) : (
    inner
  );
}

