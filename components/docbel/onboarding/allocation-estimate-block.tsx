"use client";

// Bloc « Estimation indicative de votre allocation » du résultat du wizard
// (`/mon-dossier`, étape 4). Micro-formulaire à 3 entrées branché sur le moteur
// PUR `estimerAllocation` de `lib/simulateur-chomage` — AUCUN barème dupliqué
// ici (mêmes chiffres que la carte du hero et le calculateur de /outils).
//
// Ne s'affiche QUE si le résultat est marqué `allocationEstimate` (chômage
// complet, frontalier, RCC). Pour tout autre résultat → early-return null,
// même si le parent oublie de garder l'appel.
//
// Différence de gabarit avec la SimulatorCard du hero : ici on est sur une
// surface verre CLAIRE (carte du wizard), donc tokens clairs (--glass-ink,
// --glass-surface, --glass-border) et primitives natives stylées par la règle
// globale `.glass-root input/select`. On reste compact (pas de count-up, pas de
// persistance localStorage) : c'est un complément du résultat, pas l'outil.

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Calculator } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  ANCIENNETE_OPTIONS,
  BAREME_2026,
  CATEGORIE_LABELS,
  CATEGORIE_LABEL_KEYS,
  estimerAllocation,
  type AncienneteValue,
  type CategorieFamiliale,
  type SimulationResult,
} from "@/lib/simulateur-chomage";
import type { WizardResult } from "@/lib/dossier-wizard/config";

const FMT_JOUR = new Intl.NumberFormat("fr-BE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const FMT_MOIS = new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 0 });

// Champs natifs sur surface verre claire : le fond est peint par la règle
// globale `.glass-root :is(input, select…)`, on ne fixe ici que la forme, le
// texte et l'anneau de focus accent.
const FIELD_CLS =
  "w-full rounded-xl border border-[color:var(--glass-border)] px-3 py-2 text-sm font-medium text-[color:var(--glass-ink)] outline-none transition focus:ring-2 focus:ring-[color:var(--glass-accent-a)]/40 motion-reduce:transition-none";

interface Props {
  result: WizardResult;
}

export function AllocationEstimateBlock({ result }: Props) {
  const t = useTranslations("public.dossier");
  const tc = useTranslations("public.dossierContent");
  const resolve = (key: string | undefined, fallback: string): string => {
    if (!key) return fallback;
    try {
      const v = tc(key as Parameters<typeof tc>[0]);
      return v && v !== key ? v : fallback;
    } catch {
      return fallback;
    }
  };
  const uid = useId();
  const catId = `${uid}-categorie`;
  const brutId = `${uid}-brut`;
  const ancId = `${uid}-anciennete`;

  const [categorie, setCategorie] = useState<CategorieFamiliale>("chef_menage");
  const [brutStr, setBrutStr] = useState("");
  const [anciennete, setAnciennete] = useState<AncienneteValue>("0-3");

  // Recalcul dérivé du render (pas de state d'effet) : on tente l'estimation et
  // on garde soit le résultat, soit `null` si la saisie n'est pas (encore)
  // exploitable. Le moteur THROW sur une entrée aberrante → try/catch silencieux,
  // on n'affiche rien tant que le brut n'est pas valide.
  const estimate: SimulationResult | null = useMemo(() => {
    const brut = Number.parseFloat(brutStr.replace(",", "."));
    if (!Number.isFinite(brut) || brut <= BAREME_2026.brutMensuelMinimum) {
      return null;
    }
    const option =
      ANCIENNETE_OPTIONS.find((o) => o.value === anciennete) ??
      ANCIENNETE_OPTIONS[0];
    try {
      return estimerAllocation({
        categorie,
        brutMensuel: brut,
        moisDeChomage: option.moisRepresentatif,
      });
    } catch {
      // Saisie hors barème (ex. salaire journalier tapé par erreur) :
      // informatif, jamais bloquant — on n'affiche simplement aucun montant.
      return null;
    }
  }, [categorie, brutStr, anciennete]);

  // Garde-fou : le bloc ne s'affiche jamais pour un dossier non éligible, même
  // si le parent oublie de gater l'appel.
  if (!result.allocationEstimate) return null;

  const brutTouched = brutStr.trim().length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4">
      <div className="flex items-start gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-accent-a)]/12 text-[color:var(--glass-accent-a)]">
          <Calculator className="size-4" aria-hidden />
        </span>
        <div className="flex-1 space-y-0.5">
          <h4 className="text-sm font-semibold">
            {t("allocTitle")}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t("allocIntro")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={catId} className="text-xs font-medium">
            {t("allocFamilyLabel")}
          </Label>
          <select
            id={catId}
            value={categorie}
            onChange={(e) => setCategorie(e.target.value as CategorieFamiliale)}
            className={FIELD_CLS}
          >
            <option value="chef_menage">{resolve(CATEGORIE_LABEL_KEYS.chef_menage, CATEGORIE_LABELS.chef_menage)}</option>
            <option value="isole">{resolve(CATEGORIE_LABEL_KEYS.isole, CATEGORIE_LABELS.isole)}</option>
            <option value="cohabitant">{resolve(CATEGORIE_LABEL_KEYS.cohabitant, CATEGORIE_LABELS.cohabitant)}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={brutId} className="text-xs font-medium">
            {t("allocGrossLabel")}
          </Label>
          <input
            id={brutId}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder={t("allocGrossPlaceholder")}
            value={brutStr}
            onChange={(e) => setBrutStr(e.target.value)}
            className={FIELD_CLS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ancId} className="text-xs font-medium">
            {t("allocSinceLabel")}
          </Label>
          <select
            id={ancId}
            value={anciennete}
            onChange={(e) => setAnciennete(e.target.value as AncienneteValue)}
            className={FIELD_CLS}
          >
            {ANCIENNETE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {resolve(o.labelKey, o.label)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {estimate ? (
        <div className="space-y-2.5">
          <div className="rounded-xl border border-[color:var(--glass-accent-a)]/25 bg-[color:var(--glass-accent-a)]/8 px-3.5 py-3">
            <p className="text-xs text-muted-foreground">
              {t("allocYouWouldGet")}
            </p>
            <p className="mt-0.5 text-2xl font-semibold leading-none text-[color:var(--glass-ink)]">
              {FMT_JOUR.format(estimate.parJour)} €
              <span className="ml-1 text-sm font-medium text-muted-foreground">
                {t("allocPerDay")}
              </span>
            </p>
            <p className="mt-1 text-sm font-medium text-[color:var(--glass-ink)]">
              {t("allocPerMonth", { amount: FMT_MOIS.format(estimate.parMois) })}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {t("allocRateDetail", {
                  rate: estimate.tauxPct,
                  capped: estimate.plafondApplique ? "yes" : "no",
                  period: estimate.periodeLabel,
                })}
              </span>
            </p>
          </div>

          <ul className="space-y-1 text-xs text-muted-foreground">
            {estimate.caveats.map((caveat) => (
              <li key={caveat} className="flex gap-1.5">
                <span aria-hidden className="select-none">
                  •
                </span>
                <span>{caveat}</span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground">
            <Link
              href="/outils"
              className="font-medium text-[color:var(--glass-accent-deep)] underline underline-offset-2 transition hover:decoration-2 motion-reduce:transition-none"
            >
              {t("allocRefineLink")}
              <ArrowRight className="ml-0.5 inline size-3" aria-hidden />
            </Link>
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {brutTouched
            ? t("allocHintTouched")
            : t("allocHintEmpty")}
        </p>
      )}
    </div>
  );
}
