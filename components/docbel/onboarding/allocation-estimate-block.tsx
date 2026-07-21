"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Calculator } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
const FMT_MOIS = new Intl.NumberFormat("fr-BE", {
  maximumFractionDigits: 0,
});

const FIELD_CLS =
  "w-full rounded-xl border border-[color:var(--glass-border)] px-3 py-2 text-sm font-medium text-[color:var(--glass-ink)] outline-none transition focus:ring-2 focus:ring-[color:var(--glass-accent-a)]/40 motion-reduce:transition-none";

interface Props {
  result: WizardResult;
}

/** Estimation indicative branchee sur le moteur partage, sans bareme local. */
export function AllocationEstimateBlock({ result }: Props) {
  const t = useTranslations("public.dossier");
  const tc = useTranslations("public.dossierContent");
  const resolve = (key: string | undefined, fallback: string): string => {
    if (!key) return fallback;
    try {
      const value = tc(key as Parameters<typeof tc>[0]);
      return value && value !== key ? value : fallback;
    } catch {
      return fallback;
    }
  };
  const uid = useId();
  const catId = `${uid}-categorie`;
  const brutId = `${uid}-brut`;
  const ancId = `${uid}-anciennete`;

  const [categorie, setCategorie] =
    useState<CategorieFamiliale>("chef_menage");
  const [brutStr, setBrutStr] = useState("");
  const [anciennete, setAnciennete] =
    useState<AncienneteValue>("0-3");

  const estimate: SimulationResult | null = useMemo(() => {
    const brut = Number.parseFloat(brutStr.replace(",", "."));
    if (!Number.isFinite(brut) || brut <= BAREME_2026.brutMensuelMinimum) {
      return null;
    }
    const option =
      ANCIENNETE_OPTIONS.find((item) => item.value === anciennete) ??
      ANCIENNETE_OPTIONS[0];
    try {
      return estimerAllocation({
        categorie,
        brutMensuel: brut,
        moisDeChomage: option.moisRepresentatif,
      });
    } catch {
      return null;
    }
  }, [categorie, brutStr, anciennete]);

  if (!result.allocationEstimate) return null;

  const brutTouched = brutStr.trim().length > 0;

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="flex flex-col gap-4 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4"
    >
      <header className="flex items-start gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--info-subtle)] text-[color:var(--info)]">
          <Calculator className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h4 id={`${uid}-title`} className="text-sm font-semibold">
            {t("allocTitle")}
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("allocIntro")}
          </p>
        </div>
      </header>

      <FieldGroup className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor={catId}>{t("allocFamilyLabel")}</FieldLabel>
          <select
            id={catId}
            value={categorie}
            onChange={(event) =>
              setCategorie(event.target.value as CategorieFamiliale)
            }
            className={FIELD_CLS}
          >
            <option value="chef_menage">
              {resolve(
                CATEGORIE_LABEL_KEYS.chef_menage,
                CATEGORIE_LABELS.chef_menage,
              )}
            </option>
            <option value="isole">
              {resolve(CATEGORIE_LABEL_KEYS.isole, CATEGORIE_LABELS.isole)}
            </option>
            <option value="cohabitant">
              {resolve(
                CATEGORIE_LABEL_KEYS.cohabitant,
                CATEGORIE_LABELS.cohabitant,
              )}
            </option>
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor={brutId}>{t("allocGrossLabel")}</FieldLabel>
          <input
            id={brutId}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder={t("allocGrossPlaceholder")}
            value={brutStr}
            onChange={(event) => setBrutStr(event.target.value)}
            className={FIELD_CLS}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={ancId}>{t("allocSinceLabel")}</FieldLabel>
          <select
            id={ancId}
            value={anciennete}
            onChange={(event) =>
              setAnciennete(event.target.value as AncienneteValue)
            }
            className={FIELD_CLS}
          >
            {ANCIENNETE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {resolve(option.labelKey, option.label)}
              </option>
            ))}
          </select>
        </Field>
      </FieldGroup>

      {estimate ? (
        <div className="flex flex-col gap-3">
          <Alert
            role="status"
            className="border-[color:var(--info-border)] bg-[color:var(--info-subtle)] text-[color:var(--info-subtle-foreground)]"
          >
            <Calculator aria-hidden />
            <AlertTitle>{t("allocYouWouldGet")}</AlertTitle>
            <AlertDescription className="text-current">
              <p className="text-2xl font-semibold leading-none">
                {FMT_JOUR.format(estimate.parJour)} €
                <span className="ms-1 text-sm font-medium opacity-80">
                  {t("allocPerDay")}
                </span>
              </p>
              <p className="mt-2 text-sm font-medium">
                {t("allocPerMonth", {
                  amount: FMT_MOIS.format(estimate.parMois),
                })}
                <span className="ms-1 text-xs font-normal opacity-80">
                  {t("allocRateDetail", {
                    rate: estimate.tauxPct,
                    capped: estimate.plafondApplique ? "yes" : "no",
                    period: estimate.periodeLabel,
                  })}
                </span>
              </p>
            </AlertDescription>
          </Alert>

          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {estimate.caveats.map((caveat) => (
              <li key={caveat} className="flex gap-1.5">
                <span aria-hidden className="select-none">
                  •
                </span>
                <span>{caveat}</span>
              </li>
            ))}
          </ul>

          <Button
            render={<Link href="/outils" />}
            nativeButton={false}
            variant="outline"
            className="w-fit"
          >
            {t("allocRefineLink")}
            <ArrowRight
              data-icon="inline-end"
              className="rtl:rotate-180"
              aria-hidden
            />
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {brutTouched ? t("allocHintTouched") : t("allocHintEmpty")}
        </p>
      )}
    </section>
  );
}
