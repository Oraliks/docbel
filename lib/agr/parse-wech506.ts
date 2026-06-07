/**
 * Parseur du WECH 506 (formulaire C131B) — déclaration mensuelle de travail à
 * temps partiel avec AGR.
 *
 * Entrée : le texte du PDF (extrait via `extract-pdf-text.ts`).
 * Sortie : données d'identité + données de travail + grille agrégée en
 * « buckets » (HT / V / PW / PR / fermeture / absence) prêtes pour le moteur.
 *
 * ⚠️ La correspondance code → bucket couvre les codes courants ; les codes
 * ambigus (3.4, 3.5, 6.1–6.9, 8, 9, 10.x) sont remontés dans `codesAVerifier`
 * pour relecture par l'agent (l'UI les rend modifiables).
 */

import { deriverCategorieTravailleur } from "./categorie-travailleur";
import type { CategorieTravailleur } from "./types";

export interface GrilleEntry {
  jour: string;
  code: string;
  heures: number;
}

export interface ParsedWech506 {
  /** Mois de référence (début/fin), format JJ/MM/AAAA. */
  moisReference: { debut: string; fin: string } | null;
  niss: string | null;
  nomTravailleur: string | null;
  employeurOnss: string | null;
  employeurNom: string | null;
  categorieEmployeur: string | null;
  codeTravailleur: string | null;
  /** Catégorie travailleur dérivée (1O/1E/2E/2P/3), null si indéterminée. */
  categorieTravailleur: CategorieTravailleur | null;
  numeroTicket: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  /** Facteur Q. */
  q: number;
  /** Facteur S. */
  s: number;
  /** Code « Interruption de l'occupation » (→ Qinfo 2 ou 3). */
  interruption: number | null;
  qinfo: 2 | 3;
  /** Schéma de travail (type d'horaire 10/11/12/13…), informatif. */
  schemaTravail: string | null;
  ybrut: number;
  salaireTheoriqueMois: number;
  salaireTheoriqueHeure: number;
  /** Refus d'occupation supplémentaire (CCT 35) : 1 = oui. */
  refusOccupation: number;
  grille: GrilleEntry[];
  /** Heures agrégées par bucket. */
  buckets: {
    heures: number; // HT
    heuresV: number;
    pw1: number;
    pr: number;
    fermetureTotal: number;
    heuresA: number;
  };
  /** Détail des heures par code (pour audit / affichage). */
  parCode: Record<string, number>;
  /** Codes non mappés automatiquement, à classer par l'agent. */
  codesAVerifier: { code: string; heures: number; libelle: string }[];
}

type Bucket = "HT" | "V" | "PW" | "PR" | "fermeture" | "A";

/** Correspondance code de prestation → bucket de calcul (codes courants). */
const CODE_MAP: Record<string, Bucket> = {
  "1": "HT", "1.1": "HT", "1.3": "HT", "1.4": "HT", "1.5": "HT",
  "2.1": "HT", "2.2": "HT", "2.3": "HT", "2.4": "HT", "2.5": "HT",
  "2.6": "HT", "2.7": "HT", "2.8": "HT", "2.9": "HT",
  "3.1": "V", "3.2": "V", "3.3": "V",
  "4": "HT",
  "5.1": "PW", "5.2": "PW", "5.3": "PW", "5.4": "PW", "5.5": "PW",
  "5.9": "PW", "5.10": "PW", "5.11": "PW",
  "5.6": "fermeture", "5.7": "fermeture", "5.8": "fermeture",
  "6.10": "PR", "6.11": "PR",
  "7": "A",
};

const LIBELLES_CODE: Record<string, string> = {
  "3.4": "Vacances jeunes / seniors",
  "3.5": "Vacances supplémentaires (art. 17bis)",
  "6.1": "Incapacité — indemnité accident du travail (art. 54)",
  "6.2": "Absence non rémunérée maladie/accident",
  "6.3": "Travail adapté avec perte de salaire",
  "6.4": "Écartement / repos de maternité / congé de paternité",
  "6.5": "Incapacité — salaire garanti non payé (chômage temporaire)",
  "6.6": "Incapacité — salaire garanti non payé (rechute)",
  "6.7": "Incapacité — salaire garanti non payé (vacances collectives)",
  "6.8": "Incapacité — salaire garanti non payé (raisons travailleur)",
  "6.9": "Incapacité — salaire garanti non payé (ancienneté insuffisante)",
  "8": "Jours habituels d'inactivité",
  "9": "Jours d'absence pour soins d'accueil",
};

/** Parse un nombre belge (« 19,00 ») ; « / » ou vide → 0. */
function num(s: string | undefined | null): number {
  if (!s) return 0;
  const t = s.trim();
  if (t === "/" || t === "" || t === "-") return 0;
  const v = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

/** Première valeur capturée d'une regex, ou null. */
function cap(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

export function parseWech506(text: string): ParsedWech506 {
  // ─── Identité / en-tête ──────────────────────────────────────────────────
  const moisM = text.match(
    /Mois de r[ée]f[ée]rence\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/,
  );
  const moisReference = moisM ? { debut: moisM[1], fin: moisM[2] } : null;

  const nissM = text.match(/NISS\s+Nom,\s*Pr[ée]nom\s*\n\s*([\d.\- ]+?)\s{2,}(.+)/);
  // Repli : ligne « 770725054-86 NAIT CHRIF, HASSNA »
  const nissLine = text.match(/(\d{2,}[\d.\- ]*\d)\s+([A-ZÀ-Ÿ].+?, ?[A-ZÀ-Ÿ].+)/);
  const niss = nissM ? nissM[1].trim() : nissLine ? nissLine[1].trim() : null;
  const nomTravailleur = nissM ? nissM[2].trim() : nissLine ? nissLine[2].trim() : null;

  const numeroTicket = cap(text, /Statut[\s\S]*?\n[^\n]*\(\s*Original\s*\)\s*([A-Z0-9]+)/);

  // Employeur : 1ʳᵉ valeur de la ligne sous « n° ONSS … n° unique ».
  const employeurOnss = cap(text, /n[°ºo]\s*ONSS[\s\S]*?\n\s*(\d{6,})/);
  const employeurNom = cap(text, /(?:Les donn[ée]es de l['’]employeur)[\s\S]*?\nNom\s*\n\s*(.+)/);

  const catEmpM = text.match(
    /Categorie\s+Com\s*PAR\s+Code\s+travailleur\s+Code\s+NACE\s*\n\s*(\d+)\s+(\d+)\s+(\d+)/,
  );
  const categorieEmployeur = catEmpM ? catEmpM[1] : null;
  const codeTravailleur = catEmpM ? catEmpM[3] : null;
  const categorieTravailleur =
    categorieEmployeur && codeTravailleur
      ? deriverCategorieTravailleur(categorieEmployeur, codeTravailleur)
      : null;

  // ─── Données de travail ──────────────────────────────────────────────────
  // « 01/12/2023 31/12/2023 19,00 38,00 » sous l'en-tête Facteur Q / Facteur S.
  const travM = text.match(
    /Facteur\s*Q\s+Facteur\s*S\s*\n\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+)\s+([\d,]+)/,
  );
  const dateDebut = travM ? travM[1] : null;
  const dateFin = travM ? travM[2] : null;
  const q = travM ? num(travM[3]) : 0;
  const s = travM ? num(travM[4]) : 0;

  // « 5,00 2 ( occupation … ) » : nbre jrs/sem + code interruption.
  const interM = text.match(/Interruption de l['’]occupation[\s\S]*?\n[^\n]*?\b(\d+,\d{2})\s+(\d)\s*\(/);
  const interruption = interM ? parseInt(interM[2], 10) : null;
  const qinfo: 2 | 3 = interruption === 3 ? 3 : 2;

  const schemaTravail = cap(text, /Schema de travail\s*\n\s*(\d+)\s*\(/);

  // « 1221,38 1221,38 / » sous l'en-tête Y-Brut / Salaire mensuel / horaire.
  const ybrutM = text.match(
    /Y-Brut[\s\S]*?\(\s*Th[ée]orique\s*\)\s*\n\s*([\d,]+)\s+([\d,/]+)\s+([\d,/]+)/,
  );
  const ybrut = ybrutM ? num(ybrutM[1]) : 0;
  const salaireTheoriqueMois = ybrutM ? num(ybrutM[2]) : 0;
  const salaireTheoriqueHeure = ybrutM ? num(ybrutM[3]) : 0;

  const refusM = text.match(/courant du mois\s*\n\s*(\d)\s*-/);
  const refusOccupation = refusM ? parseInt(refusM[1], 10) : 0;

  // ─── Grille de travail ───────────────────────────────────────────────────
  const grille: GrilleEntry[] = [];
  const grilleSection = text.split(/Grille de travail/)[1]?.split(/WECH506|CODES POUR/)[0] ?? "";
  // Triplets « JJ/MM  code  H,HH » (jusqu'à 2 par ligne).
  const tripletRe = /(\d{2}\/\d{2})\s+(\d+(?:\.\d+)?)\s+(\d+,\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = tripletRe.exec(grilleSection))) {
    grille.push({ jour: m[1], code: m[2], heures: num(m[3]) });
  }

  // ─── Agrégation par bucket ───────────────────────────────────────────────
  const parCode: Record<string, number> = {};
  const buckets = { heures: 0, heuresV: 0, pw1: 0, pr: 0, fermetureTotal: 0, heuresA: 0 };
  const aVerifierMap = new Map<string, number>();
  for (const e of grille) {
    parCode[e.code] = (parCode[e.code] ?? 0) + e.heures;
    const bucket = CODE_MAP[e.code];
    if (bucket === "HT") buckets.heures += e.heures;
    else if (bucket === "V") buckets.heuresV += e.heures;
    else if (bucket === "PW") buckets.pw1 += e.heures;
    else if (bucket === "PR") buckets.pr += e.heures;
    else if (bucket === "fermeture") buckets.fermetureTotal += e.heures;
    else if (bucket === "A") buckets.heuresA += e.heures;
    else aVerifierMap.set(e.code, (aVerifierMap.get(e.code) ?? 0) + e.heures);
  }
  const codesAVerifier = [...aVerifierMap.entries()].map(([code, heures]) => ({
    code,
    heures: Math.round(heures * 100) / 100,
    libelle: LIBELLES_CODE[code] ?? `Code ${code}`,
  }));

  for (const k of Object.keys(buckets) as (keyof typeof buckets)[]) {
    buckets[k] = Math.round(buckets[k] * 100) / 100;
  }
  for (const k of Object.keys(parCode)) parCode[k] = Math.round(parCode[k] * 100) / 100;

  return {
    moisReference, niss, nomTravailleur, employeurOnss, employeurNom,
    categorieEmployeur, codeTravailleur, categorieTravailleur, numeroTicket,
    dateDebut, dateFin, q, s, interruption, qinfo, schemaTravail,
    ybrut, salaireTheoriqueMois, salaireTheoriqueHeure, refusOccupation,
    grille, buckets, parCode, codesAVerifier,
  };
}
