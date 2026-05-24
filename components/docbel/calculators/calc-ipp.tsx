"use client";

/**
 * Calculateur Impôt des Personnes Physiques (IPP) — Belgique, EI 2026.
 *
 * S'appuie sur la logique pure de `@/lib/calculators/ipp` et les UI
 * primitives partagées de `./_shared`. Calcul à la demande (clic).
 */

import React, { useState } from "react";
import {
  calcIPP,
  type IPPResult,
  type StatutIPP,
} from "@/lib/calculators/ipp";
import {
  CalcLayout,
  CalcGrid,
  CalcField,
  CalcSelect,
  CalcSubmitButton,
  CalcResult,
  CalcError,
  fmtEUR,
  parseNum,
} from "./_shared";

const STATUTS: { value: StatutIPP; label: string }[] = [
  { value: "isole", label: "Isolé(e)" },
  { value: "marie_un_revenu", label: "Marié — un seul revenu" },
  { value: "marie_deux_revenus", label: "Marié — deux revenus" },
];

export function CalcIPP({ accent }: { accent: string }) {
  const [revenu, setRevenu] = useState("");
  const [statut, setStatut] = useState<StatutIPP>("isole");
  const [enfants, setEnfants] = useState("0");
  const [autres, setAutres] = useState("0");
  const [additionnel, setAdditionnel] = useState("7.5");

  const [result, setResult] = useState<IPPResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const revenuNum = parseNum(revenu);
    const enfantsNum = parseInt(enfants, 10);
    const autresNum = parseInt(autres, 10);
    const additionnelNum = parseNum(additionnel);

    if (!Number.isFinite(revenuNum)) {
      setError("Indiquez un revenu annuel valide.");
      return;
    }
    if (!Number.isInteger(enfantsNum) || enfantsNum < 0) {
      setError("Le nombre d'enfants doit être un entier positif.");
      return;
    }
    if (!Number.isInteger(autresNum) || autresNum < 0) {
      setError(
        "Le nombre d'autres personnes à charge doit être un entier positif.",
      );
      return;
    }
    if (!Number.isFinite(additionnelNum)) {
      setError("Indiquez un additionnel communal valide.");
      return;
    }

    const res = calcIPP({
      revenuAnnuelImposable: revenuNum,
      statut,
      enfants: enfantsNum,
      autresPersonnesACharge: autresNum,
      additionnelCommunal: additionnelNum,
    });

    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
  };

  return (
    <CalcLayout
      intro={
        <>
          Estimation de votre <strong>impôt des personnes physiques</strong>{" "}
          (IPP) belge — exercice d&apos;imposition 2026 (revenus 2025).
          Calcul fédéral progressif + additionnel communal. Voir disclaimer
          pour les crédits non simulés.
        </>
      }
    >
      <CalcField
        id="ipp-revenu"
        label="Revenu annuel imposable net (€/an)"
        hint="Revenu après ONSS et frais pro forfaitaires (≈ salaire annuel brut × 0,73)"
        value={revenu}
        onChange={setRevenu}
        placeholder="ex : 35000"
        suffix="€"
        min={0}
      />

      <CalcSelect<StatutIPP>
        id="ipp-statut"
        label="Statut familial"
        value={statut}
        onChange={setStatut}
        options={STATUTS}
      />

      <CalcGrid cols={2}>
        <CalcField
          id="ipp-enfants"
          label="Enfants à charge"
          value={enfants}
          onChange={setEnfants}
          placeholder="0"
          min={0}
          max={10}
          step={1}
        />
        <CalcField
          id="ipp-autres"
          label="Autres personnes à charge"
          hint="Parents âgés, etc."
          value={autres}
          onChange={setAutres}
          placeholder="0"
          min={0}
          max={5}
          step={1}
        />
      </CalcGrid>

      <CalcField
        id="ipp-additionnel"
        label="Additionnel communal (%)"
        hint="Moyenne belge : 7,5 %. Anvers 7 %, Bruxelles-Ville 7 %, Liège 8 %, Charleroi 8,5 %."
        value={additionnel}
        onChange={setAdditionnel}
        placeholder="7.5"
        suffix="%"
        min={0}
        max={15}
        step={0.1}
      />

      {error ? <CalcError>{error}</CalcError> : null}

      <CalcSubmitButton accent={accent} onClick={handleCalc}>
        Calculer mon impôt
      </CalcSubmitButton>

      {result ? (
        <CalcResult
          accent={accent}
          headline={fmtEUR(result.impotTotal)}
          unit="/ an"
          subtext={
            <>
              Taux moyen{" "}
              <strong>{result.tauxMoyen.toFixed(1)} %</strong> — Taux marginal{" "}
              <strong>{result.tauxMarginal.toFixed(0)} %</strong>
            </>
          }
          rows={[
            {
              label: "Impôt fédéral brut",
              value: fmtEUR(result.impotBrutFederal),
            },
            {
              label: "− Réduction quotité exemptée",
              value: `− ${fmtEUR(result.reductionQuotite)}`,
            },
            {
              label: "Quotité exemptée appliquée",
              value: fmtEUR(result.quotiteExemptee),
            },
            {
              label: "+ Additionnel communal",
              value: `+ ${fmtEUR(result.additionnelCommunalEur)}`,
            },
            {
              label: "Revenu net après impôt (annuel)",
              value: fmtEUR(result.revenuNetApresImpot),
              emphasis: true,
            },
          ]}
          footer={
            <>
              <strong>Estimation simplifiée.</strong> Le calcul réel intègre
              crédits d&apos;impôt (épargne pension, titres-services, dons,
              prêts hypothécaires…) non simulés ici. Source : SPF Finances.
              Pour le calcul officiel : <strong>Tax-on-web</strong>.
            </>
          }
        />
      ) : null}
    </CalcLayout>
  );
}
