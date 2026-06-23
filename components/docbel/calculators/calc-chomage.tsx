"use client";

/**
 * Calculateur des allocations de chômage ONEM (Belgique).
 *
 * Présentationnel uniquement : toute la logique est dans
 * `@/lib/calculators/chomage`. Ce composant se contente de :
 *   - collecter les inputs (salaire, situation familiale, phase)
 *   - appeler `calcChomage()` sur clic
 *   - afficher le résultat via les primitives partagées de `_shared`.
 *
 * Disclaimer : voir le footer de CalcResult — l'utilisateur DOIT vérifier
 * son chiffre auprès de son organisme de paiement (CAPAC, syndicat).
 */

import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  calcChomage,
  PHASES_INFO,
  type ChomagePhase,
  type ChomageResult,
  type SituationFamiliale,
} from "@/lib/calculators/chomage";

import {
  CalcError,
  CalcField,
  CalcGrid,
  CalcInfo,
  CalcLayout,
  CalcResult,
  CalcSelect,
  CalcSubmitButton,
  fmtEUR,
  fmtPct,
  parseNum,
} from "./_shared";

const PHASE_OPTIONS: { value: ChomagePhase; label: string }[] = PHASES_INFO.map(
  (p) => ({
    value: p.id,
    label: `${p.label} — ${p.periode_description}`,
  }),
);

export function CalcChomage({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  const [salaire, setSalaire] = useState("");
  const [situation, setSituation] = useState<SituationFamiliale>("chef_menage");
  const [phase, setPhase] = useState<ChomagePhase>("1A");
  const [result, setResult] = useState<ChomageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const SITUATION_OPTIONS: { value: SituationFamiliale; label: string }[] = [
    { value: "chef_menage", label: t("choSituationChefMenage") },
    { value: "isole", label: t("choSituationIsole") },
    { value: "cohabitant", label: t("choSituationCohabitant") },
  ];

  const submit = () => {
    const salaireBrut = parseNum(salaire);
    const res = calcChomage({
      salaireBrut,
      situationFamiliale: situation,
      phase,
    });
    if ("error" in res) {
      setResult(null);
      setError(res.error);
      return;
    }
    setError(null);
    setResult(res);
  };

  return (
    <CalcLayout
      intro={t.rich("choIntro", {
        strong: (chunks) => <strong>{chunks}</strong>,
      })}
    >
      <CalcField
        id="chomage-salaire"
        label={t("choSalaireLabel")}
        type="number"
        value={salaire}
        onChange={setSalaire}
        placeholder={t("choSalairePlaceholder")}
        min={0}
        step={10}
        suffix="€"
        hint={t("choSalaireHint")}
      />

      <CalcGrid cols={2}>
        <CalcSelect
          id="chomage-situation"
          label={t("choSituationLabel")}
          value={situation}
          onChange={setSituation}
          options={SITUATION_OPTIONS}
        />
        <CalcSelect
          id="chomage-phase"
          label={t("choPhaseLabel")}
          value={phase}
          onChange={setPhase}
          options={PHASE_OPTIONS}
          hint={t("choPhaseHint")}
        />
      </CalcGrid>

      <CalcInfo>
        {t.rich("choInfo", {
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </CalcInfo>

      <CalcSubmitButton accent={accent} onClick={submit}>
        {t("choSubmit")}
      </CalcSubmitButton>

      {error ? <CalcError>{error}</CalcError> : null}

      {result ? (
        <CalcResult
          accent={accent}
          headline={fmtEUR(result.allocationMensuelle)}
          unit={t("choResultUnit")}
          subtext={t.rich("choResultSubtext", {
            amount: fmtEUR(result.allocationJournaliere),
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
          rows={[
            {
              label: t("choRowSalaire"),
              value:
                result.salairePlafonne < parseNum(salaire)
                  ? t("choPlafonneSuffix", {
                      amount: fmtEUR(result.salairePlafonne),
                    })
                  : fmtEUR(result.salairePlafonne),
            },
            {
              label: t("choRowPlafond"),
              value: fmtEUR(result.plafondApplique),
            },
            {
              label: t("choRowTaux"),
              value: fmtPct(result.tauxApplique * 100, 0),
            },
            { label: t("choRowPhase"), value: result.phaseLabel },
            {
              label: t("choRowSituation"),
              value: result.situationLabel,
              emphasis: true,
            },
          ]}
          footer={t.rich("choFooter", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        />
      ) : null}
    </CalcLayout>
  );
}
