"use client";

/**
 * Calculateur de frais kilométriques domicile-travail (déduction fiscale 2026).
 *
 * S'appuie sur la logique pure de `@/lib/calculators/frais-km` et les
 * primitives UI partagées de `./_shared`. Calcul à la demande (clic),
 * pas en live — cohérent avec CalcPension / CalcBrutNet.
 *
 * Pédagogique :
 *  - on souligne que les frais réels ne sont intéressants que si le total
 *    dépasse le forfait légal (6 070 €/an en 2026) ;
 *  - on affiche les km évités par télétravail (info uniquement) ;
 *  - on bascule automatiquement le taux voiture 0,4322 → 0,15 €/km si
 *    l'employeur verse une indemnité km (cumul interdit, CIR 92 art. 66).
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
  const [joursTelework, setJoursTelework] = useState("0");
  const [indemniteEmployeur, setIndemniteEmployeur] = useState("0");

  const [result, setResult] = useState<FraisKmResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTP = transport === "transports_publics";
  const isVoiture = transport === "voiture";

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const km = parseNum(kmAllerSimple);
    const jours = parseNum(joursParSemaine);
    const semaines = parseNum(semainesParAn);
    const abo = isTP ? parseNum(coutAbonnement) : 0;
    // Champs optionnels : on tolère vide / NaN → 0.
    const telework = Number.isFinite(parseNum(joursTelework))
      ? parseNum(joursTelework)
      : 0;
    const indemnite = Number.isFinite(parseNum(indemniteEmployeur))
      ? parseNum(indemniteEmployeur)
      : 0;

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
      joursTelework: telework,
      indemniteEmployeurAnnuelle: indemnite,
    });

    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
  };

  // True si l'indemnité employeur a fait basculer la voiture vers 0,15 €/km.
  const voitureForfaitForcé =
    result !== null &&
    isVoiture &&
    result.indemniteEmployeurAnnuelle > 0 &&
    typeof result.tauxApplique === "number" &&
    result.tauxApplique === 0.15;

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
          label="Jours travaillés sur place / semaine"
          value={joursParSemaine}
          onChange={setJoursParSemaine}
          placeholder="ex : 3"
          min={1}
          max={7}
          suffix="j"
          hint="Jours sur place uniquement (hors télétravail)."
        />
        <CalcField
          id="km-telework"
          label="Jours de télétravail / semaine"
          value={joursTelework}
          onChange={setJoursTelework}
          placeholder="ex : 2"
          min={0}
          max={5}
          suffix="j"
          hint="Info pédagogique : ne réduit pas la déduction."
        />
      </CalcGrid>

      <CalcGrid cols={2}>
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
        <CalcField
          id="km-indemnite-employeur"
          label="Indemnité km annuelle reçue de l'employeur"
          value={indemniteEmployeur}
          onChange={setIndemniteEmployeur}
          placeholder="ex : 0"
          min={0}
          suffix="€"
          hint={
            isVoiture
              ? "Si > 0 → voiture passe à 0,15 €/km (cumul exclu)."
              : "Soustraite de la déduction brute."
          }
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
        <strong>0,4322 €/km</strong> sans indemnité employeur (plafond 100 km
        aller simple, au-delà 0,15 €/km) — <strong>0,15 €/km</strong> si
        l&apos;employeur verse une indemnité km (cumul exclu, art. 66 CIR 92).
        Vélo <strong>0,37 €/km</strong> (plafond 3 700 €/an) — moto /
        covoiturage passager <strong>0,15 €/km</strong> — transports publics
        100 % de l&apos;abonnement.
      </CalcInfo>

      {error ? <CalcError>{error}</CalcError> : null}

      <CalcSubmitButton accent={accent} onClick={handleCalc}>
        Calculer ma déduction
      </CalcSubmitButton>

      {result ? (
        <CalcResult
          accent={accent}
          headline={fmtEUR(result.deductionKmNette)}
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
            ...(typeof result.kmTeleworkEvites === "number" &&
            result.kmTeleworkEvites > 0
              ? [
                  {
                    label: "Km évités par télétravail (info)",
                    value: `${fmtNumber(result.kmTeleworkEvites)} km`,
                  },
                ]
              : []),
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
            ...(result.indemniteEmployeurAnnuelle > 0
              ? [
                  {
                    label: "Déduction brute",
                    value: fmtEUR(result.deductionKmBrute),
                  },
                  {
                    label: "Indemnité employeur",
                    value: `− ${fmtEUR(result.indemniteEmployeurAnnuelle)}`,
                  },
                  {
                    label: "Déduction nette",
                    value: fmtEUR(result.deductionKmNette),
                    emphasis: true,
                  },
                ]
              : [
                  {
                    label: "Déduction annuelle",
                    value: fmtEUR(result.deductionKmNette),
                    emphasis: true,
                  },
                ]),
          ]}
          footer={
            <>
              {result.recommandationFraisReels ? (
                <>
                  <strong>Frais réels probablement intéressants</strong> — votre
                  déduction kilométrique nette (
                  {fmtEUR(result.deductionKmNette)}) couvre déjà une part
                  importante du forfait légal (
                  {fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}). Ajoutez vos autres
                  frais réels (repas, vêtements pro, formation, matériel) : si
                  le total dépasse {fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)},
                  optez pour les frais réels dans votre déclaration.
                </>
              ) : (
                <>
                  <strong>Forfait légal probablement plus avantageux</strong> —
                  votre déduction kilométrique nette (
                  {fmtEUR(result.deductionKmNette)}) reste en-dessous du forfait
                  légal automatique de {fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}
                  . L&apos;option pour les frais réels n&apos;est intéressante
                  que si la somme totale (km + autres frais professionnels)
                  dépasse ce forfait.
                </>
              )}
              {isVoiture ? (
                <>
                  <br />
                  <br />
                  <strong>Taux voiture retenu</strong> :{" "}
                  {voitureForfaitForcé ? (
                    <>
                      <strong>0,15 €/km</strong> (forfait CIR 92 art. 66) — votre
                      employeur vous verse une indemnité km, le cumul avec le
                      tarif fonctionnaires 0,4322 €/km n&apos;est pas autorisé.
                    </>
                  ) : (
                    <>
                      <strong>0,4322 €/km</strong> (tarif fonctionnaires) —
                      applicable car aucune indemnité km n&apos;est versée par
                      l&apos;employeur. Si vous percevez une indemnité, le taux
                      bascule automatiquement à 0,15 €/km.
                    </>
                  )}
                </>
              ) : null}
              <br />
              <br />
              <strong>Source</strong> : SPF Finances, art. 51 et 66 CIR92.
              Estimation indicative — vérifiez votre situation personnelle sur{" "}
              <strong>finances.belgium.be</strong> ou auprès de votre comptable.
            </>
          }
        />
      ) : null}
    </CalcLayout>
  );
}
