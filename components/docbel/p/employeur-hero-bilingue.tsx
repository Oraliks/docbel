"use client";

// ============================================================================
// Hero bilingue FR/NL — landing /p/employeur.
//
// Reproduit À L'IDENTIQUE le bloc « Section A — Hero » historique de
// app/p/employeur/page.tsx (badge, h1 avec <em>, paragraphe, CTAs, badges de
// réassurance, illustration), mais le texte est piloté par un dictionnaire
// { fr, nl } surmonté d'un commutateur FR | NL (état local, défaut FR).
// Le changement de langue fond le texte en douceur (transition d'opacité,
// neutralisée par prefers-reduced-motion via matchMedia + motion-reduce:*).
//
// ⚠️ Traduction NL rédigée avec soin (registre business) mais À FAIRE RELIRE
// PAR UN NATIF avant mise en avant commerciale.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalculatorIcon,
  type LucideIcon,
  ScaleIcon,
  ShieldCheckIcon,
  UserCheckIcon,
} from "lucide-react";

export type HeroLocale = "fr" | "nl";

/** Segment du titre : `em` = mot mis en avant (rendu <em> du glass-display). */
export interface HeroTitleSegment {
  text: string;
  em?: boolean;
}

/** Dictionnaire d'une langue du hero — exporté pour le remplacement dans page.tsx. */
export interface EmployeurHeroCopy {
  /** Pastille au-dessus du titre. */
  badge: string;
  /** Titre découpé en segments (les segments `em` reprennent le style accent). */
  titleSegments: HeroTitleSegment[];
  paragraph: string;
  ctaPrimary: string;
  ctaSecondary: string;
  /** Libellés des 3 badges de réassurance (même ordre que REASSURANCE_ICONS). */
  reassurance: [string, string, string];
  /** Légende de la vignette d'illustration. */
  illustrationLabel: string;
  /** Intitulé accessible du commutateur de langue, dans cette langue. */
  switchLabel: string;
}

export const EMPLOYEUR_HERO_COPY: Record<HeroLocale, EmployeurHeroCopy> = {
  fr: {
    badge: "Plateforme RH & administrative",
    titleSegments: [
      { text: "L'espace employeur qui vous fait " },
      { text: "gagner du temps", em: true },
      { text: " et de " },
      { text: "l'argent.", em: true },
    ],
    paragraph:
      "Docbel centralise outils pratiques, simulations et informations fiables pour simplifier votre gestion RH et administrative au quotidien.",
    ctaPrimary: "Découvrir l'espace employeur",
    ctaSecondary: "Demander une démo",
    reassurance: [
      "Informations fiables & à jour",
      "Outils validés par des experts",
      "Conforme au droit belge",
    ],
    illustrationLabel: "Espace employeur",
    switchLabel: "Langue de cette page",
  },
  nl: {
    badge: "HR- & administratief platform",
    titleSegments: [
      { text: "De werkgeverszone waarmee u " },
      { text: "tijd wint", em: true },
      { text: " én " },
      { text: "geld bespaart.", em: true },
    ],
    paragraph:
      "Docbel bundelt praktische tools, simulaties en betrouwbare informatie om uw HR- en administratief beheer elke dag eenvoudiger te maken.",
    ctaPrimary: "Ontdek de werkgeverszone",
    ctaSecondary: "Vraag een demo aan",
    reassurance: [
      "Betrouwbare & actuele informatie",
      "Tools gevalideerd door experts",
      "Conform het Belgische recht",
    ],
    illustrationLabel: "Werkgeverszone",
    switchLabel: "Taal van deze pagina",
  },
};

// Icônes des badges de réassurance — même ordre que `copy.reassurance`
// (repris des REASSURANCE_BADGES historiques de page.tsx).
const REASSURANCE_ICONS: [LucideIcon, LucideIcon, LucideIcon] = [
  ShieldCheckIcon,
  UserCheckIcon,
  ScaleIcon,
];

/** Durée du fondu de texte (ms) — doux, sous le seuil de gêne. */
const FADE_MS = 190;

export interface EmployeurHeroBilingueProps {
  /** Langue affichée au chargement (défaut : fr). */
  defaultLocale?: HeroLocale;
}

/**
 * Hero de la landing employeur, commutable FR | NL. `locale` reflète le choix
 * (boutons, aria-pressed) ; `shown` est la langue réellement affichée — elle
 * suit avec un léger décalage pour laisser le texte fondre (opacité 0 → swap
 * → opacité 1). Tout le texte porte `lang={shown}` pour les lecteurs d'écran.
 */
export function EmployeurHeroBilingue({
  defaultLocale = "fr",
}: EmployeurHeroBilingueProps) {
  const [locale, setLocale] = useState<HeroLocale>(defaultLocale);
  const [shown, setShown] = useState<HeroLocale>(defaultLocale);
  const [fading, setFading] = useState(false);
  const fadeTimerRef = useRef<number | null>(null);

  // Nettoyage du timer de fondu si le composant est démonté en plein swap.
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }
    };
  }, []);

  const switchTo = (next: HeroLocale) => {
    if (next === locale) return;
    setLocale(next);

    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    // prefers-reduced-motion : swap immédiat, sans fondu.
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      setShown(next);
      setFading(false);
      return;
    }

    setFading(true);
    fadeTimerRef.current = window.setTimeout(() => {
      setShown(next);
      setFading(false);
      fadeTimerRef.current = null;
    }, FADE_MS);
  };

  const copy = EMPLOYEUR_HERO_COPY[shown];
  const fadeStyle = { opacity: fading ? 0 : 1 };

  const pillClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.08em] transition-colors duration-200 motion-reduce:transition-none ${
      active
        ? ""
        : "text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
    }`;
  const pillStyle = (active: boolean) =>
    active
      ? { background: "var(--glass-ink)", color: "var(--glass-bg-a)" }
      : undefined;

  return (
    <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
      <div className="flex flex-col gap-5">
        {/* Commutateur de langue FR | NL */}
        <div
          role="group"
          aria-label={copy.switchLabel}
          className="inline-flex w-fit items-center gap-0.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-1"
        >
          <button
            type="button"
            lang="fr"
            aria-pressed={locale === "fr"}
            onClick={() => switchTo("fr")}
            className={pillClass(locale === "fr")}
            style={pillStyle(locale === "fr")}
          >
            FR
          </button>
          <button
            type="button"
            lang="nl"
            aria-pressed={locale === "nl"}
            onClick={() => switchTo("nl")}
            className={pillClass(locale === "nl")}
            style={pillStyle(locale === "nl")}
          >
            NL
          </button>
        </div>

        {/* Colonne texte — structure identique au hero historique, en fondu. */}
        <div
          lang={shown}
          className="flex flex-col gap-7 transition-opacity duration-200 ease-out motion-reduce:transition-none"
          style={fadeStyle}
        >
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderColor: "color-mix(in oklab, var(--glass-accent-deep) 30%, transparent)",
              background: "color-mix(in oklab, var(--glass-accent-a) 12%, var(--glass-surface))",
              color: "var(--glass-accent-deep)",
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: "var(--glass-accent-deep)" }}
            />
            {copy.badge}
          </span>

          <h1 className="glass-display text-[40px] leading-[1.05] font-semibold tracking-tight sm:text-[52px] lg:text-[58px]">
            {copy.titleSegments.map((segment, index) =>
              segment.em ? (
                <em key={index}>{segment.text}</em>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </h1>

          <p className="max-w-[560px] text-[15.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            {copy.paragraph}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/employeur"
              className="glass-cta inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
            >
              {copy.ctaPrimary}
              <ArrowRightIcon className="size-4" strokeWidth={2.4} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-6 py-3.5 text-[13.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 hover:text-[color:var(--glass-ink)] dark:hover:bg-white/10"
            >
              {copy.ctaSecondary}
            </Link>
          </div>

          <ul className="flex flex-wrap gap-2 pt-2">
            {copy.reassurance.map((label, index) => {
              const Icon = REASSURANCE_ICONS[index];
              return (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 py-2 text-[12px] font-semibold text-[color:var(--glass-ink-soft)]"
                >
                  <Icon
                    className="size-3.5"
                    style={{ color: "var(--glass-accent-deep)" }}
                    strokeWidth={2.4}
                  />
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Illustration placeholder — à raffiner par la session design. */}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-[28px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 30% 20%, var(--glass-accent-d) 0%, transparent 55%), linear-gradient(135deg, var(--glass-accent-c) 0%, var(--glass-accent-a) 55%, var(--glass-accent-deep) 100%)",
        }}
      >
        <div
          className="absolute top-1/2 left-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
          aria-hidden
        />
        <div className="relative flex h-full items-center justify-center">
          <div className="flex size-[200px] flex-col items-center justify-center gap-3 rounded-3xl border border-white/30 bg-white/15 p-6 shadow-[0_30px_80px_rgba(20,10,45,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-xl sm:size-[240px]">
            <CalculatorIcon className="size-16 text-white sm:size-20" strokeWidth={1.6} />
            <span
              lang={shown}
              className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80 transition-opacity duration-200 motion-reduce:transition-none"
              style={fadeStyle}
            >
              {copy.illustrationLabel}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
