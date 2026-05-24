"use client";

/**
 * Calculateur Impôt des Personnes Physiques (IPP) — Belgique, EI 2026.
 *
 * Version enrichie : intègre les réductions d'impôt principales (épargne
 * pension, titres-services, dons, prêt hypo, garde enfants), le quotient
 * conjugal (marié 1 revenu) et la cotisation spéciale sécurité sociale.
 *
 * S'appuie sur la logique pure de `@/lib/calculators/ipp` et les UI
 * primitives partagées de `./_shared`. Calcul à la demande (clic).
 */

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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

  /* -- Réductions (masquées par défaut) -- */
  const [showReductions, setShowReductions] = useState(false);
  const [epargnePension, setEpargnePension] = useState("0");
  const [titresServices, setTitresServices] = useState("0");
  const [dons, setDons] = useState("0");
  const [pretHypo, setPretHypo] = useState("0");
  const [gardeEnfants, setGardeEnfants] = useState("0");

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

    // Parse réductions (vide / NaN → 0)
    const safeNum = (s: string) => {
      const n = parseNum(s);
      return Number.isFinite(n) ? n : 0;
    };

    const res = calcIPP({
      revenuAnnuelImposable: revenuNum,
      statut,
      enfants: enfantsNum,
      autresPersonnesACharge: autresNum,
      additionnelCommunal: additionnelNum,
      epargnePension: safeNum(epargnePension),
      titresServices: safeNum(titresServices),
      dons: safeNum(dons),
      pretHypothecaire: safeNum(pretHypo),
      gardeEnfants: safeNum(gardeEnfants),
    });

    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
  };

  const rows = result
    ? [
        {
          label: "Impôt fédéral brut",
          value: fmtEUR(result.impotBrutFederal),
        },
        {
          label: "− Réduction quotité exemptée",
          value: `− ${fmtEUR(result.reductionQuotite)}`,
        },
        ...(result.allegementQuotientConjugal > 0
          ? [
              {
                label: "− Quotient conjugal (approx.)",
                value: `− ${fmtEUR(result.allegementQuotientConjugal)}`,
              },
            ]
          : []),
        ...(result.reductionsTotales > 0
          ? [
              {
                label: "− Réductions d'impôt appliquées",
                value: `− ${fmtEUR(result.reductionsTotales)}`,
              },
            ]
          : []),
        {
          label: "+ Additionnel communal",
          value: `+ ${fmtEUR(result.additionnelCommunalEur)}`,
        },
        ...(result.cotisationSpecialeSecu > 0
          ? [
              {
                label: "+ Cotisation spéciale sécu",
                value: `+ ${fmtEUR(result.cotisationSpecialeSecu)}`,
              },
            ]
          : []),
        {
          label: "Revenu net après impôt (annuel)",
          value: fmtEUR(result.revenuNetApresImpot),
          emphasis: true,
        },
      ]
    : [];

  return (
    <CalcLayout
      intro={
        <>
          Estimation de votre <strong>impôt des personnes physiques</strong>{" "}
          (IPP) belge — exercice d&apos;imposition 2026 (revenus 2025).
          Calcul fédéral progressif, additionnel communal, principales
          réductions d&apos;impôt et cotisation spéciale sécurité sociale.
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
        hint="Le quotient conjugal s'applique automatiquement si « marié — un seul revenu »."
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

      {/* -- Toggle réductions d'impôt -- */}
      <button
        type="button"
        onClick={() => setShowReductions((v) => !v)}
        className="flex items-center justify-between gap-2 rounded-xl border-[1.5px] border-dashed border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
      >
        <span>
          {showReductions
            ? "Masquer les réductions d'impôt"
            : "Ajouter des réductions d'impôt (épargne pension, titres-services…)"}
        </span>
        {showReductions ? (
          <ChevronUp className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )}
      </button>

      {showReductions ? (
        <div className="flex flex-col gap-3 rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3.5">
          <p className="text-[11.5px] leading-[1.6] text-[color:var(--glass-ink-faint)]">
            Renseignez les montants <strong>annuels</strong> effectivement
            versés ou dépensés. Le simulateur applique le taux de réduction
            standard pour chaque poste (épargne pension 30 %, titres-services
            ≈ 15 %, dons 45 %, prêt hypothécaire ≈ 30 %, garde d&apos;enfants
            45 %).
          </p>

          <CalcField
            id="ipp-epargne-pension"
            label="Épargne pension (€/an)"
            hint="Versement max ouvrant droit : 1 130 €/an (réduction 30 % = jusqu'à 339 €)."
            value={epargnePension}
            onChange={setEpargnePension}
            placeholder="0"
            suffix="€"
            min={0}
            max={5000}
            step={10}
          />

          <CalcField
            id="ipp-titres-services"
            label="Titres-services achetés (€/an)"
            hint="Plafond 1 500 €/an. Taux réel : Wallonie 10 %, Bruxelles 15 %, Flandre 20 % (moyenne 15 %)."
            value={titresServices}
            onChange={setTitresServices}
            placeholder="0"
            suffix="€"
            min={0}
            max={5000}
            step={10}
          />

          <CalcField
            id="ipp-dons"
            label="Dons à associations agréées (€/an)"
            hint="Réduction 45 % à partir de 40 €/an par bénéficiaire."
            value={dons}
            onChange={setDons}
            placeholder="0"
            suffix="€"
            min={0}
            step={10}
          />

          <CalcField
            id="ipp-pret-hypo"
            label="Prêt hypothécaire — capital + intérêts (€/an)"
            hint="Chèque habitation régional moyen ≈ 30 %. Varie selon région et date d'emprunt."
            value={pretHypo}
            onChange={setPretHypo}
            placeholder="0"
            suffix="€"
            min={0}
            step={50}
          />

          <CalcField
            id="ipp-garde-enfants"
            label="Frais de garde d'enfants (€/an)"
            hint="Enfants < 14 ans (< 21 ans si handicap). Réduction 45 %, plafond 16,40 €/jour/enfant."
            value={gardeEnfants}
            onChange={setGardeEnfants}
            placeholder="0"
            suffix="€"
            min={0}
            step={10}
          />
        </div>
      ) : null}

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
          rows={rows}
          footer={
            <>
              <strong>Estimation pédagogique.</strong> Intègre les principales
              réductions d&apos;impôt et le quotient conjugal de façon
              simplifiée ; ne couvre pas les revenus mobiliers, immobiliers,
              les pensions alimentaires versées, les bonus à l&apos;emploi, ni
              les particularismes régionaux fins. Source : SPF Finances. Pour
              le calcul officiel : <strong>Tax-on-web</strong>.
            </>
          }
        />
      ) : null}
    </CalcLayout>
  );
}
