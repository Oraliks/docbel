"use client";

/**
 * Calculateur de pension légale (salarié belge) — estimation simplifiée.
 *
 * S'appuie sur la logique pure de `@/lib/calculators/pension` et les
 * primitives UI partagées de `./_shared`. Calcul à la demande (clic),
 * pas en live — cohérent avec CalcBrutNet / CalcAGR.
 *
 * Disclaimer fort : on dirige vers mypension.be pour le calcul officiel.
 */

import React, { useState } from "react";
import {
  calcPension,
  type PensionResult,
} from "@/lib/calculators/pension";
import {
  CalcLayout,
  CalcGrid,
  CalcField,
  CalcRadio,
  CalcSubmitButton,
  CalcResult,
  CalcError,
  CalcInfo,
  fmtEUR,
  parseNum,
} from "./_shared";

type Statut = "isole" | "menage";

export function CalcPension({ accent }: { accent: string }) {
  const [dateNaissance, setDateNaissance] = useState("");
  const [anneesCarriere, setAnneesCarriere] = useState("");
  const [salaireMoyen, setSalaireMoyen] = useState("");
  const [statut, setStatut] = useState<Statut>("isole");
  const [ageDepart, setAgeDepart] = useState("65");

  const [result, setResult] = useState<PensionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const carriere = parseNum(anneesCarriere);
    const salaire = parseNum(salaireMoyen);
    const age = parseNum(ageDepart);

    if (!dateNaissance) {
      setError("Indiquez votre date de naissance.");
      return;
    }
    if (!Number.isFinite(carriere)) {
      setError("Indiquez un nombre d'années de carrière valide.");
      return;
    }
    if (!Number.isFinite(salaire)) {
      setError("Indiquez un salaire annuel moyen valide.");
      return;
    }
    if (!Number.isFinite(age)) {
      setError("Indiquez un âge de départ valide.");
      return;
    }

    const res = calcPension({
      dateNaissance,
      anneesCarriere: carriere,
      salaireMoyen: salaire,
      statut,
      ageDepart: age,
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
          Estimation rapide de votre <strong>pension légale brute</strong> de
          salarié en Belgique. Formule simplifiée 2026 — voir disclaimer.
          Pour le calcul officiel, basé sur votre compte de carrière complet,
          rendez-vous sur <strong>mypension.be</strong>.
        </>
      }
    >
      <CalcGrid cols={2}>
        <CalcField
          id="pension-naissance"
          label="Date de naissance"
          type="date"
          value={dateNaissance}
          onChange={setDateNaissance}
          hint="Sert à déterminer votre âge légal de pension."
        />
        <CalcField
          id="pension-carriere"
          label="Années de carrière prévues"
          value={anneesCarriere}
          onChange={setAnneesCarriere}
          placeholder="ex : 42"
          min={0}
          max={50}
          suffix="ans"
        />
      </CalcGrid>

      <CalcField
        id="pension-salaire"
        label="Salaire annuel brut moyen sur la carrière"
        value={salaireMoyen}
        onChange={setSalaireMoyen}
        placeholder="ex : 45000"
        suffix="€"
        hint="Moyenne sur toute la carrière (pas le dernier salaire). Plafonné à 78 690 €/an en 2026."
      />

      <CalcGrid cols={2}>
        <CalcRadio<Statut>
          label="Statut civil"
          value={statut}
          onChange={setStatut}
          options={[
            { value: "isole", label: "Isolé (60 %)" },
            { value: "menage", label: "Marié / cohabitant (75 %)" },
          ]}
          accent={accent}
          hint="Taux ménage = 75 % si conjoint sans revenu propre suffisant."
        />
        <CalcField
          id="pension-age-depart"
          label="Âge de départ envisagé"
          value={ageDepart}
          onChange={setAgeDepart}
          placeholder="ex : 65"
          min={60}
          max={70}
          suffix="ans"
          hint="Départ anticipé = malus indicatif de 5 % par an."
        />
      </CalcGrid>

      <CalcInfo>
        <strong>Âge légal de la pension</strong> : 65 ans (né avant 1960),
        66 ans (1960-1963), <strong>67 ans</strong> pour les personnes nées à
        partir de 1964.
      </CalcInfo>

      {error ? <CalcError>{error}</CalcError> : null}

      <CalcSubmitButton accent={accent} onClick={handleCalc}>
        Estimer ma pension
      </CalcSubmitButton>

      {result ? (
        <CalcResult
          accent={accent}
          headline={fmtEUR(result.pensionMensuelle)}
          unit="/ mois (brut)"
          subtext={
            <>
              ≈ <strong>{fmtEUR(result.pensionAnnuelle)}</strong> / an
            </>
          }
          rows={[
            {
              label: "Années de carrière",
              value: `${result.anneesCarriere} / 45 ans`,
            },
            {
              label: "Salaire pris en compte",
              value: result.plafondAtteint
                ? `${fmtEUR(78690)} (plafonné)`
                : fmtEUR(parseNum(salaireMoyen)),
            },
            { label: "Taux applicable", value: result.statutLabel },
            {
              label: "Âge légal de pension",
              value: `${result.ageLegal} ans`,
            },
            {
              label: "Âge de départ envisagé",
              value: `${result.ageDepart} ans`,
            },
            ...(result.malusPourcent > 0
              ? [
                  {
                    label: "Malus départ anticipé",
                    value: `− ${result.malusPourcent.toFixed(0)} %`,
                    emphasis: true,
                  },
                ]
              : []),
            {
              label: "Pension mensuelle brute",
              value: fmtEUR(result.pensionMensuelle),
              emphasis: true,
            },
          ]}
          footer={
            <>
              <strong>Estimation indicative</strong> — formule simplifiée 2026
              (taux, plafonds, minimum garanti et malus arrondis). La pension
              réelle dépend du compte de carrière individuel (salaires
              plafonnés année par année, périodes assimilées : chômage,
              maladie, crédit-temps…). Pour le calcul officiel et
              personnalisé, consultez <strong>mypension.be</strong> (compte de
              carrière complet). Source : SFP — Service Fédéral des Pensions.
            </>
          }
        />
      ) : null}
    </CalcLayout>
  );
}
