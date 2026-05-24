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
import { AlertCircle } from "lucide-react";
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
  fmtNumber,
  parseNum,
} from "./_shared";

type Statut = "isole" | "menage";

export function CalcPension({ accent }: { accent: string }) {
  const [dateNaissance, setDateNaissance] = useState("");
  const [anneesCarriere, setAnneesCarriere] = useState("");
  const [periodesAssimilees, setPeriodesAssimilees] = useState("");
  const [salaireMoyen, setSalaireMoyen] = useState("");
  const [statut, setStatut] = useState<Statut>("isole");
  const [ageDepart, setAgeDepart] = useState("65");

  const [result, setResult] = useState<PensionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const carriere = parseNum(anneesCarriere);
    const assimilees = periodesAssimilees ? parseNum(periodesAssimilees) : 0;
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
    if (periodesAssimilees && !Number.isFinite(assimilees)) {
      setError("Indiquez un nombre d'années assimilées valide (ou laissez vide).");
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
      periodesAssimilees: assimilees,
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

  const inelig =
    result && result.eligibiliteAnticipee.possible === false
      ? result.eligibiliteAnticipee
      : null;

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
          label="Années de carrière effectives"
          value={anneesCarriere}
          onChange={setAnneesCarriere}
          placeholder="ex : 42"
          min={0}
          max={50}
          suffix="ans"
          hint="Années réellement travaillées (hors périodes assimilées)."
        />
      </CalcGrid>

      <CalcField
        id="pension-assimilees"
        label="Périodes assimilées (années équivalentes)"
        value={periodesAssimilees}
        onChange={setPeriodesAssimilees}
        placeholder="0"
        min={0}
        max={50}
        suffix="ans"
        hint="Chômage indemnisé, maladie de longue durée, congé parental, service militaire, crédit-temps reconnu… Comptent pour la carrière. Laissez vide si aucune."
      />

      <CalcField
        id="pension-salaire"
        label="Salaire annuel brut moyen sur la carrière"
        value={salaireMoyen}
        onChange={setSalaireMoyen}
        placeholder="ex : 45000"
        suffix="€"
        hint="Moyenne sur toute la carrière (pas le dernier salaire). Plafonné à 69 521 €/an en 2026."
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
          hint="Départ anticipé soumis à conditions de carrière (voir ci-dessous)."
        />
      </CalcGrid>

      <CalcInfo>
        <strong>Âge légal de la pension</strong> : 65 ans (né avant 1960),
        66 ans (1960-1963), <strong>67 ans</strong> pour les personnes nées à
        partir de 1964. <strong>Départ anticipé</strong> possible uniquement
        si carrière suffisante : 44 ans à 60 ans, 43 ans à 61 ans, 42 ans
        entre 62 et 64 ans.
      </CalcInfo>

      {error ? <CalcError>{error}</CalcError> : null}

      <CalcSubmitButton accent={accent} onClick={handleCalc}>
        Estimer ma pension
      </CalcSubmitButton>

      {result && inelig ? (
        <div
          className="mt-2 rounded-2xl p-5 sm:p-6"
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1.5px solid rgba(245, 158, 11, 0.35)",
          }}
        >
          <div
            className="flex items-start gap-2 text-[11px] font-bold uppercase tracking-[0.06em]"
            style={{ color: "rgb(180, 83, 9)" }}
          >
            <AlertCircle className="size-4 shrink-0" />
            Départ anticipé non éligible
          </div>
          <div className="mt-2 text-[14px] leading-[1.55] font-semibold text-[color:var(--glass-ink)]">
            {inelig.raison}
          </div>
          <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-[color:var(--glass-surface)] p-3.5 text-[12.5px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                Âge de départ demandé
              </span>
              <span className="font-semibold text-[color:var(--glass-ink)]">
                {result.ageDepart} ans
              </span>
            </div>
            {inelig.conditionCarriere !== undefined ? (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[color:var(--glass-ink-soft)]">
                  Carrière minimum à cet âge
                </span>
                <span className="font-semibold text-[color:var(--glass-ink)]">
                  {inelig.conditionCarriere} ans
                </span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                Carrière totale déclarée
              </span>
              <span className="font-semibold text-[color:var(--glass-ink)]">
                {fmtNumber(result.carriereTotale, result.carriereTotale % 1 === 0 ? 0 : 1)} ans
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                Âge légal de pension
              </span>
              <span className="font-semibold text-[color:var(--glass-ink)]">
                {result.ageLegal} ans
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 pt-1">
              <span className="text-[color:var(--glass-ink-soft)]">
                Pension estimée à l'âge légal
              </span>
              <span className="font-bold text-[color:var(--glass-ink)]">
                {fmtEUR(result.pensionMensuelle)} / mois
              </span>
            </div>
          </div>
          <div className="mt-3.5 rounded-xl bg-[color:var(--glass-surface)] p-3.5 text-[11.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            <strong>Bon à savoir</strong> — le régime salarié belge ne
            permet pas de partir avec un simple malus financier : il faut
            atteindre la carrière minimum. Vérifiez votre compte de carrière
            officiel sur <strong>mypension.be</strong>, certaines périodes
            que vous n'avez pas saisies ici peuvent être assimilées.
          </div>
        </div>
      ) : null}

      {result && !inelig ? (
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
              label: "Carrière effective",
              value: `${result.anneesCarriere} ans`,
            },
            ...(result.periodesAssimilees > 0
              ? [
                  {
                    label: "Périodes assimilées",
                    value: `${fmtNumber(result.periodesAssimilees, result.periodesAssimilees % 1 === 0 ? 0 : 1)} ans`,
                  },
                ]
              : []),
            {
              label: "Carrière totale prise en compte",
              value: `${fmtNumber(Math.min(result.carriereTotale, 45), result.carriereTotale % 1 === 0 ? 0 : 1)} / 45 ans${result.longueCarriere ? " (plafonnée)" : ""}`,
            },
            {
              label: "Salaire pris en compte",
              value: result.plafondAtteint
                ? `${fmtEUR(69521)} (plafonné)`
                : fmtEUR(parseNum(salaireMoyen)),
            },
            { label: "Taux applicable", value: result.statutLabel },
            {
              label: "Âge légal de pension",
              value: `${result.ageLegal} ans`,
            },
            {
              label: "Âge de départ retenu",
              value:
                result.ageEffectif === result.ageDepart
                  ? `${result.ageEffectif} ans`
                  : `${result.ageEffectif} ans (âge légal)`,
            },
            ...(result.eligibiliteAnticipee.possible &&
            result.eligibiliteAnticipee.conditionCarriere !== undefined
              ? [
                  {
                    label: "Anticipation autorisée",
                    value: `carrière ≥ ${result.eligibiliteAnticipee.conditionCarriere} ans à ${result.eligibiliteAnticipee.conditionAge} ans`,
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
              {result.longueCarriere ? (
                <div className="mb-2">
                  <strong>Longue carrière</strong> — vous totalisez plus de
                  45 ans (assimilations comprises). Le régime salarié
                  proratise toujours à 45/45, il n'y a pas de bonus pour les
                  années supplémentaires.
                </div>
              ) : null}
              <strong>Estimation indicative</strong> — formule simplifiée
              2026 (taux, plafonds et minimum garanti arrondis ; pas de
              malus linéaire : l'éligibilité au départ anticipé dépend
              uniquement de la carrière minimum requise par âge — 44 ans à
              60 ans, 43 ans à 61 ans, 42 ans entre 62 et 64 ans). La
              pension réelle dépend du compte de carrière individuel
              (salaires plafonnés année par année, périodes assimilées
              valorisées en jours équivalents temps plein). Pour le calcul
              officiel et personnalisé, consultez{" "}
              <strong>mypension.be</strong>. Source : SFP — Service Fédéral
              des Pensions.
            </>
          }
        />
      ) : null}
    </CalcLayout>
  );
}
