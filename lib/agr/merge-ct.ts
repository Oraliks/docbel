/**
 * Rapprochement d'un WECH 505 (CT) avec une occupation (WECH 506) et fusion
 * de ses heures de chômage temporaire, avec déduplication.
 *
 * Règle métier (cf. agent FGTB) :
 *  - une occupation et son 505 doivent partager NISS + nom + n° ONSS employeur ;
 *  - le mois de référence doit être identique (sinon ce n'est pas le même
 *    décompte → on refuse) ;
 *  - les heures CT déjà présentes dans l'occupation (souvent le 506 contient
 *    déjà les codes 5.x dans sa grille) ne doivent PAS être recomptées :
 *    on déduplique par (jour, code, heures).
 *
 * Fonction pure et testable : elle ne mute rien, elle renvoie un « plan » que
 * l'UI applique (ajout d'heures PW/fermeture + message).
 */

import type { GrilleEntry } from "./parse-wech506";
import type { ParsedWech505 } from "./parse-wech505";
import { ctBucketForCode } from "./parse-wech505";

/** Identité d'une occupation côté client + heures CT déjà comptées. */
export interface CtOccupationRef {
  niss: string | null;
  nom: string | null;
  employeurOnss: string | null;
  moisDebut: string | null;
  moisFin: string | null;
  /** Entrées CT (codes 5.x) déjà intégrées à l'occupation. */
  ctEntries: GrilleEntry[];
}

export type CtMergeStatus =
  | "merged" // heures CT ajoutées
  | "duplicate" // correspondance trouvée mais tout est déjà présent
  | "no-match" // aucune occupation ne correspond (NISS/nom/ONSS)
  | "month-mismatch"; // identité OK mais mois différent

export interface CtMergePlan {
  status: CtMergeStatus;
  /** Index de l'occupation cible (null si no-match / month-mismatch). */
  matchedIndex: number | null;
  /** Entrées CT réellement nouvelles à intégrer. */
  newEntries: GrilleEntry[];
  /** Heures PW à ajouter à l'occupation. */
  addPw: number;
  /** Heures de fermeture à ajouter à l'occupation. */
  addFermeture: number;
  /** Conflits (même jour+code mais heures différentes) — non appliqués. */
  conflicts: GrilleEntry[];
  /** Message lisible pour l'utilisateur. */
  message: string;
}

const norm = (s: string | null | undefined, digitsOnly = false): string => {
  const t = (s ?? "").trim();
  return digitsOnly ? t.replace(/\D/g, "").replace(/^0+/, "") : t.toUpperCase().replace(/\s+/g, " ");
};

/** Deux NISS sont équivalents si leurs suites de chiffres coïncident. */
const sameNiss = (a: string | null, b: string | null) => {
  const da = (a ?? "").replace(/\D/g, "");
  const db = (b ?? "").replace(/\D/g, "");
  return da !== "" && da === db;
};

function sameIdentity(occ: CtOccupationRef, p: ParsedWech505): boolean {
  return (
    sameNiss(occ.niss, p.niss) &&
    norm(occ.nom) === norm(p.nomTravailleur) &&
    norm(occ.employeurOnss, true) === norm(p.employeurOnss, true)
  );
}

function sameMonth(occ: CtOccupationRef, p: ParsedWech505): boolean {
  const d = p.moisReference?.debut ?? null;
  const f = p.moisReference?.fin ?? null;
  return occ.moisDebut === d && occ.moisFin === f;
}

/** Filtre une grille pour ne garder que les entrées de chômage temporaire. */
export function ctEntriesOf(grille: GrilleEntry[]): GrilleEntry[] {
  return grille.filter((e) => ctBucketForCode(e.code) !== null);
}

const eqHeures = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * Calcule le plan de fusion d'un 505 dans la liste d'occupations.
 * `occupations` doit être dans le même ordre que l'état de l'UI.
 */
export function planCtMerge(p: ParsedWech505, occupations: CtOccupationRef[]): CtMergePlan {
  const idMatches = occupations
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => sameIdentity(o, p));

  if (idMatches.length === 0) {
    return {
      status: "no-match",
      matchedIndex: null,
      newEntries: [],
      addPw: 0,
      addFermeture: 0,
      conflicts: [],
      message:
        "Ce WECH 505 ne correspond à aucune occupation chargée (NISS / nom / ONSS). Chargez d'abord le WECH 506 correspondant.",
    };
  }

  const monthMatch = idMatches.find(({ o }) => sameMonth(o, p));
  if (!monthMatch) {
    return {
      status: "month-mismatch",
      matchedIndex: null,
      newEntries: [],
      addPw: 0,
      addFermeture: 0,
      conflicts: [],
      message: `Mois de référence différent (505 : ${p.moisReference?.debut ?? "?"} – ${p.moisReference?.fin ?? "?"}). DRS de mois différents : non fusionné.`,
    };
  }

  const { o: occ, i: matchedIndex } = monthMatch;
  const incoming = ctEntriesOf(p.grille);
  const newEntries: GrilleEntry[] = [];
  const conflicts: GrilleEntry[] = [];

  for (const e of incoming) {
    const exact = occ.ctEntries.some(
      (x) => x.jour === e.jour && x.code === e.code && eqHeures(x.heures, e.heures),
    );
    if (exact) continue; // déjà compté → on ignore
    const sameSlot = occ.ctEntries.some((x) => x.jour === e.jour && x.code === e.code);
    if (sameSlot) conflicts.push(e); // même jour/code, heures ≠ → ne pas recompter en aveugle
    else newEntries.push(e);
  }

  let addPw = 0;
  let addFermeture = 0;
  for (const e of newEntries) {
    if (ctBucketForCode(e.code) === "PW") addPw += e.heures;
    else addFermeture += e.heures;
  }
  addPw = Math.round(addPw * 100) / 100;
  addFermeture = Math.round(addFermeture * 100) / 100;

  if (newEntries.length === 0) {
    const conflictMsg = conflicts.length
      ? ` ${conflicts.length} entrée(s) en conflit d'heures à vérifier manuellement.`
      : "";
    return {
      status: "duplicate",
      matchedIndex,
      newEntries: [],
      addPw: 0,
      addFermeture: 0,
      conflicts,
      message:
        incoming.length === 0
          ? "Ce WECH 505 ne contient aucune heure de chômage temporaire."
          : `Heures CT déjà présentes dans l'occupation — rien à ajouter (pas de double comptage).${conflictMsg}`,
    };
  }

  const parts: string[] = [];
  if (addPw > 0) parts.push(`+${addPw} h PW`);
  if (addFermeture > 0) parts.push(`+${addFermeture} h fermeture`);
  const conflictMsg = conflicts.length
    ? ` · ${conflicts.length} conflit(s) d'heures non appliqué(s)`
    : "";
  return {
    status: "merged",
    matchedIndex,
    newEntries,
    addPw,
    addFermeture,
    conflicts,
    message: `Chômage temporaire ajouté à l'occupation ${matchedIndex + 1} : ${parts.join(" · ")}${conflictMsg}`,
  };
}
