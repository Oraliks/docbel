"use client";

/**
 * Calculateur "Pécule de vacances" — UI.
 *
 * Pourquoi ce composant : permettre à un employé/ouvrier de connaître à
 * la louche le montant brut + net estimé qu'il va toucher (juin pour les
 * employés, mai/juin pour les ouvriers via l'ONVA). La logique pure vit
 * dans `lib/calculators/pecule.ts` — ici on assemble juste les inputs et
 * la carte de résultat avec les primitives `_shared`.
 *
 * Améliorations 2026 :
 *  - Précompte spécial dégressif appliqué au double pécule employé.
 *  - Différencie net simple (salaire normal) vs net double (précompte spé).
 *  - Mention pécule jeunes ONEM si "première année après études".
 *  - Note pédagogique sur les jours assimilés.
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
  fmtPct,
  parseNum,
} from "./_shared";
import { calcPecule, type PeculeResult } from "@/lib/calculators/pecule";

type Statut = "employe" | "ouvrier";
type Regime = "plein" | "partiel";
type YesNo = "non" | "oui";

export function CalcPecule({ accent }: { accent: string }) {
  const [statut, setStatut] = useState<Statut>("employe");
  const [brutMensuel, setBrutMensuel] = useState("");
  const [moisPrestes, setMoisPrestes] = useState("12");
  const [regime, setRegime] = useState<Regime>("plein");
  const [tauxOccupation, setTauxOccupation] = useState("80");
  const [jeune, setJeune] = useState<YesNo>("non");
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
      jeuneTravailleur: jeune === "oui",
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
          hint="De 0 à 12. Jours de maladie, congé maternité et chômage temporaire comptent comme prestés."
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

      {statut === "employe" ? (
        <CalcRadio<YesNo>
          label="Première année après vos études ?"
          hint="Si oui et que vous avez moins de 25 ans, vous avez peut-être droit au pécule jeunes versé par l'ONEM."
          value={jeune}
          onChange={setJeune}
          options={[
            { value: "non", label: "Non" },
            { value: "oui", label: "Oui" },
          ]}
          accent={accent}
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
              label: "Pécule simple brut",
              value: fmtEUR(result.peculeSimpleBrut),
            },
            {
              label: "Pécule simple net (estimé)",
              value: fmtEUR(result.peculeSimpleNetEstime),
            },
            {
              label: "Double pécule brut",
              value: fmtEUR(result.doublePeculeBrut),
            },
            {
              label: "Double pécule net (estimé)",
              value: fmtEUR(result.doublePeculeNetEstime),
              emphasis: true,
            },
          ]}
          footer={
            <>
              Estimation indicative. Le pécule réel dépend de votre fiche de paie
              {result.statut === "ouvrier" ? " / décompte ONVA officiel" : ""}.
              {result.statut === "employe" ? (
                <>
                  {" "}Précompte spécial appliqué sur le double pécule :{" "}
                  <strong>
                    {fmtPct(result.tauxPrecompteAppliquePourcent, 2)}
                  </strong>{" "}
                  (barème dégressif par tranches de brut annuel : 17,16 % /
                  30,28 % / 53,50 %).
                </>
              ) : (
                <>
                  {" "}Retenue ONVA globale :{" "}
                  <strong>
                    {fmtPct(result.tauxPrecompteAppliquePourcent, 2)}
                  </strong>{" "}
                  (ONSS + précompte).
                </>
              )}
              {result.peculeJeunesEligible ? (
                <>
                  {" "}<br />
                  <strong>Pécule jeunes ONEM :</strong> vous avez peut-être
                  droit à un pécule supplémentaire (jusqu'à 4 semaines), à
                  demander avant fin février auprès de l'ONEM.
                </>
              ) : null}
            </>
          }
        />
      ) : (
        <CalcInfo>
          {statut === "employe" ? (
            <>
              Le <strong>pécule simple</strong> correspond à votre salaire normal
              pendant les congés (imposé comme un salaire ordinaire). Le{" "}
              <strong>double pécule</strong> ≈ 92 % du brut mensuel est versé
              une fois par an, généralement en juin, et subit un{" "}
              <strong>précompte spécial dégressif</strong> (17 à 54 % selon
              votre brut annuel). Les <strong>jours assimilés</strong>
              {" "}(maladie, congé maternité, chômage temporaire) comptent
              comme prestés pour le calcul.
            </>
          ) : (
            <>
              L'<strong>ONVA</strong> verse en mai/juin un montant unique
              d'environ 15,38 % du salaire brut majoré de l'année précédente,
              moins une retenue d'environ 23 % (ONSS + précompte). Les{" "}
              <strong>jours assimilés</strong> (maladie, congé maternité)
              comptent comme prestés.
            </>
          )}
        </CalcInfo>
      )}
    </CalcLayout>
  );
}
