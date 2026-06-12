"use client";

/**
 * Calculette « retour sur investissement » — landing /p/partenaire.
 *
 * Purement front : aucune donnée métier, juste une projection du temps que
 * l'équipe récupère en automatisant le calcul AGR (dépôt du WECH 506 →
 * résultat). Les hooks d'animation sont volontairement dupliqués depuis
 * agr-demo.tsx pour garder chaque widget autonome (pas de fichier partagé).
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { CalendarDaysIcon, TimerIcon, type LucideIcon } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { GLASS_LABEL, GLASS_POP_STYLE } from "@/lib/glass-classes";

/* ─────────────────────────── hypothèses (constantes) ─────────────────────────── */

// Hypothèse produit : ~3 min par dossier avec l'outil (dépôt du WECH 506,
// vérification rapide, export PDF). À affiner avec les retours terrain.
const MINUTES_AVEC_OUTIL = 3;

// Journée de référence : 7,6 h, soit la semaine de 38 h — le même temps plein
// de référence (facteur S = 38) que celui utilisé par le moteur AGR.
const HEURES_PAR_JOUR = 7.6;

const DOSSIERS_MIN = 5;
const DOSSIERS_MAX = 200;
const DOSSIERS_DEFAUT = 40;
const MINUTES_MIN = 10;
const MINUTES_MAX = 45;
const MINUTES_DEFAUT = 25;

/** Format fr-BE à 1 décimale (largeur stable pendant le count-up). */
function fmt1(v: number): string {
  return v.toLocaleString("fr-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/* ─────────────────────────── hooks d'animation ─────────────────────────── */

/**
 * Count-up doux vers `target` (~550 ms, easing cubic-out). Aucun setState
 * synchrone dans l'effet : tout passe par requestAnimationFrame (lint React 19).
 * `prefers-reduced-motion` → saut direct à la valeur finale.
 */
function useCountUp(target: number, dureeMs = 550): number {
  const [affiche, setAffiche] = useState(target);
  const derniere = useRef(target);
  useEffect(() => {
    if (derniere.current === target) return;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const depart = derniere.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (maintenant: number) => {
      const p = reduit ? 1 : Math.min(1, (maintenant - t0) / dureeMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = depart + (target - depart) * eased;
      derniere.current = v;
      setAffiche(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dureeMs]);
  return affiche;
}

/** Détecte la première apparition à l'écran (callback IO = asynchrone → lint OK). */
function useInView(): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
}

/* ─────────────────────────── composant ─────────────────────────── */

export function RoiCalc() {
  const [dossiers, setDossiers] = useState(DOSSIERS_DEFAUT);
  const [minutes, setMinutes] = useState(MINUTES_DEFAUT);

  const minutesGagneesParDossier = Math.max(0, minutes - MINUTES_AVEC_OUTIL);
  const heuresParMois = (dossiers * minutesGagneesParDossier) / 60;
  const joursParAn = (heuresParMois * 12) / HEURES_PAR_JOUR;
  const reductionPct = Math.round((minutesGagneesParDossier / minutes) * 100);

  const heuresAnimees = useCountUp(heuresParMois);
  const joursAnimes = useCountUp(joursParAn);
  const joursPhrase = Math.round(joursParAn);

  // Les barres comparatives se déploient à la première apparition, puis
  // suivent les curseurs via une simple transition CSS.
  const [barresRef, barresVisibles] = useInView();
  const pctOutil = (MINUTES_AVEC_OUTIL / minutes) * 100;

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-4">
        <h2 className="glass-display max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[38px]">
          Combien de <em>temps</em> votre équipe récupère-t-elle ?
        </h2>
        <p className="max-w-[640px] text-[14.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          Estimez ce que le calcul automatique change pour une permanence : réglez votre
          volume de dossiers AGR et le temps que vous y consacrez aujourd’hui à la main.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.05fr_1fr]">
        {/* ── Réglages ── */}
        <div className="glass-surface flex flex-col gap-6 p-6 sm:p-7">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <label htmlFor="roi-dossiers" className={GLASS_LABEL}>
                Dossiers AGR traités par mois
              </label>
              <span className="text-[16px] font-bold tabular-nums">
                {dossiers.toLocaleString("fr-BE")} dossiers
              </span>
            </div>
            <Slider
              id="roi-dossiers"
              value={dossiers}
              onChange={setDossiers}
              min={DOSSIERS_MIN}
              max={DOSSIERS_MAX}
              step={5}
            />
            <div className="flex justify-between text-[11px] text-[color:var(--glass-ink-faint)]">
              <span>{DOSSIERS_MIN}</span>
              <span>{DOSSIERS_MAX}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <label htmlFor="roi-minutes" className={GLASS_LABEL}>
                Minutes par dossier, à la main
              </label>
              <span className="text-[16px] font-bold tabular-nums">{minutes} min</span>
            </div>
            <Slider
              id="roi-minutes"
              value={minutes}
              onChange={setMinutes}
              min={MINUTES_MIN}
              max={MINUTES_MAX}
              step={1}
            />
            <div className="flex justify-between text-[11px] text-[color:var(--glass-ink-faint)]">
              <span>{MINUTES_MIN} min</span>
              <span>{MINUTES_MAX} min</span>
            </div>
          </div>

          {/* Comparaison visuelle manuel / outil */}
          <div
            ref={barresRef}
            className="flex flex-col gap-3 border-t border-[color:var(--glass-ink-line)] pt-4"
          >
            <BarreDuree
              label="À la main"
              detail={`${minutes} min / dossier`}
              pct={barresVisibles ? 100 : 0}
              couleur="var(--glass-accent-c)"
            />
            <BarreDuree
              label="Avec Docbel"
              detail={`${MINUTES_AVEC_OUTIL} min / dossier`}
              pct={barresVisibles ? pctOutil : 0}
              couleur="var(--glass-accent-deep)"
            />
            <p className="text-[11.5px] leading-[1.55] text-[color:var(--glass-ink-faint)]">
              Avec l’outil : dépôt du WECH 506, calcul automatique, export PDF.
            </p>
          </div>
        </div>

        {/* ── Résultats ── */}
        <div className="glass-surface flex flex-col gap-4 p-6 sm:p-7">
          <span
            className="inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-bold"
            style={GLASS_POP_STYLE}
          >
            −{reductionPct} % de temps de traitement
          </span>

          <div className="grid gap-3 sm:grid-cols-2">
            <TuileStat
              Icon={TimerIcon}
              label="Heures gagnées par mois"
              valeur={fmt1(heuresAnimees)}
              unite="h"
            />
            <TuileStat
              Icon={CalendarDaysIcon}
              label="Jours récupérés par an"
              valeur={fmt1(joursAnimes)}
              unite={joursParAn >= 1.5 ? "jours" : "jour"}
            />
          </div>

          <p className="text-[13.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            Soit l’équivalent{" "}
            <strong className="font-bold text-[color:var(--glass-ink)]">
              {joursPhrase <= 1 ? "d’environ une journée" : `de ${joursPhrase} jours`} de
              permanence par an
            </strong>
            , à consacrer à l’accompagnement plutôt qu’à l’encodage.
          </p>

          <p className="text-[11.5px] leading-[1.55] text-[color:var(--glass-ink-faint)]">
            Estimation indicative — hypothèse de {MINUTES_AVEC_OUTIL} minutes par dossier
            avec l’outil ; journée de référence de 7,6 h (semaine de 38 h).
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── sous-composants ─────────────────────────── */

function BarreDuree({
  label,
  detail,
  pct,
  couleur,
}: {
  label: string;
  detail: string;
  pct: number;
  couleur: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-semibold text-[color:var(--glass-ink-soft)]">
          {label}
        </span>
        <span className="text-[12px] font-bold tabular-nums">{detail}</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--glass-ink-line)" }}
        aria-hidden
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
            background: couleur,
          }}
        />
      </div>
    </div>
  );
}

function TuileStat({
  Icon,
  label,
  valeur,
  unite,
}: {
  Icon: LucideIcon;
  label: string;
  valeur: string;
  unite: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-5">
      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
        <Icon
          className="size-3.5 shrink-0"
          style={{ color: "var(--glass-accent-deep)" }}
          strokeWidth={2.4}
        />
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-[32px] font-bold leading-none tracking-tight tabular-nums">
          {valeur}
        </span>
        <span className="text-[13px] font-semibold text-[color:var(--glass-ink-soft)]">
          {unite}
        </span>
      </span>
    </div>
  );
}
