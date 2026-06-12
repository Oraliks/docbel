"use client";

// ============================================================================
// Section tarifs employeur — landing /p/employeur.
//
// Aucun tarif réel n'existe encore dans le code (le billing est court-circuité
// tant que le flag billing_enabled est "false", cf. lib/entitlements.ts ; le
// « Pro — 19€/mois » de lib/page-builder/page-templates.ts n'est qu'un exemple
// de template du page-builder). D'où la constante proposée ci-dessous.
//
// Le numéro de TVA employeur, lui, existe bien en base (User.vatNumber,
// migration 31) — la promesse « facture conforme, TVA récupérable » est donc
// cohérente avec le produit.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CheckIcon,
  SparklesIcon,
} from "lucide-react";

/** TVA belge standard sur les services. */
const TVA_RATE = 0.21;

// TARIF DE LANCEMENT PROPOSÉ — À CONFIRMER PAR ORALIKS.
// 29 €/mois HTVA → 35,09 €/mois TVAC (29 × 1,21).
const PRO_PRICE_HTVA = 29;

type PriceMode = "htva" | "tvac";

interface PricingPlan {
  id: "gratuit" | "pro";
  name: string;
  tagline: string;
  /** Prix mensuel HTVA (0 = gratuit). */
  priceHtva: number;
  features: string[];
  highlighted: boolean;
}

const PLANS: PricingPlan[] = [
  {
    id: "gratuit",
    name: "Gratuit",
    tagline: "Pour s'informer et garder un œil sur ses obligations.",
    priceHtva: 0,
    features: [
      "Outils d'information et actualités sociales",
      "Lecture des dossiers et démarches (chômage temporaire, fin de contrat…)",
      "Recherche de commission paritaire (CP)",
      "Accès immédiat, sans engagement",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Pour gérer vos RH au quotidien, en équipe.",
    priceHtva: PRO_PRICE_HTVA,
    features: [
      "Tout le plan Gratuit",
      "Outils de gestion : calculs, simulations et échéanciers",
      "Multi-utilisateurs : invitez votre équipe",
      "Support prioritaire",
    ],
    highlighted: true,
  },
];

/** Format monétaire belge simple : « 35,09 » (2 décimales, virgule). */
function formatEuro(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/**
 * Anime la valeur affichée vers `target` (compte-à-rebours doux ~360 ms via
 * requestAnimationFrame — jamais de setState synchrone dans l'effet, cf.
 * react-hooks/set-state-in-effect). Saut instantané si l'utilisateur préfère
 * réduire les animations.
 */
function useAnimatedNumber(target: number, duration = 360): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    const from = displayRef.current;
    if (from === target) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || typeof requestAnimationFrame === "undefined") {
      const timer = window.setTimeout(() => {
        displayRef.current = target;
        setDisplay(target);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = from + (target - from) * eased;
      displayRef.current = value;
      setDisplay(value);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

function PlanPrice({ plan, mode }: { plan: PricingPlan; mode: PriceMode }) {
  const target =
    mode === "tvac" ? plan.priceHtva * (1 + TVA_RATE) : plan.priceHtva;
  const animated = useAnimatedNumber(target);
  const isFree = plan.priceHtva === 0;
  const modeLabel = mode === "tvac" ? "TVAC" : "HTVA";

  return (
    <p className="flex items-baseline gap-1.5">
      {/* Chiffres animés masqués aux lecteurs d'écran (le sr-only porte la valeur finale). */}
      <span
        aria-hidden
        className="text-[38px] font-bold tracking-tight tabular-nums text-[color:var(--glass-ink)]"
      >
        {isFree ? "0" : formatEuro(animated)}
      </span>
      <span aria-hidden className="text-[15px] font-semibold text-[color:var(--glass-ink-soft)]">
        €&nbsp;/mois
      </span>
      {!isFree && (
        <span
          aria-hidden
          className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em]"
          style={{
            background:
              "color-mix(in oklab, var(--glass-accent-a) 14%, var(--glass-surface))",
            color: "var(--glass-accent-deep)",
          }}
        >
          {modeLabel}
        </span>
      )}
      <span className="sr-only">
        {isFree
          ? "0 euro par mois"
          : `${formatEuro(target)} euros par mois ${
              mode === "tvac" ? "TVA comprise" : "hors TVA"
            }`}
      </span>
    </p>
  );
}

/**
 * Section « Un tarif simple, TVA comprise » : deux formules (Gratuit / Pro)
 * et un commutateur HTVA ⇄ TVAC (21 %) qui anime les prix en douceur.
 */
export function PricingEmployeur() {
  const [mode, setMode] = useState<PriceMode>("htva");

  const toggleClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] transition-colors duration-200 motion-reduce:transition-none ${
      active
        ? ""
        : "text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
    }`;
  const toggleStyle = (active: boolean) =>
    active
      ? { background: "var(--glass-ink)", color: "var(--glass-bg-a)" }
      : undefined;

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-4">
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderColor:
                "color-mix(in oklab, var(--glass-accent-deep) 30%, transparent)",
              background:
                "color-mix(in oklab, var(--glass-accent-a) 12%, var(--glass-surface))",
              color: "var(--glass-accent-deep)",
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: "var(--glass-accent-deep)" }}
            />
            Tarifs
          </span>
          <h2 className="glass-display max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[38px]">
            Un tarif <em>simple</em>, TVA comprise
          </h2>
          <p className="max-w-[560px] text-[14.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            Pas de surprise : deux formules, des prix affichés hors TVA ou TVA
            comprise, et une facture conforme pour votre comptabilité.
          </p>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <div
            role="group"
            aria-label="Afficher les prix hors TVA ou TVA comprise"
            className="inline-flex w-fit items-center gap-0.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-1"
          >
            <button
              type="button"
              aria-pressed={mode === "htva"}
              onClick={() => setMode("htva")}
              className={toggleClass(mode === "htva")}
              style={toggleStyle(mode === "htva")}
            >
              HTVA
            </button>
            <button
              type="button"
              aria-pressed={mode === "tvac"}
              onClick={() => setMode("tvac")}
              className={toggleClass(mode === "tvac")}
              style={toggleStyle(mode === "tvac")}
            >
              TVAC
            </button>
          </div>
          <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
            TVA belge de 21&nbsp;%.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {PLANS.map((plan) => (
          <article
            key={plan.id}
            className="glass-surface relative flex flex-col gap-5 p-6 sm:p-7"
            style={
              plan.highlighted
                ? {
                    borderColor:
                      "color-mix(in oklab, var(--glass-accent-deep) 45%, var(--glass-border))",
                  }
                : undefined
            }
          >
            {plan.highlighted && (
              <span
                className="absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
                  boxShadow: "0 6px 20px rgba(159,124,255,0.35)",
                }}
              >
                <SparklesIcon className="size-3" strokeWidth={2.4} />
                Recommandé
              </span>
            )}

            <div className="flex flex-col gap-1.5">
              <h3 className="text-[18px] font-bold tracking-tight">
                {plan.name}
              </h3>
              <p className="text-[13px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                {plan.tagline}
              </p>
            </div>

            <PlanPrice plan={plan} mode={mode} />

            <ul className="flex flex-col gap-2.5">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-[color:var(--glass-ink-soft)]"
                >
                  <span
                    className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full"
                    style={{
                      background:
                        "color-mix(in oklab, var(--glass-accent-a) 18%, var(--glass-surface))",
                      color: "var(--glass-accent-deep)",
                    }}
                    aria-hidden
                  >
                    <CheckIcon className="size-3" strokeWidth={3} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            {plan.highlighted ? (
              <div className="mt-auto flex flex-col gap-3 pt-2">
                {/* Honnêteté produit : le billing est désactivé dans le code
                    (billing_enabled=false, cf. lib/entitlements.ts) — personne
                    ne paie aujourd'hui. À RETIRER à l'activation du billing. */}
                <p className="text-[12px] font-semibold leading-snug text-[color:var(--glass-accent-deep)]">
                  Période de lancement : l&apos;espace Pro est actuellement
                  offert — aucun paiement ne vous sera demandé aujourd&apos;hui.
                </p>
                <span
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold"
                  style={{
                    borderColor:
                      "color-mix(in oklab, var(--glass-accent-deep) 25%, transparent)",
                    background:
                      "color-mix(in oklab, var(--glass-accent-a) 10%, var(--glass-surface))",
                    color: "var(--glass-accent-deep)",
                  }}
                >
                  <BadgeCheckIcon className="size-3.5" strokeWidth={2.4} />
                  TVA récupérable — facture conforme
                </span>
                <Link
                  href="/inscription/employeur"
                  className="glass-cta inline-flex w-fit items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
                >
                  Créer mon compte employeur
                  <ArrowRightIcon className="size-4" strokeWidth={2.4} />
                </Link>
                <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
                  Sans engagement.
                </p>
              </div>
            ) : (
              <div className="mt-auto flex flex-col gap-3 pt-2">
                <Link
                  href="/inscription/employeur"
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-6 py-3.5 text-[13.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 hover:text-[color:var(--glass-ink)] motion-reduce:transition-none dark:hover:bg-white/10"
                >
                  Commencer gratuitement
                </Link>
                <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
                  Aucune carte de paiement demandée.
                </p>
              </div>
            )}
          </article>
        ))}
      </div>

      <p className="text-[12px] leading-[1.55] text-[color:var(--glass-ink-faint)]">
        Prix en euros par mois. Les montants TVAC incluent la TVA belge de
        21&nbsp;% — récupérable pour les assujettis.
      </p>
    </section>
  );
}
