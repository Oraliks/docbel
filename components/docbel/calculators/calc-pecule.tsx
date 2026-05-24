"use client";

/**
 * Calculateur "Pécule de vacances" — UI.
 *
 * Pourquoi ce composant : permettre à un employé/ouvrier de connaître à
 * la louche le montant brut + net estimé qu'il va toucher (juin pour les
 * employés, mai/juin pour les ouvriers via l'ONVA). La logique pure vit
 * dans `lib/calculators/pecule.ts` — ici on assemble juste les inputs et
 * la carte de résultat avec les primitives `_shared`.
 */

import { useState } from "react";
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
import { calcPecule, type PeculeResult } from "@/lib/calculators/pecule";

type Statut = "employe" | "ouvrier";
type Regime = "plein" | "partiel";

export function CalcPecule({ accent }: { accent: string }) {
  const [statut, setStatut] = useState<Statut>("employe");
  const [brutMensuel, setBrutMensuel] = useState("");
  const [moisPrestes, setMoisPrestes] = useState("12");
  const [regime, setRegime] = useState<Regime>("plein");
  const [tauxOccupation, setTauxOccupation] = useState("80");
  const [result, setResult] = useState<PeculeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onCalc = () => {
    setError(null);
    setResult(null);

    const brut = parseNum(brutMensuel);
    const mois = parseNum(moisPrestes);
    const taux = parseNum(tauxOccupation);

    const out = calcPecule({
      statut,
      brutMensuel: brut,
      moisPrestes: isNaN(mois) ? 12 : mois,
      tempsPartiel: regime === "partiel",
      tauxOccupation: isNaN(taux) ? 100 : taux,
    });

    if ("error" in out) {
      setError(out.error);
      return;
    }
    setResult(out);
  };

  // Hint adaptatif selon le statut sélectionné.
  const brutHint =
    statut === "employe"
      ? "Brut mensuel actuel (avant retenues). Ex : 3200."
      : "Brut mensuel moyen de l'année précédente. Ex : 2400.";

  const intro = (
    <>
      Estimez votre <strong>pécule de vacances</strong> belge.{" "}
      {statut === "employe"
        ? "Les employés du privé touchent leur double pécule en juin via l'employeur."
        : "Les ouvriers reçoivent leur pécule de l'ONVA en mai ou juin."}
    </>
  );

  return (
    <CalcLayout intro={intro}>
      <CalcRadio<Statut>
        label="Votre statut"
        hint="Ouvrier = via ONVA en mai/juin. Employé = double pécule en juin via l'employeur."
        value={statut}
        onChange={setStatut}
        options={[
          { value: "employe", label: "Employé" },
          { value: "ouvrier", label: "Ouvrier" },
        ]}
        accent={accent}
      />

      <CalcGrid cols={2}>
        <CalcField
          id="pecule-brut"
          label="Brut mensuel (€)"
          hint={brutHint}
          value={brutMensuel}
          onChange={setBrutMensuel}
          placeholder="ex : 3000"
          min={100}
          max={50000}
          suffix="€"
        />
        <CalcField
          id="pecule-mois"
          label="Mois prestés l'an dernier"
          hint="De 0 à 12. Laissez 12 pour une année complète."
          value={moisPrestes}
          onChange={setMoisPrestes}
          placeholder="12"
          min={0}
          max={12}
          step={1}
        />
      </CalcGrid>

      <CalcRadio<Regime>
        label="Régime de travail"
        value={regime}
        onChange={setRegime}
        options={[
          { value: "plein", label: "Temps plein" },
          { value: "partiel", label: "Temps partiel" },
        ]}
        accent={accent}
      />

      {regime === "partiel" ? (
        <CalcField
          id="pecule-taux"
          label="Taux d'occupation (%)"
          hint="Ex : 80 pour un 4/5e, 50 pour un mi-temps."
          value={tauxOccupation}
          onChange={setTauxOccupation}
          placeholder="80"
          min={1}
          max={100}
          step={1}
          suffix="%"
        />
      ) : null}

      <CalcSubmitButton accent={accent} onClick={onCalc}>
        Calculer le pécule
      </CalcSubmitButton>

      {error ? <CalcError>{error}</CalcError> : null}

      {result ? (
        <CalcResult
          accent={accent}
          headline={fmtEUR(result.totalBrut)}
          unit="brut total"
          subtext={
            <>
              ≈ <strong>{fmtEUR(result.totalNetEstime)}</strong> net estimé
              {result.statut === "ouvrier"
                ? " (versé par l'ONVA en mai/juin)"
                : " (versé par l'employeur en juin)"}
            </>
          }
          rows={[
            {
              label: "Pécule simple (brut)",
              value: fmtEUR(result.peculeSimpleBrut),
            },
            {
              label: "Double pécule (brut)",
              value: fmtEUR(result.doublePeculeBrut),
            },
            {
              label: "Net estimé du double pécule",
              value: fmtEUR(result.doublePeculeNetEstime),
              emphasis: true,
            },
          ]}
          footer={
            <>
              Estimation indicative. Le pécule réel dépend de votre fiche de paie
              {result.statut === "ouvrier" ? " / décompte ONVA officiel" : ""}.
              Calcul simplifié 2026 — ne tient pas compte des primes, jours
              assimilés, conventions sectorielles ni précompte personnalisé.
            </>
          }
        />
      ) : (
        <CalcInfo>
          {statut === "employe" ? (
            <>
              Le <strong>pécule simple</strong> correspond à votre salaire normal
              pendant les congés (déjà payé par l'employeur). Le{" "}
              <strong>double pécule</strong> ≈ 92 % du brut mensuel est versé
              une fois par an, généralement en juin.
            </>
          ) : (
            <>
              L'<strong>ONVA</strong> verse en mai/juin un montant unique
              d'environ 15,38 % du salaire brut majoré de l'année précédente,
              moins une retenue d'environ 23 % (ONSS + précompte).
            </>
          )}
        </CalcInfo>
      )}
    </CalcLayout>
  );
}
