"use client";

/**
 * Démo publique du Calcul AGR — landing /p/partenaire.
 *
 * Cas type pré-rempli repris d'un test VALIDÉ du moteur (constantes ci-dessous,
 * source citée). Seuls le salaire brut mensuel et le volume horaire sont
 * modifiables, dans des bornes plausibles ; tout le reste du dossier est figé.
 * Le recalcul est fait en direct par le VRAI moteur `lib/agr` (import direct,
 * exactement comme la page privée /partenaire/outils/calcul-agr : les barèmes
 * vivent en constantes dans lib/agr/baremes.ts — l'API privée ne sert qu'au
 * parsing des PDF WECH, inutile ici).
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRightIcon, CalculatorIcon } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { GLASS_LABEL } from "@/lib/glass-classes";
import {
  calculerAgr,
  getBareme,
  type AgrGlobalInput,
  type OccupationInput,
} from "@/lib/agr";

/* ─────────────────────────── cas type validé ─────────────────────────── */

// Source : lib/agr/__tests__/calcul.test.ts — describe « calculerAgr — exemple
// principal de la formation (avril 2024, p.4-8) » : employé du privé (1E) à
// mi-temps (Q = 19 / S = 38), chef de ménage (cat. A), barème « 010426 ».
// Pour ces valeurs exactes, le test garantit : barème 57 = 573,25 € et
// barème 05 = 719,28 € (salaire imposable 1 320,46 €, retenues 0 €).
const CAS = {
  allocationJournaliere: 66.31, // € / jour (donnée du dossier chômage)
  categorieFamiliale: "A", // chef de ménage
  bareme: "010426", // barème « À partir d'avril 2026 »
  categorieTravailleur: "1E", // employé du secteur privé
  s: 38, // temps plein de référence (h/semaine)
  q: 19, // facteur Q par défaut (h/semaine de l'occupation)
  salaire: 1450.23, // Y-Brut = salaire théorique mensuel (mois complet presté)
  heures: 82.27, // heures HT du mois du cas de formation (= 19 × 4,33)
} as const;

/** Heures prestées du mois pour Q h/semaine — ratio du cas de formation (82,27 / 19 = 4,33). */
const HEURES_PAR_Q = 4.33;

// Bornes des curseurs. Le plafond du salaire dépasse volontairement le salaire
// de référence du barème (2 189,81 € en avril 2026) : en poussant le curseur,
// on découvre en direct le plafond légal (motif renvoyé par le moteur).
const SALAIRE_MIN = 900;
const SALAIRE_MAX = 2400;
const SALAIRE_PAS = 10;
const Q_MIN = 8;
const Q_MAX = 30;

/* ─────────────────────────── helpers d'affichage ─────────────────────────── */

function eur(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return v.toLocaleString("fr-BE", { style: "currency", currency: "EUR" });
}

function eurEntier(v: number): string {
  return `${Math.round(v).toLocaleString("fr-BE")} €`;
}

const BAREME_LIBELLE = getBareme(CAS.bareme).libelle;

/** Entrées du moteur : cas type figé + les 2 valeurs pilotées par les curseurs. */
function construireEntree(salaire: number, q: number): AgrGlobalInput {
  const occupation: OccupationInput = {
    qinfo: 2, // même facteur Q tout le mois (comme le cas de formation)
    q,
    s: CAS.s,
    categorieTravailleur: CAS.categorieTravailleur,
    ybrut: salaire,
    salaireTheoriqueHeure: 0,
    salaireTheoriqueMois: salaire, // mois complet presté : Y-Brut = salaire théorique
    heures: Math.round(q * HEURES_PAR_Q * 100) / 100,
    heuresV: 0,
    heuresA: 0,
    requalifier: false,
    soldeS32: 0,
    soldeQ4: 0,
    pw1: 0,
    pw2: 0,
    pr: 0,
    fermetureTotal: 0,
    joursNI: 0,
  };
  return {
    allocationJournaliere: CAS.allocationJournaliere,
    demiAllocation: 0, // pas de chômage temporaire dans ce cas type
    categorieFamiliale: CAS.categorieFamiliale,
    ageAuMoins21: true,
    soldeJ: 0,
    moisDecembre: false,
    cumulTempsPartiel: false,
    joursCC: 0,
    incapaciteOuSanctionTotalite: false,
    bareme: CAS.bareme,
    occupations: [occupation],
  };
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
      // Très vieux navigateurs : on affiche sans attendre.
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

export function AgrDemo() {
  const t = useTranslations("public.landing");
  const [salaire, setSalaire] = useState<number>(CAS.salaire);
  const [q, setQ] = useState<number>(CAS.q);

  /** Le reste du cas type, figé — affiché en toute transparence sous les curseurs. */
  const PARAMETRES_FIGES: string[] = [
    t("agrDemoParamPrive"),
    t("agrDemoParamChefMenage"),
    t("agrDemoParamAllocation", { montant: eur(CAS.allocationJournaliere) }),
    t("agrDemoParamTempsPlein", { s: CAS.s }),
    t("agrDemoParamBareme", { libelle: BAREME_LIBELLE }),
  ];

  const resultat = useMemo(() => calculerAgr(construireEntree(salaire, q)), [salaire, q]);
  const agr57 = resultat.bareme57 ?? 0;
  const agr05 = resultat.bareme05 ?? 0;
  const agr57Anime = useCountUp(agr57);
  const agr05Anime = useCountUp(agr05);

  // Repère de comparaison : 26 allocations journalières (mois complet de
  // chômage). Simple produit des données du cas — aucun montant réglementaire
  // supplémentaire n'est introduit.
  const allocationComplete = CAS.allocationJournaliere * 26;

  // Le graphe « monte » à sa première apparition ; le léger décalage entre
  // barres est ensuite retiré pour que les recalculs live restent réactifs.
  const [grapheRef, grapheVisible] = useInView();
  const [revelTermine, setRevelTermine] = useState(false);
  useEffect(() => {
    if (!grapheVisible) return;
    const timer = setTimeout(() => setRevelTermine(true), 1100);
    return () => clearTimeout(timer);
  }, [grapheVisible]);

  const barres = [
    { labelKey: "agrDemoBarSalaireBrut", label: t("agrDemoBarSalaireBrut"), valeur: salaire, couleur: "var(--glass-accent-a)" },
    { labelKey: "agrDemoBarAllocation", label: t("agrDemoBarAllocation"), valeur: allocationComplete, couleur: "var(--glass-accent-c)" },
    { labelKey: "agrDemoBarAgr57", label: t("agrDemoBarAgr57"), valeur: agr57, couleur: "var(--glass-accent-deep)" },
  ];
  const maxBarre = Math.max(...barres.map((b) => b.valeur), 1);

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-4">
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em]"
          style={{
            borderColor: "color-mix(in oklab, var(--glass-accent-deep) 30%, transparent)",
            background: "color-mix(in oklab, var(--glass-accent-a) 12%, var(--glass-surface))",
            color: "var(--glass-accent-deep)",
          }}
        >
          <CalculatorIcon className="size-3.5" strokeWidth={2.4} />
          {t("agrDemoBadge")}
        </span>

        <h2 className="glass-display max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[38px]">
          {t.rich("agrDemoTitle", { em: (c) => <em>{c}</em> })}
        </h2>

        <p className="max-w-[640px] text-[14.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          {t("agrDemoIntro")}
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.05fr_1fr]">
        {/* ── Curseurs ── */}
        <div className="glass-surface flex flex-col gap-6 p-6 sm:p-7">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <label htmlFor="agr-demo-salaire" className={GLASS_LABEL}>
                {t("agrDemoSalaireLabel")}
              </label>
              <span className="text-[16px] font-bold tabular-nums">{eur(salaire)}</span>
            </div>
            <Slider
              id="agr-demo-salaire"
              value={salaire}
              onChange={setSalaire}
              min={SALAIRE_MIN}
              max={SALAIRE_MAX}
              step={SALAIRE_PAS}
            />
            <div className="flex justify-between text-[11px] text-[color:var(--glass-ink-faint)]">
              <span>{eurEntier(SALAIRE_MIN)}</span>
              <span>{eurEntier(SALAIRE_MAX)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <label htmlFor="agr-demo-horaire" className={GLASS_LABEL}>
                {t("agrDemoHoraireLabel")}
              </label>
              <span className="text-[16px] font-bold tabular-nums">
                {t("agrDemoHoraireValue", { q })}
              </span>
            </div>
            <Slider
              id="agr-demo-horaire"
              value={q}
              onChange={setQ}
              min={Q_MIN}
              max={Q_MAX}
              step={1}
            />
            <div className="flex justify-between text-[11px] text-[color:var(--glass-ink-faint)]">
              <span>{t("agrDemoHoraireMin", { min: Q_MIN })}</span>
              <span>{t("agrDemoHoraireMax", { max: Q_MAX, s: CAS.s })}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-[color:var(--glass-ink-line)] pt-4">
            <span className={GLASS_LABEL}>{t("agrDemoFigeLabel")}</span>
            <ul className="flex flex-wrap gap-2">
              {PARAMETRES_FIGES.map((libelle) => (
                <li
                  key={libelle}
                  className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-1.5 text-[11.5px] font-semibold text-[color:var(--glass-ink-soft)]"
                >
                  {libelle}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Résultat (terminologie réelle du moteur) ── */}
        <div className="glass-surface flex flex-col gap-4 p-6 sm:p-7">
          <div
            className="rounded-2xl px-5 py-4 text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
              boxShadow: "0 14px 36px rgba(91,70,229,0.28)",
            }}
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
              {t("agrDemoResultBareme57")}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[34px] font-bold tabular-nums sm:text-[40px]">
                {eur(agr57Anime)}
              </span>
              <span className="text-[12.5px] font-semibold text-white/80">{t("agrDemoParMois")}</span>
            </div>
            {resultat.motif57 && (
              <p className="mt-1 text-[11.5px] leading-snug text-white/90">{resultat.motif57}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <LigneResultat
              label={t("agrDemoBareme05")}
              valeur={eur(agr05Anime)}
              motif={resultat.motif05 || undefined}
              important
            />
            <LigneResultat
              label={t("agrDemoSalaireImposable")}
              valeur={eur(resultat.intermediaires.totalSalaireImposable)}
            />
            <LigneResultat
              label={t("agrDemoRetenues")}
              valeur={eur(resultat.intermediaires.totalRetenues)}
            />
            <LigneResultat
              label={t("agrDemoSalaireReference")}
              valeur={eur(resultat.salaireReference)}
            />
          </div>

          <div className="h-px w-full bg-[color:var(--glass-ink-line)]" aria-hidden />

          {/* Mini-graphe en barres CSS pures, animé à l'apparition. */}
          <div ref={grapheRef} className="flex flex-col gap-3">
            <span className={GLASS_LABEL}>{t("agrDemoComparaison")}</span>
            {/* Les cellules s'étirent sur toute la hauteur (stretch par défaut) ;
                chaque colonne ancre sa barre en bas. */}
            <div className="grid h-32 grid-cols-3 gap-4" aria-hidden>
              {barres.map((b, i) => {
                const pct = (b.valeur / maxBarre) * 100;
                const hauteur = b.valeur > 0 ? Math.max(3, pct) : 1.5;
                return (
                  <div key={b.labelKey} className="flex h-full items-end justify-center">
                    <div
                      className="w-full max-w-[72px] rounded-t-xl transition-[height] duration-700 ease-out motion-reduce:transition-none"
                      style={{
                        height: `${grapheVisible ? hauteur : 0}%`,
                        background: `linear-gradient(180deg, color-mix(in oklab, ${b.couleur} 78%, white), ${b.couleur})`,
                        transitionDelay: revelTermine ? "0ms" : `${i * 110}ms`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {barres.map((b) => (
                <div key={b.labelKey} className="flex flex-col items-center gap-0.5 text-center">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--glass-ink-soft)]">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: b.couleur }}
                      aria-hidden
                    />
                    {b.label}
                  </span>
                  <span className="text-[12.5px] font-bold tabular-nums">{eurEntier(b.valeur)}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11.5px] leading-[1.55] text-[color:var(--glass-ink-faint)]">
            {t("agrDemoFootnote")}
          </p>
          <p className="text-[11.5px] leading-[1.55] text-[color:var(--glass-ink-faint)]">
            {t("agrDemoLegalWarning")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link
          href="/inscription/partenaire"
          className="glass-cta inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
        >
          {t("agrDemoCtaPrimary")}
          <ArrowRightIcon className="size-4" strokeWidth={2.4} />
        </Link>
        <Link
          href="/partenaire/outils/calcul-agr"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--glass-ink-soft)] underline-offset-4 transition-colors hover:text-[color:var(--glass-ink)] hover:underline motion-reduce:transition-none"
        >
          {t("agrDemoCtaSecondary")}
          <ArrowRightIcon className="size-3.5" strokeWidth={2.4} />
        </Link>
      </div>
    </section>
  );
}

/* ─────────────────────────── sous-composants ─────────────────────────── */

function LigneResultat({
  label,
  valeur,
  motif,
  important,
}: {
  label: string;
  valeur: string;
  motif?: string;
  important?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-[color:var(--glass-ink-soft)]">{label}</span>
      <div className="text-right">
        <span
          className={
            important
              ? "text-[15.5px] font-bold tabular-nums"
              : "text-[13.5px] font-semibold tabular-nums"
          }
        >
          {valeur}
        </span>
        {motif && (
          <p className="max-w-[260px] text-[11px] leading-snug text-[color:var(--glass-ink-faint)]">
            {motif}
          </p>
        )}
      </div>
    </div>
  );
}
