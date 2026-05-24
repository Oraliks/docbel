"use client";

/**
 * Calculateur "Allocations familiales" — UI.
 *
 * Pourquoi ce composant : depuis la régionalisation, un parent belge n'a
 * plus une réponse simple à "combien je vais toucher par mois ?". Chaque
 * région a son organisme, son barème, ses dates pivot, ses suppléments.
 * Ce calc donne un ordre de grandeur réaliste avant que l'utilisateur
 * contacte sa caisse (FAMIWAL / FAMIRIS / Groeipakket / Kindergeld DG).
 *
 * La logique pure vit dans `lib/calculators/allocs-fam.ts` — ici on
 * assemble juste les inputs (région, enfants dynamiques, revenu, mono-
 * parentalité, handicap, orphelin) et la carte de résultat avec les
 * primitives `_shared`.
 */

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  CalcLayout,
  CalcGrid,
  CalcField,
  CalcSelect,
  CalcRadio,
  CalcSubmitButton,
  CalcResult,
  CalcError,
  CalcInfo,
  fmtEUR,
  parseNum,
} from "./_shared";
import {
  calcAllocsFam,
  type AllocsFamResult,
  type OrphelinStatus,
  type Region,
} from "@/lib/calculators/allocs-fam";

type MonoYesNo = "oui" | "non";
type HandicapYesNo = "oui" | "non";

interface EnfantRow {
  /** Identifiant local pour la clé React (n'affecte pas le calcul). */
  uid: number;
  /** Année de naissance saisie sous forme de string (parsée au calcul). */
  anneeNaissance: string;
  /** Enfant en situation de handicap reconnu (catégorie médiane). */
  handicap: HandicapYesNo;
  /** Statut d'orphelin de l'enfant. */
  orphelin: OrphelinStatus;
}

const ANNEE_COURANTE = new Date().getFullYear();
const DEFAUT_ANNEE_ENFANT = ANNEE_COURANTE - 5; // ex : 2021 si on est en 2026

let _uid = 0;
const nextUid = () => ++_uid;

const newEnfant = (): EnfantRow => ({
  uid: nextUid(),
  anneeNaissance: String(DEFAUT_ANNEE_ENFANT),
  handicap: "non",
  orphelin: "aucun",
});

export function CalcAllocsFam({ accent }: { accent: string }) {
  const [region, setRegion] = useState<Region>("wallonie");
  const [revenu, setRevenu] = useState("50000");
  const [monoparental, setMonoparental] = useState<MonoYesNo>("non");
  const [enfants, setEnfants] = useState<EnfantRow[]>([newEnfant()]);
  const [result, setResult] = useState<AllocsFamResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addEnfant = () => {
    if (enfants.length >= 10) return;
    setEnfants((prev) => [...prev, newEnfant()]);
  };

  const removeEnfant = (uid: number) => {
    setEnfants((prev) => prev.filter((e) => e.uid !== uid));
  };

  const updateEnfant = (uid: number, patch: Partial<EnfantRow>) => {
    setEnfants((prev) =>
      prev.map((e) => (e.uid === uid ? { ...e, ...patch } : e)),
    );
  };

  const onCalc = () => {
    setError(null);
    setResult(null);

    if (enfants.length === 0) {
      setError("Ajoutez au moins un enfant pour calculer.");
      return;
    }

    const rev = parseNum(revenu);
    const parsedEnfants = enfants.map((e) => ({
      anneeNaissance: parseNum(e.anneeNaissance),
      handicap: e.handicap === "oui",
      orphelin: e.orphelin,
    }));

    const out = calcAllocsFam({
      region,
      enfants: parsedEnfants,
      revenuMenageAnnuel: isNaN(rev) ? 0 : rev,
      monoparental: monoparental === "oui",
    });

    if ("error" in out) {
      setError(out.error);
      return;
    }
    setResult(out);
  };

  // Hint sur le sélecteur de région : on rappelle quelle caisse correspond.
  const regionHint =
    region === "wallonie"
      ? "Caisse de référence : FAMIWAL (ou une caisse privée agréée en Wallonie)."
      : region === "bruxelles"
        ? "Caisse de référence : FAMIRIS (ou une caisse privée agréée à Bruxelles)."
        : region === "flandre"
          ? "Régime Groeipakket (« paquet de croissance ») géré par Opgroeien."
          : "Régime Kindergeld géré par le Ministerium der Deutschsprachigen Gemeinschaft.";

  const intro = (
    <>
      Estimez vos <strong>allocations familiales</strong> mensuelles. Depuis
      la régionalisation, chaque entité belge a son propre barème :
      sélectionnez votre région et ajoutez vos enfants (handicap, orphelin
      et rang sont pris en compte).
    </>
  );

  // Construit les lignes détaillées du résultat — une ligne par enfant
  // avec, en sous-titre, la décomposition des suppléments quand ils existent.
  const rows = result
    ? result.detail.flatMap((d) => {
        const out: { label: string; value: string; emphasis?: boolean }[] = [
          {
            label: `Enfant ${d.rang} — ${d.age} an${d.age > 1 ? "s" : ""}`,
            value: fmtEUR(d.total),
            emphasis: false,
          },
        ];
        // Détail base
        out.push({
          label: "  • base mensuelle",
          value: fmtEUR(d.montantBase),
        });
        if (d.supplementHandicap) {
          out.push({
            label: "  • supplément handicap (médian)",
            value: `+ ${fmtEUR(d.supplementHandicap)}`,
          });
        }
        if (d.supplementOrphelin) {
          out.push({
            label: "  • supplément orphelin",
            value: `+ ${fmtEUR(d.supplementOrphelin)}`,
          });
        }
        if (d.supplement3eEnfant) {
          out.push({
            label: "  • supplément 3e enfant (BXL)",
            value: `+ ${fmtEUR(d.supplement3eEnfant)}`,
          });
        }
        // Reste des suppléments (mono / bas revenu / social Flandre)
        const autresSupp =
          d.supplements -
          (d.supplementHandicap ?? 0) -
          (d.supplementOrphelin ?? 0) -
          (d.supplement3eEnfant ?? 0);
        if (autresSupp > 0.0001) {
          out.push({
            label: "  • supplément social/monoparental",
            value: `+ ${fmtEUR(autresSupp)}`,
          });
        }
        return out;
      })
    : [];

  // Y a-t-il au moins un enfant en situation de handicap dans le résultat ?
  const aHandicap =
    result?.detail.some((d) => (d.supplementHandicap ?? 0) > 0) ?? false;

  return (
    <CalcLayout intro={intro}>
      <CalcSelect<Region>
        id="allocs-region"
        label="Région de résidence"
        hint={regionHint}
        value={region}
        onChange={setRegion}
        options={[
          { value: "wallonie", label: "Wallonie (FAMIWAL)" },
          { value: "bruxelles", label: "Bruxelles (FAMIRIS)" },
          { value: "flandre", label: "Flandre (Groeipakket)" },
          { value: "germanophone", label: "Communauté germanophone (Kindergeld DG)" },
        ]}
      />

      <CalcGrid cols={2}>
        <CalcField
          id="allocs-revenu"
          label="Revenu annuel brut du ménage (€)"
          hint="Revenu imposable cumulé du ménage. Sert au calcul des suppléments sociaux."
          value={revenu}
          onChange={setRevenu}
          placeholder="ex : 50000"
          min={0}
          max={500000}
          step={1000}
          suffix="€"
        />
        <div className="flex flex-col gap-1.5">
          <CalcRadio<MonoYesNo>
            label="Famille monoparentale ?"
            hint="Un seul adulte assume la charge du ménage."
            value={monoparental}
            onChange={setMonoparental}
            options={[
              { value: "non", label: "Non" },
              { value: "oui", label: "Oui" },
            ]}
            accent={accent}
          />
        </div>
      </CalcGrid>

      {/* ----- Liste dynamique d'enfants ---------------------------------- */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-[color:var(--glass-ink)]">
            Enfants ({enfants.length}/10)
          </span>
          <button
            type="button"
            onClick={addEnfant}
            disabled={enfants.length >= 10}
            className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: accent,
              color: accent,
              background: `${accent}10`,
            }}
          >
            <Plus className="size-3.5" />
            Ajouter un enfant
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {enfants.map((enfant, idx) => (
            <div
              key={enfant.uid}
              className="flex flex-col gap-3 rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3"
            >
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <CalcField
                    id={`allocs-enfant-${enfant.uid}`}
                    label={`Enfant ${idx + 1} — année de naissance`}
                    value={enfant.anneeNaissance}
                    onChange={(v) =>
                      updateEnfant(enfant.uid, { anneeNaissance: v })
                    }
                    placeholder={String(DEFAUT_ANNEE_ENFANT)}
                    min={2000}
                    max={ANNEE_COURANTE}
                    step={1}
                  />
                </div>
                {enfants.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeEnfant(enfant.uid)}
                    aria-label={`Supprimer l'enfant ${idx + 1}`}
                    className="mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-[color:var(--glass-border)] text-[color:var(--glass-ink-faint)] transition hover:border-amber-300 hover:text-amber-700"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>

              <CalcGrid cols={2}>
                <CalcRadio<HandicapYesNo>
                  label="Handicap reconnu ?"
                  hint="Estimation catégorie médiane (4-6 points)."
                  value={enfant.handicap}
                  onChange={(v) => updateEnfant(enfant.uid, { handicap: v })}
                  options={[
                    { value: "non", label: "Non" },
                    { value: "oui", label: "Oui" },
                  ]}
                  accent={accent}
                />
                <CalcSelect<OrphelinStatus>
                  id={`allocs-orphelin-${enfant.uid}`}
                  label="Statut orphelin"
                  value={enfant.orphelin}
                  onChange={(v) => updateEnfant(enfant.uid, { orphelin: v })}
                  options={[
                    { value: "aucun", label: "Aucun" },
                    { value: "un_parent", label: "Un parent décédé" },
                    { value: "deux_parents", label: "Deux parents décédés" },
                  ]}
                />
              </CalcGrid>
            </div>
          ))}
        </div>
      </div>

      <CalcSubmitButton accent={accent} onClick={onCalc}>
        Calculer les allocations
      </CalcSubmitButton>

      {error ? <CalcError>{error}</CalcError> : null}

      {result ? (
        <CalcResult
          accent={accent}
          headline={fmtEUR(result.totalMensuel)}
          unit="/ mois"
          subtext={
            <>
              Régime : <strong>{result.regionLabel}</strong>
            </>
          }
          rows={rows}
          footer={
            <>
              <div>
                <strong>Bonus rentrée scolaire</strong> annuel estimé :{" "}
                <strong>{fmtEUR(result.bonusRentreeAnnuel)}</strong> (versé en
                été).
              </div>
              {result.allocationNaissanceTotale > 0 ? (
                <div className="mt-1.5">
                  <strong>Allocation de naissance</strong> (one-shot){" "}
                  pour les enfants nés en {ANNEE_COURANTE} :{" "}
                  <strong>{fmtEUR(result.allocationNaissanceTotale)}</strong>.
                </div>
              ) : null}
              {aHandicap ? (
                <div className="mt-1.5">
                  <em>
                    Supplément handicap estimé sur la catégorie médiane (4-6
                    points). Le montant réel peut aller de 30 € à 700 € selon
                    la gravité — à vérifier auprès de la caisse.
                  </em>
                </div>
              ) : null}
              <div className="mt-1.5">
                Estimation indicative. Pour le montant exact, contactez votre
                caisse : FAMIWAL (Wallonie), FAMIRIS (Bruxelles), Groeipakket
                (Flandre), Ministerium DG (Ostbelgien).
              </div>
            </>
          }
        />
      ) : (
        <CalcInfo>
          Les barèmes diffèrent selon la <strong>région</strong> et la{" "}
          <strong>date de naissance</strong> de l'enfant (régime « ancien »
          avant 2019 vs « nouveau » après). Les ménages à bas revenu
          (&lt; 36 000 €/an) et monoparentaux bénéficient de suppléments
          sociaux. Le <strong>handicap reconnu</strong>, le statut{" "}
          <strong>orphelin</strong> et le rang (3e enfant à Bruxelles)
          ouvrent des suppléments additionnels.
        </CalcInfo>
      )}
    </CalcLayout>
  );
}
