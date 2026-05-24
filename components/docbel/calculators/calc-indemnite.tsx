"use client";

/**
 * Calculateur d'indemnité compensatoire de préavis — complément du
 * calculateur de préavis (qui donne la durée en semaines).
 *
 * S'appuie sur la logique pure de `@/lib/calculators/indemnite-rupture`
 * et les UI primitives partagées de `./_shared`. Pas de styles inline.
 *
 * Cohérent avec CalcBrutNet : calcul à la demande (clic bouton).
 */

import React, { useState } from "react";
import {
  calcIndemniteRupture,
  type IndemniteResult,
  type ProtectionSpeciale,
} from "@/lib/calculators/indemnite-rupture";
import {
  CalcLayout,
  CalcField,
  CalcRadio,
  CalcSelect,
  CalcSubmitButton,
  CalcResult,
  CalcError,
  fmtEUR,
  fmtNumber,
  parseNum,
} from "./_shared";

type OuiNon = "oui" | "non";

const PROTECTION_OPTIONS: { value: ProtectionSpeciale; label: string }[] = [
  { value: "aucune", label: "Aucune" },
  { value: "femme_enceinte", label: "Femme enceinte (+6 mois)" },
  { value: "delegue_syndical", label: "Délégué syndical CCT 5 (+~3 ans)" },
  { value: "travailleur_protege", label: "Travailleur protégé (+~9 mois)" },
];

export function CalcIndemnite({ accent }: { accent: string }) {
  const [salaire, setSalaire] = useState("");
  const [preavis, setPreavis] = useState("");
  const [inclureAvantages, setInclureAvantages] = useState<OuiNon>("non");
  const [avantages, setAvantages] = useState("");
  const [precompte, setPrecompte] = useState<OuiNon>("oui");
  const [protection, setProtection] = useState<ProtectionSpeciale>("aucune");

  const [result, setResult] = useState<IndemniteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const salaireNum = parseNum(salaire);
    const preavisNum = parseNum(preavis);
    const avantagesNum = parseNum(avantages);

    if (!Number.isFinite(salaireNum)) {
      setError("Indiquez un salaire brut mensuel valide.");
      return;
    }
    if (!Number.isFinite(preavisNum)) {
      setError("Indiquez une durée de préavis en semaines.");
      return;
    }

    const res = calcIndemniteRupture({
      salaireBrutMensuel: salaireNum,
      dureePreavisSemaines: preavisNum,
      avantagesAnnuels: Number.isFinite(avantagesNum) ? avantagesNum : 0,
      inclureAvantages: inclureAvantages === "oui",
      precompte: precompte === "oui",
      protectionSpeciale: protection,
    });

    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
  };

  const avecPrecompte = precompte === "oui";

  const rows = result
    ? [
        {
          label: "Rémunération mensuelle de base",
          value: fmtEUR(result.remunerationMensuelle),
        },
        {
          label: "Rémunération hebdomadaire (×3/13)",
          value: fmtEUR(result.remunerationHebdomadaire),
        },
        {
          label: "Préavis non presté",
          value: `${result.preavisSemaines} sem.`,
        },
        {
          label: "Indemnité standard",
          value: fmtEUR(result.indemniteBrute),
        },
        ...(result.indemniteProtectionSupplement > 0
          ? [
              {
                label: "Indemnité de protection",
                value: fmtEUR(result.indemniteProtectionSupplement),
              },
            ]
          : []),
        {
          label: "Total brut",
          value: fmtEUR(result.indemniteTotalBrute),
          emphasis: true,
        },
        ...(avecPrecompte
          ? [
              {
                label: "Taux de précompte appliqué",
                value: `${fmtNumber(result.tauxPrecompteAppliquePourcent, 2)} %`,
              },
              {
                label: "Net estimé",
                value: fmtEUR(result.indemniteNetEstimee),
                emphasis: true,
              },
            ]
          : []),
        ...(result.cotisationSpecialeEmployeur > 0
          ? [
              {
                label: "Cotisation spéciale employeur (info)",
                value: fmtEUR(result.cotisationSpecialeEmployeur),
              },
            ]
          : []),
      ]
    : [];

  return (
    <CalcLayout
      intro={
        <>
          Calcule l&apos;<strong>indemnité compensatoire de préavis</strong> due
          quand l&apos;employeur rompt le contrat sans faire prester le préavis.
          Combine avec le calculateur de préavis pour obtenir la durée en
          semaines.
        </>
      }
    >
      <CalcField
        id="indemnite-salaire"
        label="Salaire mensuel brut"
        hint="Montant indiqué sur votre fiche de paie avant retenues."
        value={salaire}
        onChange={setSalaire}
        placeholder="ex : 3000"
        suffix="€"
        min={0}
      />

      <CalcField
        id="indemnite-preavis"
        label="Durée du préavis non presté (semaines)"
        hint="Voir le calculateur de préavis pour cette valeur."
        value={preavis}
        onChange={setPreavis}
        placeholder="ex : 13"
        suffix="sem."
        min={0}
        max={200}
      />

      <CalcRadio<OuiNon>
        label="Inclure les avantages extra-légaux ?"
        hint="Prime fin d'année, double pécule, chèques-repas annuels, assurance groupe, voiture société…"
        value={inclureAvantages}
        onChange={(v) => {
          setInclureAvantages(v);
          if (v === "non") setAvantages("");
        }}
        options={[
          { value: "non", label: "Non" },
          { value: "oui", label: "Oui" },
        ]}
        accent={accent}
      />

      {inclureAvantages === "oui" ? (
        <CalcField
          id="indemnite-avantages"
          label="Avantages extra-légaux annualisés"
          hint="Total annuel estimé (€/an). Sera divisé par 12 pour la rémunération mensuelle de base."
          value={avantages}
          onChange={setAvantages}
          placeholder="ex : 4500"
          suffix="€/an"
          min={0}
        />
      ) : null}

      <CalcSelect<ProtectionSpeciale>
        id="indemnite-protection"
        label="Protection spéciale"
        hint="Certains statuts ouvrent droit à une indemnité de protection cumulable (mois de salaire en sus)."
        value={protection}
        onChange={setProtection}
        options={PROTECTION_OPTIONS}
      />

      <CalcRadio<OuiNon>
        label="Estimer le net après précompte ?"
        hint="Précompte spécial calculé selon votre tranche de revenu annuel (barème SPF Finances)."
        value={precompte}
        onChange={setPrecompte}
        options={[
          { value: "oui", label: "Oui" },
          { value: "non", label: "Non (brut seul)" },
        ]}
        accent={accent}
      />

      {error ? <CalcError>{error}</CalcError> : null}

      <CalcSubmitButton accent={accent} onClick={handleCalc}>
        Calculer l&apos;indemnité
      </CalcSubmitButton>

      {result ? (
        <CalcResult
          accent={accent}
          headline={fmtEUR(result.indemniteTotalBrute)}
          unit="brut total"
          subtext={
            avecPrecompte ? (
              <>
                ≈ <strong>{fmtEUR(result.indemniteNetEstimee)}</strong> net après
                précompte spécial (
                {fmtNumber(result.tauxPrecompteAppliquePourcent, 2)} %)
              </>
            ) : null
          }
          rows={rows}
          footer={
            <>
              L&apos;<strong>indemnité compensatoire de préavis</strong> est due
              si l&apos;employeur rompt le contrat sans faire prester le préavis.
              Le <strong>taux de précompte</strong> est déterminé selon le
              revenu annuel de référence (salaire mensuel × 13,92), via un
              barème par tranches (de 17,16 % à 53,50 %). Si la rémunération
              annuelle ≥ 44 509 €, l&apos;employeur supporte en plus une{" "}
              <strong>cotisation spéciale de compensation</strong> de 1 % (Loi
              du 26 décembre 2013). Source :{" "}
              <strong>Loi du 3 juillet 1978</strong> sur les contrats de
              travail.
            </>
          }
        />
      ) : null}
    </CalcLayout>
  );
}
