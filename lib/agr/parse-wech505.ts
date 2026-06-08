/**
 * Parseur du WECH 505 (formulaire C3.2 « paiements ») — déclaration mensuelle
 * d'heures de chômage temporaire (CT).
 *
 * Même mise en page que le WECH 506 : on réutilise les mêmes ancres pour
 * l'identité (NISS, nom, employeur ONSS, mois de référence) et les données de
 * travail (Q/S), puis on agrège la grille — qui ne contient que des codes CT
 * (5.x) — en heures PW (CT indemnisable) et fermeture (CT vacances annuelles).
 *
 * Le 505 ne porte ni Y-Brut ni salaire théorique mensuel : il sert uniquement
 * à apporter/confirmer les heures de chômage temporaire d'une occupation.
 * Le rapprochement avec une occupation (WECH 506) et la déduplication des
 * heures déjà déclarées sont gérés par `merge-ct.ts`.
 */

import type { GrilleEntry } from "./parse-wech506";

export interface ParsedWech505 {
  /** Mois de référence (début/fin), format JJ/MM/AAAA. */
  moisReference: { debut: string; fin: string } | null;
  niss: string | null;
  nomTravailleur: string | null;
  employeurOnss: string | null;
  employeurNom: string | null;
  numeroTicket: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  q: number;
  s: number;
  /** Grille de travail (uniquement des codes CT 5.x). */
  grille: GrilleEntry[];
  /** Heures CT agrégées. */
  buckets: {
    /** PW — CT indemnisable (manque de travail, intempéries, force majeure…). */
    pw1: number;
    /** Fermeture — CT vacances annuelles / CCT / repos compensatoire. */
    fermetureTotal: number;
  };
  parCode: Record<string, number>;
  /** Codes de grille non reconnus comme CT (anomalie sur un 505). */
  codesAVerifier: { code: string; heures: number; libelle: string }[];
}

/** Mapping des codes CT (5.x) du WECH 505 → poste de calcul. */
const CT_CODE_MAP: Record<string, "PW" | "fermeture"> = {
  "5.1": "PW", "5.2": "PW", "5.3": "PW", "5.4": "PW", "5.5": "PW",
  "5.9": "PW", "5.10": "PW", "5.11": "PW",
  "5.6": "fermeture", "5.7": "fermeture", "5.8": "fermeture",
};

/** Poste de calcul d'un code de prestation CT, ou null si non reconnu. */
export function ctBucketForCode(code: string): "PW" | "fermeture" | null {
  return CT_CODE_MAP[code] ?? null;
}

/** Parse un nombre belge (« 19,00 ») ; « / » ou vide → 0. */
function num(s: string | undefined | null): number {
  if (!s) return 0;
  const t = s.trim();
  if (t === "/" || t === "" || t === "-") return 0;
  const v = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

function cap(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

/** Vrai si le texte extrait provient d'un WECH 505 (et non d'un 506). */
export function isWech505(text: string): boolean {
  return /WECH\s*505/i.test(text) || /C3[.\- ]?2\s+paiements/i.test(text);
}

export function parseWech505(text: string): ParsedWech505 {
  // ─── Identité / en-tête (mêmes ancres que le 506) ────────────────────────
  const moisM = text.match(
    /Mois de r[ée]f[ée]rence\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/,
  );
  const moisReference = moisM ? { debut: moisM[1], fin: moisM[2] } : null;

  const nissM = text.match(/NISS\s+Nom,\s*Pr[ée]nom\s*\n\s*([\d.\- ]+?)\s{2,}(.+)/);
  const nissLine = text.match(/(\d{2,}[\d.\- ]*\d)\s+([A-ZÀ-Ÿ].+?, ?[A-ZÀ-Ÿ].+)/);
  const niss = nissM ? nissM[1].trim() : nissLine ? nissLine[1].trim() : null;
  const nomTravailleur = nissM ? nissM[2].trim() : nissLine ? nissLine[2].trim() : null;

  const numeroTicket = cap(text, /Statut[\s\S]*?\n[^\n]*\(\s*Original\s*\)\s*([A-Z0-9]+)/);

  const employeurOnss = cap(text, /n[°ºo]\s*ONSS[\s\S]*?\n\s*(\d{6,})/);
  const employeurNom = cap(text, /(?:Les donn[ée]es de l['’]employeur)[\s\S]*?\nNom\s*\n\s*(.+)/);

  // ─── Données de travail (dates, Q, S) ────────────────────────────────────
  const travM = text.match(
    /Facteur\s*Q\s+Facteur\s*S\s*\n\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+)\s+([\d,]+)/,
  );
  const dateDebut = travM ? travM[1] : null;
  const dateFin = travM ? travM[2] : null;
  const q = travM ? num(travM[3]) : 0;
  const s = travM ? num(travM[4]) : 0;

  // ─── Grille de travail (codes CT uniquement) ─────────────────────────────
  const grille: GrilleEntry[] = [];
  const grilleSection =
    text.split(/Grille de travail/)[1]?.split(/WECH\s*505|CODES POUR/)[0] ?? "";
  const tripletRe = /(\d{2}\/\d{2})\s+(\d+(?:\.\d+)?)\s+(\d+,\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = tripletRe.exec(grilleSection))) {
    grille.push({ jour: m[1], code: m[2], heures: num(m[3]) });
  }

  // ─── Agrégation par poste CT ─────────────────────────────────────────────
  const parCode: Record<string, number> = {};
  const buckets = { pw1: 0, fermetureTotal: 0 };
  const aVerifierMap = new Map<string, number>();
  for (const e of grille) {
    parCode[e.code] = (parCode[e.code] ?? 0) + e.heures;
    const poste = CT_CODE_MAP[e.code];
    if (poste === "PW") buckets.pw1 += e.heures;
    else if (poste === "fermeture") buckets.fermetureTotal += e.heures;
    else aVerifierMap.set(e.code, (aVerifierMap.get(e.code) ?? 0) + e.heures);
  }
  const codesAVerifier = [...aVerifierMap.entries()].map(([code, heures]) => ({
    code,
    heures: Math.round(heures * 100) / 100,
    libelle: `Code ${code} (non reconnu comme CT)`,
  }));

  buckets.pw1 = Math.round(buckets.pw1 * 100) / 100;
  buckets.fermetureTotal = Math.round(buckets.fermetureTotal * 100) / 100;
  for (const k of Object.keys(parCode)) parCode[k] = Math.round(parCode[k] * 100) / 100;

  return {
    moisReference, niss, nomTravailleur, employeurOnss, employeurNom,
    numeroTicket, dateDebut, dateFin, q, s,
    grille, buckets, parCode, codesAVerifier,
  };
}
