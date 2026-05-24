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
 * parentalité) et la carte de résultat avec les primitives `_shared`.
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
  type Region,
} from "@/lib/calculators/allocs-fam";

type MonoYesNo = "oui" | "non";

interface EnfantRow {
  /** Identifiant local pour la clé React (n'affecte pas le calcul). */
  uid: number;
  /** Année de naissance saisie sous forme de string (parsée au calcul). */
  anneeNaissance: string;
}

const ANNEE_COURANTE = new Date().getFullYear();
const DEFAUT_ANNEE_ENFANT = ANNEE_COURANTE - 5; // ex : 2021 si on est en 2026

let _uid = 0;
const nextUid = () => ++_uid;

export function CalcAllocsFam({ accent }: { accent: string }) {
  const [region, setRegion] = useState<Region>("wallonie");
  const [revenu, setRevenu] = useState("50000");
  const [monoparental, setMonoparental] = useState<MonoYesNo>("non");
  const [enfants, setEnfants] = useState<EnfantRow[]>([
    { uid: nextUid(), anneeNaissance: String(DEFAUT_ANNEE_ENFANT) },
  ]);
  const [result, setResult] = useState<AllocsFamResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addEnfant = () => {
    if (enfants.length >= 10) return;
    setEnfants((prev) => [
      ...prev,
      { uid: nextUid(), anneeNaissance: String(DEFAUT_ANNEE_ENFANT) },
    ]);
  };

  const removeEnfant = (uid: number) => {
    setEnfants((prev) => prev.filter((e) => e.uid !== uid));
  };

  const updateEnfant = (uid: number, anneeNaissance: string) => {
    setEnfants((prev) =>
      prev.map((e) => (e.uid === uid ? { ...e, anneeNaissance } : e)),
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
      sélectionnez votre région et ajoutez vos enfants.
    </>
  );

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
              className="flex items-end gap-2 rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3"
            >
              <div className="flex-1">
                <CalcField
                  id={`allocs-enfant-${enfant.uid}`}
                  label={`Enfant ${idx + 1} — année de naissance`}
                  value={enfant.anneeNaissance}
                  onChange={(v) => updateEnfant(enfant.uid, v)}
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
          rows={result.detail.map((d) => ({
            label: `Enfant ${d.rang} — ${d.age} an${d.age > 1 ? "s" : ""}`,
            value: fmtEUR(d.total),
            emphasis: false,
          }))}
          footer={
            <>
              Bonus rentrée scolaire annuel estimé :{" "}
              <strong>{fmtEUR(result.bonusRentreeAnnuel)}</strong>. Estimation
              indicative. Pour le montant exact, contactez votre caisse :
              FAMIWAL (Wallonie), FAMIRIS (Bruxelles), Groeipakket (Flandre),
              Ministerium DG (Ostbelgien).
            </>
          }
        />
      ) : (
        <CalcInfo>
          Les barèmes diffèrent selon la <strong>région</strong> et la{" "}
          <strong>date de naissance</strong> de l'enfant (régime « ancien »
          avant 2019/2020 vs « nouveau » après). Les ménages à bas revenu
          (&lt; 36 000 €/an) et monoparentaux bénéficient de suppléments
          sociaux dans la plupart des régimes.
        </CalcInfo>
      )}
    </CalcLayout>
  );
}
