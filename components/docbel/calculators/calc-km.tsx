"use client";

/**
 * Calculateur de frais kilométriques domicile-travail (déduction fiscale 2026).
 *
 * S'appuie sur la logique pure de `@/lib/calculators/frais-km` et les
 * primitives UI partagées de `./_shared`. Calcul à la demande (clic),
 * pas en live — cohérent avec CalcPension / CalcBrutNet.
 *
 * Pédagogique : on souligne que les frais réels ne sont intéressants que si
 * le total dépasse le forfait légal (5 720 €/an en 2026).
 */

import React, { useState } from "react";
import {
  calcFraisKm,
  FORFAIT_LEGAL_FRAIS_PRO_2026,
  type FraisKmResult,
  type TransportMode,
} from "@/lib/calculators/frais-km";
import {
  CalcLayout,
  CalcGrid,
  CalcField,
  CalcSelect,
  CalcSubmitButton,
  CalcResult,
  CalcError,
  CalcInfo,
  fmtEUR,
  fmtNumber,
  parseNum,
} from "./_shared";

const TRANSPORT_OPTIONS: { value: TransportMode; label: string }[] = [
  { value: "voiture", label: "Voiture personnelle" },
  { value: "velo", label: "Vélo (y compris électrique)" },
  { value: "transports_publics", label: "Transports publics (SNCB / STIB / TEC / De Lijn)" },
  { value: "moto", label: "Moto" },
  { value: "covoiturage", label: "Covoiturage (passager)" },
];

export function CalcKm({ accent }: { accent: string }) {
  const [transport, setTransport] = useState<TransportMode>("voiture");
  const [kmAllerSimple, setKmAllerSimple] = useState("");
  const [joursParSemaine, setJoursParSemaine] = useState("5");
  const [semainesParAn, setSemainesParAn] = useState("44");
  const [coutAbonnement, setCoutAbonnement] = useState("");

  const [result, setResult] = useState<FraisKmResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTP = transport === "transports_publics";

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const km = parseNum(kmAllerSimple);
    const jours = parseNum(joursParSemaine);
    const semaines = parseNum(semainesParAn);
    const abo = isTP ? parseNum(coutAbonnement) : 0;

    if (!Number.isFinite(km)) {
      setError("Indiquez une distance domicile-travail valide.");
      return;
    }
    if (!Number.isFinite(jours)) {
      setError("Indiquez un nombre de jours par semaine valide.");
      return;
    }
    if (!Number.isFinite(semaines)) {
      setError("Indiquez un nombre de semaines par an valide.");
      return;
    }
    if (isTP && !Number.isFinite(abo)) {
      setError("Indiquez le coût annuel de votre abonnement.");
      return;
    }

    const res = calcFraisKm({
      kmAllerSimple: km,
      joursParSemaine: jours,
      semainesParAn: semaines,
      transport,
      coutAbonnement: abo,
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
          Estimez votre <strong>déduction fiscale</strong> pour vos
          déplacements domicile-travail. Choisissez entre le forfait légal
          (≈ 30 % du brut, plafonné à <strong>{fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}</strong>{" "}
          en 2026) ou la déduction des <strong>frais réels</strong> — barèmes
          kilométriques 2026.
        </>
      }
    >
      <CalcSelect<TransportMode>
        id="km-transport"
        label="Mode de transport principal"
        value={transport}
        onChange={setTransport}
        options={TRANSPORT_OPTIONS}
        hint="Si vous combinez plusieurs modes, utilisez le mode principal."
      />

      <CalcField
        id="km-aller-simple"
        label="Distance domicile-travail (aller simple)"
        value={kmAllerSimple}
        onChange={setKmAllerSimple}
        placeholder="ex : 25"
        min={1}
        max={499}
        suffix="km"
        hint={
          transport === "voiture" || transport === "covoiturage"
            ? "Pour la voiture / covoiturage : tarif préférentiel jusqu'à 100 km aller simple."
            : undefined
        }
      />

      <CalcGrid cols={2}>
        <CalcField
          id="km-jours"
          label="Jours travaillés / semaine"
          value={joursParSemaine}
          onChange={setJoursParSemaine}
          placeholder="ex : 5"
          min={1}
          max={7}
          suffix="j"
          hint="Jours sur place (hors télétravail)."
        />
        <CalcField
          id="km-semaines"
          label="Semaines travaillées / an"
          value={semainesParAn}
          onChange={setSemainesParAn}
          placeholder="ex : 44"
          min={1}
          max={52}
          suffix="sem"
          hint="52 − vacances − maladie. Défaut 44."
        />
      </CalcGrid>

      {isTP ? (
        <CalcField
          id="km-abonnement"
          label="Coût annuel de l'abonnement"
          value={coutAbonnement}
          onChange={setCoutAbonnement}
          placeholder="ex : 750"
          suffix="€"
          hint="100 % du coût est déductible (carte train SNCB, STIB, TEC, De Lijn)."
        />
      ) : null}

      <CalcInfo>
        <strong>Barèmes kilométriques 2026</strong> : voiture{" "}
        <strong>0,4322 €/km</strong> (plafond 100 km aller simple, au-delà
        0,15 €/km) — vélo <strong>0,36 €/km</strong> — moto / covoiturage
        passager <strong>0,15 €/km</strong> — transports publics 100 % de
        l&apos;abonnement.
      </CalcInfo>

      {error ? <CalcError>{error}</CalcError> : null}

      <CalcSubmitButton accent={accent} onClick={handleCalc}>
        Calculer ma déduction
      </CalcSubmitButton>

      {result ? (
        <CalcResult
          accent={accent}
          headline={fmtEUR(result.deductionKm)}
          unit="/ an de déduction"
          subtext={
            isTP ? (
              <>
                Abonnement déduit à 100 % — {fmtNumber(result.kmTotalAnnuel)} km
                parcourus à titre indicatif
              </>
            ) : (
              <>
                {fmtNumber(result.kmTotalAnnuel)} km/an au taux de{" "}
                <strong>
                  {typeof result.tauxApplique === "number"
                    ? `${result.tauxApplique.toFixed(4).replace(".", ",")} €/km`
                    : result.tauxApplique}
                </strong>
              </>
            )
          }
          rows={[
            { label: "Mode de transport", value: result.modeLabel },
            {
              label: "Km annuels (aller-retour)",
              value: `${fmtNumber(result.kmTotalAnnuel)} km`,
            },
            {
              label: "Taux appliqué",
              value:
                typeof result.tauxApplique === "number"
                  ? `${result.tauxApplique.toFixed(4).replace(".", ",")} €/km`
                  : result.tauxApplique,
            },
            ...(result.abonnementInclus > 0
              ? [
                  {
                    label: "Abonnement déduit",
                    value: fmtEUR(result.abonnementInclus),
                  },
                ]
              : []),
            ...(result.plafondAtteint
              ? [
                  {
                    label: "Plafond 100 km aller simple",
                    value: "Atteint — excédent à 0,15 €/km",
                    emphasis: true,
                  },
                ]
              : []),
            {
              label: "Déduction annuelle",
              value: fmtEUR(result.deductionKm),
              emphasis: true,
            },
          ]}
          footer={
            <>
              {result.recommandationFraisReels ? (
                <>
                  <strong>Frais réels probablement intéressants</strong> — votre
                  déduction kilométrique seule (
                  {fmtEUR(result.deductionKm)}) couvre déjà une part importante
                  du forfait légal ({fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}).
                  Ajoutez vos autres frais réels (repas, vêtements pro,
                  formation, matériel) : si le total dépasse{" "}
                  {fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}, optez pour les
                  frais réels dans votre déclaration.
                </>
              ) : (
                <>
                  <strong>Forfait légal probablement plus avantageux</strong> —
                  votre déduction kilométrique ({fmtEUR(result.deductionKm)})
                  reste en-dessous du forfait légal automatique de{" "}
                  {fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}. L&apos;option pour
                  les frais réels n&apos;est intéressante que si la somme totale
                  (km + autres frais professionnels) dépasse ce forfait.
                </>
              )}
              <br />
              <br />
              <strong>Source</strong> : SPF Finances, art. 51 et 66 CIR92. Pour
              la voiture, le plafond de 100 km aller simple s&apos;applique au
              tarif 0,4322 €/km. Au-delà : 0,15 €/km. Estimation indicative —
              vérifiez votre situation personnelle sur{" "}
              <strong>finances.belgium.be</strong> ou auprès de votre comptable.
            </>
          }
        />
      ) : null}
    </CalcLayout>
  );
}
