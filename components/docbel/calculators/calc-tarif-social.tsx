"use client";

/**
 * Calculateur "Tarif social énergie" — UI.
 *
 * Vérifie en deux étapes :
 *  1) Le ménage est-il éligible au tarif social fédéral automatique
 *     (au moins un statut parmi BIM, RIS, GRAPA, handicap, aide CPAS,
 *     logement social) ?
 *  2) Quel serait le gain annuel estimé sur la facture énergie ?
 *
 * La logique pure vit dans `lib/calculators/tarif-social.ts` — ici on
 * assemble juste les inputs (statuts en checkboxes, conso en CalcField)
 * et la carte de résultat.
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
import {
  calcTarifSocial,
  type TarifSocialResult,
} from "@/lib/calculators/tarif-social";

type Oui = "oui" | "non";

interface StatusToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent: string;
}

/**
 * Checkbox stylée "carte" — chaque statut occupe une ligne avec une
 * description courte. On évite 6 CalcRadio Oui/Non qui prendraient trop
 * de place verticalement.
 */
function StatusToggle({
  id,
  label,
  description,
  checked,
  onChange,
  accent,
}: StatusToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3 transition"
      style={{
        background: checked ? `${accent}10` : "var(--glass-surface)",
        borderColor: checked ? accent : "var(--glass-border)",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-current"
        style={{ accentColor: accent }}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-[color:var(--glass-ink)]">
          {label}
        </span>
        {description ? (
          <span className="text-[11.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
            {description}
          </span>
        ) : null}
      </div>
    </label>
  );
}

export function CalcTarifSocial({ accent }: { accent: string }) {
  // Statuts d'éligibilité
  const [bim, setBim] = useState(false);
  const [ris, setRis] = useState(false);
  const [grapa, setGrapa] = useState(false);
  const [handicap, setHandicap] = useState(false);
  const [aideEquivalente, setAideEquivalente] = useState(false);
  const [logementSocial, setLogementSocial] = useState(false);

  // Consommation
  const [consoElec, setConsoElec] = useState("3500");
  const [consoGaz, setConsoGaz] = useState("17000");
  const [chauffageElec, setChauffageElec] = useState<Oui>("non");

  const [result, setResult] = useState<TarifSocialResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onCalc = () => {
    setError(null);
    setResult(null);

    const elec = parseNum(consoElec);
    const gaz = parseNum(consoGaz);

    const out = calcTarifSocial({
      bim,
      ris,
      grapa,
      handicap,
      aideEquivalente,
      logementSocial,
      consoElecKwh: isNaN(elec) ? 0 : elec,
      consoGazKwh: isNaN(gaz) ? 0 : gaz,
      chauffageElec: chauffageElec === "oui",
    });

    if ("error" in out) {
      setError(out.error);
      return;
    }
    setResult(out);
  };

  const intro = (
    <>
      Vérifiez si vous bénéficiez du <strong>tarif social fédéral</strong> sur
      l&apos;électricité et le gaz, et estimez votre économie annuelle.
      L&apos;application est <strong>automatique</strong> — aucune démarche si
      vous avez un statut éligible.
    </>
  );

  return (
    <CalcLayout intro={intro}>
      {/* --- Étape 1 : éligibilité ---------------------------------- */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
          1. Vérifier votre éligibilité
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <StatusToggle
            id="ts-bim"
            label="Statut BIM"
            description="Bénéficiaire de l'Intervention Majorée (ex-OMNIO) via mutuelle"
            checked={bim}
            onChange={setBim}
            accent={accent}
          />
          <StatusToggle
            id="ts-ris"
            label="RIS"
            description="Revenu d'Intégration Sociale du CPAS"
            checked={ris}
            onChange={setRis}
            accent={accent}
          />
          <StatusToggle
            id="ts-grapa"
            label="GRAPA"
            description="Garantie de Revenus Aux Personnes Âgées"
            checked={grapa}
            onChange={setGrapa}
            accent={accent}
          />
          <StatusToggle
            id="ts-handicap"
            label="Allocation handicap"
            description="DG Personnes Handicapées (SPF Sécurité Sociale)"
            checked={handicap}
            onChange={setHandicap}
            accent={accent}
          />
          <StatusToggle
            id="ts-aide"
            label="Aide CPAS équivalente"
            description="Aide sociale équivalente accordée par le CPAS"
            checked={aideEquivalente}
            onChange={setAideEquivalente}
            accent={accent}
          />
          <StatusToggle
            id="ts-logement"
            label="Logement social"
            description="Locataire d'un logement social agréé (SLRB, SWL, VMSW…)"
            checked={logementSocial}
            onChange={setLogementSocial}
            accent={accent}
          />
        </div>
      </div>

      <CalcInfo>
        Si vous bénéficiez d&apos;au moins un de ces statuts, le tarif social
        s&apos;applique <strong>automatiquement</strong> (vérification 4x par
        an par le SPF Économie). Aucune démarche.
      </CalcInfo>

      {/* --- Étape 2 : conso ----------------------------------------- */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
          2. Estimer votre gain
        </span>
        <CalcGrid cols={2}>
          <CalcField
            id="ts-conso-elec"
            label="Conso annuelle électricité"
            hint="Voir votre dernière facture annuelle. Moyenne BE ≈ 3 500 kWh."
            value={consoElec}
            onChange={setConsoElec}
            placeholder="3500"
            min={0}
            max={99999}
            suffix="kWh"
          />
          <CalcField
            id="ts-conso-gaz"
            label="Conso annuelle gaz"
            hint="0 si vous n'avez pas de gaz naturel. Moyenne BE ≈ 17 000 kWh."
            value={consoGaz}
            onChange={setConsoGaz}
            placeholder="17000"
            min={0}
            max={99999}
            suffix="kWh"
          />
        </CalcGrid>

        <CalcRadio<Oui>
          label="Chauffage électrique ?"
          hint="Si oui, votre conso élec est probablement plus élevée."
          value={chauffageElec}
          onChange={setChauffageElec}
          options={[
            { value: "non", label: "Non" },
            { value: "oui", label: "Oui" },
          ]}
          accent={accent}
        />
      </div>

      <CalcSubmitButton accent={accent} onClick={onCalc}>
        Vérifier mon éligibilité
      </CalcSubmitButton>

      {error ? <CalcError>{error}</CalcError> : null}

      {result ? (
        result.eligible ? (
          <CalcResult
            accent={accent}
            eyebrow="Éligibilité tarif social"
            headline="Vous êtes éligible"
            subtext={
              <>
                Motif{result.motifsEligibilite.length > 1 ? "s" : ""} :{" "}
                <strong>{result.motifsEligibilite.join(", ")}</strong>. Le
                tarif social est appliqué automatiquement par votre
                fournisseur.
              </>
            }
            rows={[
              {
                label: "Économie annuelle estimée",
                value: fmtEUR(result.gainAnnuel),
                emphasis: true,
              },
              {
                label: "Soit par mois",
                value: fmtEUR(result.gainMensuel),
              },
              {
                label: "Économie électricité",
                value: fmtEUR(result.gainElec),
              },
              {
                label: "Économie gaz",
                value: fmtEUR(result.gainGaz),
              },
              {
                label: "Coût annuel tarif standard",
                value: fmtEUR(result.coutStandardTotal),
              },
              {
                label: "Coût annuel tarif social",
                value: fmtEUR(result.coutSocialTotal),
              },
            ]}
            footer={
              <>
                Estimation indicative. Source : SPF Économie. Tarifs
                susceptibles de varier chaque semestre. Des plafonds de
                consommation s&apos;appliquent — au-delà, le tarif standard du
                fournisseur s&apos;applique sur le dépassement.
              </>
            }
          />
        ) : (
          <CalcResult
            accent={accent}
            eyebrow="Éligibilité tarif social"
            headline="Pas éligible au tarif social"
            subtext={
              <>
                Aucun des statuts cochés ne donne droit au tarif social
                fédéral. D&apos;autres aides existent : <strong>prime
                énergie régionale</strong> (Wallonie/Bruxelles/Flandre),{" "}
                <strong>chèque mazout</strong>, intervention du CPAS, fonds
                gaz et électricité…
              </>
            }
            footer={
              <>
                À titre d&apos;information, le gain théorique aurait été de{" "}
                <strong>{fmtEUR(result.gainAnnuel)}/an</strong> avec votre
                consommation déclarée.
              </>
            }
          />
        )
      ) : (
        <CalcInfo>
          Le tarif social fédéral est le tarif commercial le plus bas du
          marché belge, calculé chaque semestre par la CREG. En 2026 S1, il
          se situe autour de <strong>0,22 €/kWh</strong> en électricité et{" "}
          <strong>0,047 €/kWh</strong> en gaz (tout inclus).
        </CalcInfo>
      )}
    </CalcLayout>
  );
}
