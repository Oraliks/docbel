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
  phaseFromMonths,
  PHASES_INFO,
  type ChomageEstimation,
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

/** Estimation chiffrée (1ʳᵉ période) issue du moteur. */
type ChomageEstime = Extract<ChomageEstimation, { statut: "estime" }>;

/** Ce que l'UI affiche après un clic : montant chiffré, forfait à vérifier, ou fin de droit. */
type ResultView =
  | { kind: "estime"; data: ChomageEstime }
  | { kind: "a_verifier"; situationLabel: string }
  | { kind: "fin_de_droit" };

export function CalcChomage({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  const [salaire, setSalaire] = useState("");
  const [situation, setSituation] = useState<SituationFamiliale>("chef_menage");
  // Ancienneté de chômage (mois) — la phase d'indemnisation en est DÉDUITE
  // (plus de sélecteur 1A/1B/… : personne ne connaît sa « phase »).
  const [mois, setMois] = useState("");
  const [result, setResult] = useState<ResultView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const SITUATION_OPTIONS: { value: SituationFamiliale; label: string }[] = [
    { value: "chef_menage", label: t("choSituationChefMenage") },
    { value: "isole", label: t("choSituationIsole") },
    { value: "cohabitant", label: t("choSituationCohabitant") },
  ];

  // Phase déduite, affichée en direct pour la transparence (le montant baisse
  // par paliers avec le temps, puis fin de droit à 24 mois). `phaseFromMonths`
  // tolère NaN → mois 1 (1A), et renvoie "fin_de_droit" au-delà de 24 mois.
  const derivedPhase = phaseFromMonths(parseNum(mois));
  const derivedInfo =
    derivedPhase === "fin_de_droit"
      ? null
      : PHASES_INFO.find((p) => p.id === derivedPhase);

  const submit = () => {
    // Au-delà de 24 mois : fin de droit (réforme 2026) — pas de calcul.
    if (derivedPhase === "fin_de_droit") {
      setError(null);
      setResult({ kind: "fin_de_droit" });
      return;
    }
    const res = calcChomage({
      salaireBrut: parseNum(salaire),
      situationFamiliale: situation,
      phase: derivedPhase,
    });
    if ("error" in res) {
      setResult(null);
      setError(res.error);
      return;
    }
    setError(null);
    if (res.statut === "forfait_a_verifier") {
      // 2ᵉ période (mois 13-24) : forfait familial, montant non publié.
      setResult({ kind: "a_verifier", situationLabel: res.situationLabel });
    } else {
      setResult({ kind: "estime", data: res });
    }
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
        <CalcField
          id="chomage-mois"
          label={t("choMoisLabel")}
          type="number"
          value={mois}
          onChange={setMois}
          placeholder={t("choMoisPlaceholder")}
          min={0}
          step={1}
          hint={t("choMoisHint")}
        />
      </CalcGrid>

      {mois && derivedInfo ? (
        <p
          aria-live="polite"
          className="-mt-1 text-[11.5px] text-[color:var(--glass-ink-soft)]"
        >
          {t("choPhaseDeduite", {
            periode: derivedInfo.label,
            detail: derivedInfo.periode_description,
          })}
        </p>
      ) : mois && derivedPhase === "fin_de_droit" ? (
        <p
          aria-live="polite"
          className="-mt-1 text-[11.5px] text-[color:var(--glass-ink-soft)]"
        >
          {t("choPhaseDeduiteFinDroit")}
        </p>
      ) : null}

      <CalcInfo>
        {t.rich("choInfo", {
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </CalcInfo>

      <CalcSubmitButton accent={accent} onClick={submit}>
        {t("choSubmit")}
      </CalcSubmitButton>

      {error ? <CalcError>{error}</CalcError> : null}

      {result?.kind === "estime" ? (
        <CalcResult
          accent={accent}
          headline={fmtEUR(result.data.allocationMensuelle)}
          unit={t("choResultUnit")}
          subtext={t.rich("choResultSubtext", {
            amount: fmtEUR(result.data.allocationJournaliere),
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
          rows={[
            {
              label: t("choRowSalaire"),
              value:
                result.data.salairePlafonne < parseNum(salaire)
                  ? t("choPlafonneSuffix", {
                      amount: fmtEUR(result.data.salairePlafonne),
                    })
                  : fmtEUR(result.data.salairePlafonne),
            },
            {
              label: t("choRowPlafond"),
              value: fmtEUR(result.data.plafondApplique),
            },
            {
              label: t("choRowTaux"),
              value: fmtPct(result.data.tauxApplique * 100, 0),
            },
            { label: t("choRowPhase"), value: result.data.phaseLabel },
            {
              label: t("choRowSituation"),
              value: result.data.situationLabel,
              emphasis: true,
            },
          ]}
          footer={t.rich("choFooter", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        />
      ) : result?.kind === "a_verifier" ? (
        // 2ᵉ période (mois 13-24) : forfait familial, montant non publié par l'ONEM.
        <CalcResult
          accent={accent}
          eyebrow={t("choResultAVerifierEyebrow")}
          headline={t("choResultAVerifierHeadline")}
          subtext={t.rich("choResultAVerifierBody", {
            situation: result.situationLabel,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
          footer={t.rich("choFooter", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        />
      ) : result?.kind === "fin_de_droit" ? (
        // Au-delà de 24 mois : limitation dans le temps (réforme 2026).
        <CalcResult
          accent={accent}
          eyebrow={t("choResultFinDroitEyebrow")}
          headline={t("choResultFinDroitHeadline")}
          subtext={t.rich("choResultFinDroitBody", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
          footer={t.rich("choFooter", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        />
      ) : null}
    </CalcLayout>
  );
}
