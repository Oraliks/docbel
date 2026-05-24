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

const SITUATION_OPTIONS: { value: SituationFamiliale; label: string }[] = [
  { value: "chef_menage", label: "Chef de ménage (charge de famille)" },
  { value: "isole", label: "Isolé (vit seul)" },
  { value: "cohabitant", label: "Cohabitant (sans charge)" },
];

const PHASE_OPTIONS: { value: ChomagePhase; label: string }[] = PHASES_INFO.map(
  (p) => ({
    value: p.id,
    label: `${p.label} — ${p.periode_description}`,
  }),
);

export function CalcChomage({ accent }: { accent: string }) {
  const [salaire, setSalaire] = useState("");
  const [situation, setSituation] = useState<SituationFamiliale>("chef_menage");
  const [phase, setPhase] = useState<ChomagePhase>("1A");
  const [result, setResult] = useState<ChomageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      intro={
        <>
          Estimez votre <strong>allocation de chômage mensuelle</strong> en
          fonction de votre dernier salaire, de votre situation familiale et de
          la phase de dégressivité ONEM. Les montants belges sont dégressifs
          dans le temps.
        </>
      }
    >
      <CalcField
        id="chomage-salaire"
        label="Salaire mensuel brut (€)"
        type="number"
        value={salaire}
        onChange={setSalaire}
        placeholder="ex : 2 500"
        min={0}
        step={10}
        suffix="€"
        hint="Votre dernier salaire de référence avant le chômage."
      />

      <CalcGrid cols={2}>
        <CalcSelect
          id="chomage-situation"
          label="Situation familiale"
          value={situation}
          onChange={setSituation}
          options={SITUATION_OPTIONS}
        />
        <CalcSelect
          id="chomage-phase"
          label="Phase de chômage"
          value={phase}
          onChange={setPhase}
          options={PHASE_OPTIONS}
          hint="Plus la période est longue, plus l'allocation diminue."
        />
      </CalcGrid>

      <CalcInfo>
        Le chômage en Belgique est <strong>dégressif</strong> : taux et plafonds
        baissent progressivement (mois 1-3 → 4-6 → 7-12 → 13-24 → an 2-3 → au-delà).
        Le montant final est borné par un minimum et un maximum forfaitaires
        selon la situation familiale.
      </CalcInfo>

      <CalcSubmitButton accent={accent} onClick={submit}>
        Calculer mon allocation
      </CalcSubmitButton>

      {error ? <CalcError>{error}</CalcError> : null}

      {result ? (
        <CalcResult
          accent={accent}
          headline={fmtEUR(result.allocationMensuelle)}
          unit="/ mois"
          subtext={
            <>
              ≈ <strong>{fmtEUR(result.allocationJournaliere)}</strong> / jour
              (régime 6 jours/semaine)
            </>
          }
          rows={[
            {
              label: "Salaire pris en compte",
              value:
                result.salairePlafonne < parseNum(salaire)
                  ? `${fmtEUR(result.salairePlafonne)} (plafonné)`
                  : fmtEUR(result.salairePlafonne),
            },
            {
              label: "Plafond applicable",
              value: fmtEUR(result.plafondApplique),
            },
            {
              label: "Taux appliqué",
              value: fmtPct(result.tauxApplique * 100, 0),
            },
            { label: "Phase", value: result.phaseLabel },
            {
              label: "Situation",
              value: result.situationLabel,
              emphasis: true,
            },
          ]}
          footer={
            <>
              Estimation indicative basée sur les barèmes ONEM 2026 simplifiés.
              Le montant réel intègre votre carrière, le précompte
              professionnel et d&apos;éventuels compléments.{" "}
              <strong>
                Source : ONEM. Pour votre cas exact, contactez votre organisme
                de paiement (CAPAC, syndicat).
              </strong>
            </>
          }
        />
      ) : null}
    </CalcLayout>
  );
}
