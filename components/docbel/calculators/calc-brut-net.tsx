"use client";

/**
 * Calculateur Brut → Net (et Net → Brut) — salarié belge.
 *
 * S'appuie sur la logique pure de `@/lib/calculators/brut-net` et les
 * UI primitives partagées de `./_shared`. Pas de styles inline.
 *
 * Cohérent avec CalcAGR : calcul à la demande (clic bouton), pas en live.
 */

import React, { useState } from "react";
import {
  calcBrutNet,
  calcNetToBrut,
  type BrutNetResult,
  type StatutFiscal,
  type Region,
  type MotorisationVehicule,
} from "@/lib/calculators/brut-net";
import {
  CalcLayout,
  CalcGrid,
  CalcField,
  CalcSelect,
  CalcRadio,
  CalcSubmitButton,
  CalcResult,
  CalcError,
  fmtEUR,
  parseNum,
} from "./_shared";

type Mode = "brut-net" | "net-brut";

const STATUTS: { value: StatutFiscal; label: string }[] = [
  { value: "isole", label: "Isolé(e)" },
  { value: "cohabitant", label: "Cohabitant légal" },
  { value: "marie_un_revenu", label: "Marié — un revenu" },
  { value: "marie_deux_revenus", label: "Marié — deux revenus" },
];

const REGIONS: { value: Region; label: string }[] = [
  { value: "wallonie", label: "Wallonie" },
  { value: "bruxelles", label: "Bruxelles" },
  { value: "flandre", label: "Flandre" },
];

const MOTORISATIONS: { value: MotorisationVehicule; label: string }[] = [
  { value: "essence", label: "Essence" },
  { value: "diesel", label: "Diesel" },
  { value: "hybride", label: "Hybride" },
  { value: "electrique", label: "Électrique" },
];

const ENFANTS_OPTIONS = Array.from({ length: 7 }, (_, i) => ({
  value: String(i) as `${number}`,
  label: i === 0 ? "Aucun" : i === 6 ? "6 ou plus" : String(i),
}));

export function CalcBrutNet({ accent }: { accent: string }) {
  const [mode, setMode] = useState<Mode>("brut-net");
  const [montant, setMontant] = useState("");
  const [statut, setStatut] = useState<StatutFiscal>("isole");
  const [enfants, setEnfants] = useState("0");
  const [region, setRegion] = useState<Region>("wallonie");
  const [chequesRepas, setChequesRepas] = useState<"oui" | "non">("non");

  // Voiture de société (ATN)
  const [hasVehicule, setHasVehicule] = useState<"oui" | "non">("non");
  const [valeurCatalogue, setValeurCatalogue] = useState("");
  const [ageVehicule, setAgeVehicule] = useState("0");
  const [motorisation, setMotorisation] =
    useState<MotorisationVehicule>("essence");

  // Indemnité télétravail
  const [telework, setTelework] = useState("");

  const [result, setResult] = useState<BrutNetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const valeur = parseNum(montant);
    if (!Number.isFinite(valeur)) {
      setError("Indiquez un montant valide.");
      return;
    }

    const voitureSociete = hasVehicule === "oui"
      ? {
          hasVehicule: true,
          valeurCatalogueHT: parseNum(valeurCatalogue) || 0,
          ageVehicule: parseInt(ageVehicule, 10) || 0,
          motorisation,
        }
      : undefined;

    const teleworkNum = parseNum(telework);
    const indemniteTelework = Number.isFinite(teleworkNum) ? teleworkNum : 0;

    const params = {
      statut,
      enfants: parseInt(enfants, 10) || 0,
      region,
      chequesRepas: chequesRepas === "oui",
      voitureSociete,
      indemniteTelework,
    };

    const res =
      mode === "brut-net"
        ? calcBrutNet({ ...params, brut: valeur })
        : calcNetToBrut(valeur, params);

    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
  };

  const modeLabel = mode === "brut-net" ? "Brut → Net" : "Net → Brut";
  const inputLabel =
    mode === "brut-net"
      ? "Salaire mensuel brut"
      : "Salaire mensuel net souhaité";
  const inputHint =
    mode === "brut-net"
      ? "Montant indiqué sur votre fiche de paie avant retenues."
      : "Le calcul cherche le brut qui donne ce net (méthode dichotomique).";

  return (
    <CalcLayout
      intro={
        <>
          Estimation rapide du <strong>passage brut → net mensuel</strong> pour
          un salarié belge. Inversement possible avec le mode{" "}
          <em>Net → Brut</em>. Inclut voiture de société (ATN) et indemnité
          télétravail — chiffres 2026, voir disclaimer.
        </>
      }
    >
      <CalcRadio<Mode>
        label="Mode de calcul"
        value={mode}
        onChange={(v) => {
          setMode(v);
          setResult(null);
          setError(null);
        }}
        options={[
          { value: "brut-net", label: "Brut → Net" },
          { value: "net-brut", label: "Net → Brut" },
        ]}
        accent={accent}
      />

      <CalcField
        id="brut-net-montant"
        label={inputLabel}
        hint={inputHint}
        value={montant}
        onChange={setMontant}
        placeholder={mode === "brut-net" ? "ex : 3000" : "ex : 2150"}
        suffix="€"
        min={100}
      />

      <CalcGrid cols={2}>
        <CalcSelect<StatutFiscal>
          id="brut-net-statut"
          label="Statut fiscal"
          value={statut}
          onChange={setStatut}
          options={STATUTS}
        />
        <CalcSelect
          id="brut-net-enfants"
          label="Enfants à charge"
          value={enfants}
          onChange={setEnfants}
          options={ENFANTS_OPTIONS}
        />
      </CalcGrid>

      <CalcGrid cols={2}>
        <CalcSelect<Region>
          id="brut-net-region"
          label="Région"
          value={region}
          onChange={setRegion}
          options={REGIONS}
          hint="Impact marginal sur le précompte mensuel."
        />
        <CalcRadio<"oui" | "non">
          label="Chèques-repas"
          value={chequesRepas}
          onChange={setChequesRepas}
          options={[
            { value: "non", label: "Non" },
            { value: "oui", label: "Oui (8,91 €/jour)" },
          ]}
          accent={accent}
        />
      </CalcGrid>

      <CalcRadio<"oui" | "non">
        label="Voiture de société"
        hint="Avantage en nature imposable (ATN), s'ajoute à l'imposable pour le précompte."
        value={hasVehicule}
        onChange={setHasVehicule}
        options={[
          { value: "non", label: "Non" },
          { value: "oui", label: "Oui" },
        ]}
        accent={accent}
      />

      {hasVehicule === "oui" ? (
        <CalcGrid cols={3}>
          <CalcField
            id="brut-net-valeur-catalogue"
            label="Valeur catalogue HT"
            hint="Prix neuf hors TVA (constructeur)."
            value={valeurCatalogue}
            onChange={setValeurCatalogue}
            placeholder="ex : 35000"
            suffix="€"
            min={0}
          />
          <CalcField
            id="brut-net-age-vehicule"
            label="Âge du véhicule"
            hint="En années (0 = neuf, 6 = vieux)."
            value={ageVehicule}
            onChange={setAgeVehicule}
            placeholder="0"
            suffix="ans"
            min={0}
            max={30}
          />
          <CalcSelect<MotorisationVehicule>
            id="brut-net-motorisation"
            label="Motorisation"
            value={motorisation}
            onChange={setMotorisation}
            options={MOTORISATIONS}
          />
        </CalcGrid>
      ) : null}

      <CalcField
        id="brut-net-telework"
        label="Indemnité télétravail mensuelle"
        hint="Forfaitaire, non imposable. Plafond légal 2026 : 154,74 €/mois."
        value={telework}
        onChange={setTelework}
        placeholder="ex : 154"
        suffix="€"
        min={0}
        max={200}
      />

      {error ? <CalcError>{error}</CalcError> : null}

      <CalcSubmitButton accent={accent} onClick={handleCalc}>
        Calculer {modeLabel.toLowerCase()}
      </CalcSubmitButton>

      {result ? (
        <CalcResult
          accent={accent}
          headline={
            mode === "brut-net" ? fmtEUR(result.net) : fmtEUR(result.brut)
          }
          unit={mode === "brut-net" ? "/ mois net" : "/ mois brut"}
          subtext={
            <>
              Taux net/brut : <strong>{(result.tauxNetBrut * 100).toFixed(1)} %</strong>
              {mode === "net-brut" ? ` — pour un net de ${fmtEUR(result.net)}` : null}
            </>
          }
          rows={[
            { label: "Salaire brut", value: fmtEUR(result.brut) },
            {
              label: result.bonus > 0
                ? `− ONSS retenue (workbonus −${fmtEUR(result.bonus)})`
                : "− Cotisations ONSS (13,07 %)",
              value: `− ${fmtEUR(result.onssRetenue)}`,
            },
            ...(result.atn > 0
              ? [
                  {
                    label: "+ ATN voiture société (imposable)",
                    value: `+ ${fmtEUR(result.atn)}`,
                  },
                ]
              : []),
            { label: "= Salaire imposable", value: fmtEUR(result.imposable) },
            { label: "− Précompte professionnel", value: `− ${fmtEUR(result.precompte)}` },
            ...(result.cotisationSpeciale > 0
              ? [
                  {
                    label: "− Cotisation spéciale sécu",
                    value: `− ${fmtEUR(result.cotisationSpeciale)}`,
                  },
                ]
              : []),
            ...(result.chequesRepas > 0
              ? [
                  {
                    label: "+ Chèques-repas (≈ 21 j)",
                    value: `+ ${fmtEUR(result.chequesRepas)}`,
                  },
                ]
              : []),
            ...(result.indemniteTelework > 0
              ? [
                  {
                    label: "+ Indemnité télétravail",
                    value: `+ ${fmtEUR(result.indemniteTelework)}`,
                  },
                ]
              : []),
            { label: "Net en poche", value: fmtEUR(result.net), emphasis: true },
          ]}
          footer={
            <>
              <strong>Estimation indicative</strong> — chiffres 2026 calibrés
              sur le simulateur officiel <strong>CSC Brut-Net</strong>{" "}
              (tools.lacsc.be, version 1<sup>er</sup> janvier 2026). Le
              workbonus (volet A + volet B Securex) réduit l'ONSS retenue
              avant calcul du précompte. Le précompte exact dépend de votre
              situation fiscale précise (double pécule, ATN multiples,
              cotisations spéciales). Pour le décompte officiel : votre
              fiche de paie ou le simulateur du <strong>SPF Finances</strong>.
            </>
          }
        />
      ) : null}
    </CalcLayout>
  );
}
