// Glossaire des sigles administratifs belges.
//
// Pourquoi ce fichier existe : le copy de l'app est truffé d'acronymes
// ("ONEM", "CAPAC", "RIS", "C4"…) qui sont opaques pour un citoyen lambda.
// On centralise leur expansion + une définition courte ici pour que le
// composant <Acronym/> puisse afficher un tooltip cohérent partout, et
// que la moindre correction se fasse en un seul endroit.
//
// Convention d'écriture :
//   - `label`     : expansion littérale ("Office National de l'Emploi").
//   - `definition`: phrase courte, lisible, sans jargon. Pas de point final.
//   - `aliases`   : variantes orthographiques (casse, accents) acceptées
//                    par la détection automatique.
//
// Pour ajouter un sigle : poser une entrée et c'est tout. Le composant
// <Acronym code="ONEM"/> et l'helper d'auto-détection s'appuient sur le
// même registre.

/**
 * Univers fonctionnels — ce sont eux qui structurent la page /glossaire.
 *
 * Pourquoi ce découpage et pas l'alphabet : l'utilisateur arrive ici
 * parce qu'il ne CONNAÎT pas le sigle. Il connaît sa situation ("je
 * viens d'être licencié", "je vais au CPAS"). Regrouper par univers
 * lui fait gagner un cran cognitif — il filtre par "chômage" et trouve
 * son sigle sans rien savoir de la première lettre.
 */
export type AcronymDomain =
  | "chomage"
  | "cpas"
  | "entreprise"
  | "emploi-regional"
  | "sante-secu"
  | "juridique";

export const ACRONYM_DOMAINS: Record<
  AcronymDomain,
  {
    label: string;
    tagline: string;
    /**
     * Sigles à montrer en aperçu dans la tuile de l'univers — sert de
     * boussole visuelle : le visiteur reconnaît BCE/ONSS dans la tuile
     * "Entreprises" sans avoir besoin de comprendre notre système de
     * classement. 3-4 max par tuile.
     */
    featured: readonly string[];
  }
> = {
  chomage: {
    label: "Chômage & fin de contrat",
    tagline: "Si tu viens de perdre ton emploi ou que tu y émarges",
    featured: ["ONEM", "C4", "CAPAC"],
  },
  cpas: {
    label: "CPAS & aide sociale",
    tagline: "Revenu d'intégration, aide médicale, accompagnement",
    featured: ["CPAS", "RIS", "PIIS"],
  },
  "emploi-regional": {
    label: "Emploi en région",
    tagline: "Où s'inscrire et se former selon où on habite",
    featured: ["FOREM", "VDAB", "Actiris"],
  },
  entreprise: {
    label: "Entreprises & indépendants",
    tagline: "Créer, déclarer, cotiser, payer la TVA",
    featured: ["BCE", "ONSS", "TVA"],
  },
  "sante-secu": {
    label: "Santé & sécurité sociale",
    tagline: "Mutualités, identifiants, déclarations",
    featured: ["INAMI", "NISS", "BCSS"],
  },
  juridique: {
    label: "Cadre juridique",
    tagline: "Lois, conventions, administration fédérale",
    featured: ["SPF", "AR", "CCT"],
  },
};

export type AcronymEntry = {
  /** Forme canonique du sigle, ex. "ONEM". */
  code: string;
  /** Expansion littérale, ex. "Office National de l'Emploi". */
  label: string;
  /** Définition courte pour le tooltip. */
  definition: string;
  /** Univers de rattachement — utilisé par la page /glossaire. */
  domain: AcronymDomain;
  /** Variantes (utile pour le matcher : "C.A.P.A.C", "Onem"…). */
  aliases?: readonly string[];
};

export const ACRONYMS: Readonly<Record<string, AcronymEntry>> = {
  ONEM: {
    code: "ONEM",
    label: "Office National de l'Emploi",
    definition:
      "Organisme fédéral qui paie et contrôle les allocations de chômage et délivre les documents officiels (C4, C3…)",
    domain: "chomage",
  },
  ONSS: {
    code: "ONSS",
    label: "Office National de Sécurité Sociale",
    definition:
      "Perçoit les cotisations sociales des employeurs et travailleurs et les redistribue aux organismes de sécurité sociale",
    domain: "entreprise",
  },
  CAPAC: {
    code: "CAPAC",
    label: "Caisse Auxiliaire de Paiement des Allocations de Chômage",
    definition:
      "Caisse publique qui paie les allocations de chômage aux personnes non affiliées à un syndicat",
    domain: "chomage",
  },
  CPAS: {
    code: "CPAS",
    label: "Centre Public d'Action Sociale",
    definition:
      "Organisme communal qui garantit à chacun une vie conforme à la dignité humaine (revenu d'intégration, aide sociale, médicale…)",
    domain: "cpas",
  },
  RIS: {
    code: "RIS",
    label: "Revenu d'Intégration Sociale",
    definition:
      "Aide financière mensuelle versée par le CPAS aux personnes sans ressources suffisantes",
    domain: "cpas",
  },
  AGR: {
    code: "AGR",
    label: "Allocation de Garantie de Revenus",
    definition:
      "Complément payé par l'ONEM aux travailleurs à temps partiel involontaire pour atteindre un revenu minimum",
    domain: "chomage",
  },
  C4: {
    code: "C4",
    label: "Certificat de chômage C4",
    definition:
      "Document remis par l'employeur en fin de contrat — indispensable pour ouvrir un droit aux allocations de chômage",
    domain: "chomage",
  },
  C1: {
    code: "C1",
    label: "Déclaration de situation personnelle et familiale (C1)",
    definition:
      "Formulaire à remettre à l'organisme de paiement pour fixer le taux d'allocation (isolé, cohabitant, chef de ménage)",
    domain: "chomage",
  },
  C3: {
    code: "C3",
    label: "Carte de contrôle C3",
    definition:
      "Document mensuel où le chômeur indemnisé note ses jours de travail, maladie, vacances avant de l'envoyer à son organisme de paiement",
    domain: "chomage",
  },
  BCE: {
    code: "BCE",
    label: "Banque-Carrefour des Entreprises",
    definition:
      "Registre fédéral qui attribue un numéro d'entreprise unique à chaque entreprise et indépendant actif en Belgique",
    domain: "entreprise",
    aliases: ["B.C.E."],
  },
  BCSS: {
    code: "BCSS",
    label: "Banque-Carrefour de la Sécurité Sociale",
    definition:
      "Plate-forme d'échange de données entre les institutions de sécurité sociale belges",
    domain: "sante-secu",
  },
  FOREM: {
    code: "FOREM",
    label: "Office wallon de la Formation professionnelle et de l'Emploi",
    definition:
      "Service public de l'emploi et de la formation en Wallonie — où s'inscrivent les demandeurs d'emploi wallons",
    domain: "emploi-regional",
    aliases: ["Forem"],
  },
  VDAB: {
    code: "VDAB",
    label: "Vlaamse Dienst voor Arbeidsbemiddeling en Beroepsopleiding",
    definition:
      "Service public flamand de l'emploi et de la formation — équivalent du FOREM en Flandre",
    domain: "emploi-regional",
  },
  ACTIRIS: {
    code: "Actiris",
    label: "Office régional bruxellois de l'emploi",
    definition:
      "Service public de l'emploi en Région de Bruxelles-Capitale — où s'inscrivent les demandeurs d'emploi bruxellois",
    domain: "emploi-regional",
    aliases: ["Actiris", "ACTIRIS"],
  },
  ADG: {
    code: "ADG",
    label: "Arbeitsamt der Deutschsprachigen Gemeinschaft",
    definition:
      "Service public de l'emploi de la Communauté germanophone (cantons de l'Est)",
    domain: "emploi-regional",
  },
  INASTI: {
    code: "INASTI",
    label: "Institut National d'Assurance Sociale pour Travailleurs Indépendants",
    definition:
      "Gère la sécurité sociale des travailleurs indépendants (pension, mutuelle, allocations familiales…)",
    domain: "entreprise",
  },
  INAMI: {
    code: "INAMI",
    label: "Institut National d'Assurance Maladie-Invalidité",
    definition:
      "Organise l'assurance soins de santé et indemnités via les mutualités",
    domain: "sante-secu",
  },
  SPF: {
    code: "SPF",
    label: "Service Public Fédéral",
    definition:
      "Administration fédérale belge (ex. SPF Emploi, SPF Finances, SPF Justice)",
    domain: "juridique",
  },
  SPP: {
    code: "SPP",
    label: "Service Public de Programmation",
    definition:
      "Administration fédérale spécialisée — la plus connue est le SPP Intégration sociale, qui coordonne les CPAS",
    domain: "juridique",
  },
  PIIS: {
    code: "PIIS",
    label: "Projet Individualisé d'Intégration Sociale",
    definition:
      "Contrat conclu entre le CPAS et le bénéficiaire du RIS, qui fixe des objectifs personnalisés (formation, emploi, logement…)",
    domain: "cpas",
  },
  DIMONA: {
    code: "DIMONA",
    label: "Déclaration Immédiate à l'Emploi",
    definition:
      "Déclaration électronique que l'employeur doit transmettre à l'ONSS au plus tard au début de chaque mission",
    domain: "entreprise",
    aliases: ["Dimona"],
  },
  DRS: {
    code: "DRS",
    label: "Déclaration des Risques Sociaux",
    definition:
      "Ensemble des déclarations électroniques (chômage, maladie, accident…) que l'employeur envoie aux organismes de sécurité sociale",
    domain: "entreprise",
  },
  NISS: {
    code: "NISS",
    label: "Numéro d'Identification de la Sécurité Sociale",
    definition:
      "Numéro unique à 11 chiffres qui identifie chaque personne dans la sécurité sociale belge — figure au dos de la carte d'identité",
    domain: "sante-secu",
  },
  CCT: {
    code: "CCT",
    label: "Convention Collective de Travail",
    definition:
      "Accord signé entre employeurs et syndicats qui fixe les conditions de travail (salaires, congés…) d'un secteur ou d'une entreprise",
    domain: "juridique",
  },
  CP: {
    code: "CP",
    label: "Commission Paritaire",
    definition:
      "Organe sectoriel où patrons et syndicats négocient les conditions de travail. Chaque secteur a sa CP (numérotée)",
    domain: "juridique",
  },
  ASBL: {
    code: "ASBL",
    label: "Association Sans But Lucratif",
    definition:
      "Forme juridique d'association dont les bénéfices ne sont pas distribués aux membres mais réinvestis dans son objet social",
    domain: "entreprise",
  },
  AR: {
    code: "AR",
    label: "Arrêté Royal",
    definition:
      "Acte signé par le Roi sur proposition d'un ministre — la principale source de droit réglementaire en Belgique",
    domain: "juridique",
  },
  ALE: {
    code: "ALE",
    label: "Agence Locale pour l'Emploi",
    definition:
      "Permet à un chômeur de longue durée d'effectuer des prestations occasionnelles (jardinage, garde d'enfants…) tout en gardant ses allocations",
    domain: "chomage",
  },
  PFI: {
    code: "PFI",
    label: "Plan Formation-Insertion",
    definition:
      "Formation en entreprise (Wallonie) pour un demandeur d'emploi : il garde ses allocations et reçoit une prime de l'employeur",
    domain: "emploi-regional",
  },
  TVA: {
    code: "TVA",
    label: "Taxe sur la Valeur Ajoutée",
    definition:
      "Taxe indirecte payée sur la plupart des biens et services. Taux standard belge : 21%",
    domain: "entreprise",
  },
};

/**
 * Sigles à mettre en avant en haut du glossaire — couvre ~80% des recherches.
 * Garder court (5 max) : c'est un raccourci, pas un sommaire.
 */
export const POPULAR_ACRONYMS: readonly string[] = [
  "ONEM",
  "C4",
  "CPAS",
  "RIS",
  "BCE",
];

const ALIAS_INDEX: ReadonlyMap<string, AcronymEntry> = (() => {
  const map = new Map<string, AcronymEntry>();
  for (const entry of Object.values(ACRONYMS)) {
    map.set(entry.code.toUpperCase(), entry);
    for (const alias of entry.aliases ?? []) {
      map.set(alias.toUpperCase(), entry);
    }
  }
  return map;
})();

/**
 * Retourne l'entrée du glossaire pour un sigle donné, ou `undefined` si
 * inconnu. Insensible à la casse et aux variantes déclarées.
 */
export function lookupAcronym(code: string): AcronymEntry | undefined {
  return ALIAS_INDEX.get(code.trim().toUpperCase());
}

/**
 * Regex globale qui matche n'importe quel sigle connu, alias inclus.
 * Construite une seule fois, mémoïsée au niveau module.
 *
 * Note : on trie par longueur décroissante pour que "BCSS" gagne sur
 * "BCE" — sinon le moteur regex matcherait le préfixe en premier.
 */
export const ACRONYM_REGEX: RegExp = (() => {
  const tokens = Array.from(
    new Set(
      Object.values(ACRONYMS).flatMap((entry) => [
        entry.code,
        ...(entry.aliases ?? []),
      ]),
    ),
  )
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);
  // \b ne fonctionne pas avec les accents/caractères non-ASCII en JS,
  // donc on encadre par des lookarounds qui excluent lettres/chiffres.
  return new RegExp(`(?<![\\p{L}\\p{N}])(${tokens.join("|")})(?![\\p{L}\\p{N}])`, "gu");
})();

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Morceau de texte produit par `splitWithAcronyms`. Un segment est soit
 * du texte brut, soit un sigle reconnu (avec son entrée de glossaire).
 */
export type AcronymTextPart =
  | { kind: "text"; text: string }
  | { kind: "acronym"; text: string; entry: AcronymEntry };

/**
 * Découpe une string en alternance texte / sigle reconnu. Permet à un
 * composant de wrapper chaque sigle dans <Acronym/> sans toucher au reste.
 *
 * Exemple :
 *   splitWithAcronyms("Le ONEM délivre le C4")
 *   → [
 *       { kind: "text",    text: "Le " },
 *       { kind: "acronym", text: "ONEM", entry: ACRONYMS.ONEM },
 *       { kind: "text",    text: " délivre le " },
 *       { kind: "acronym", text: "C4",   entry: ACRONYMS.C4 },
 *     ]
 */
export function splitWithAcronyms(input: string): AcronymTextPart[] {
  if (!input) return [];
  const parts: AcronymTextPart[] = [];
  // ACRONYM_REGEX a le flag /g — on doit reset lastIndex pour rester
  // ré-entrant (sinon un second appel sauterait des matches).
  ACRONYM_REGEX.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = ACRONYM_REGEX.exec(input)) !== null) {
    const matched = match[0];
    const entry = lookupAcronym(matched);
    if (!entry) continue; // sécurité : la regex n'est censée matcher que du connu
    if (match.index > cursor) {
      parts.push({ kind: "text", text: input.slice(cursor, match.index) });
    }
    parts.push({ kind: "acronym", text: matched, entry });
    cursor = match.index + matched.length;
  }
  if (cursor < input.length) {
    parts.push({ kind: "text", text: input.slice(cursor) });
  }
  return parts;
}

// ============================================================
// Recherche intelligente — utilisée par la page /glossaire
// ============================================================
//
// Objectifs :
//   - Tolérer les espaces parasites en début/fin ("C3 " ne doit pas
//     renvoyer 0 résultat).
//   - Accents-insensitive ("secu" matche "sécurité").
//   - Multi-token : "office emploi" matche ONEM via son label.
//   - Tolérer les fautes de frappe (typos ≤ 1-2 caractères selon longueur).
//   - Suggérer des candidats proches quand 0 match exact ("nisss" → NISS).
//
// Scoring : exact > prefix > substring > fuzzy. Les fields ont des poids
// (code > alias > label > définition) pour que "BCE" préfère renvoyer
// BCE plutôt qu'une entrée qui mentionne "BCE" dans sa définition.

export type AcronymSearchResult = {
  /** Entrées correspondant à la requête, triées par score décroissant. */
  matches: readonly AcronymEntry[];
  /** Candidats les plus proches quand `matches` est vide. */
  suggestions: readonly AcronymEntry[];
};

/** Normalise une string : sans accents, en minuscules. */
function normalizeForSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Distance de Levenshtein — combien d'éditions (ajout/suppression/
 * substitution) pour passer de `a` à `b`. Implémentation 2-rows
 * standard, O(|a|·|b|) temps, O(min) espace.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Score d'une entrée par rapport à un ensemble de tokens normalisés. */
function scoreEntry(entry: AcronymEntry, tokens: readonly string[]): number {
  const code = normalizeForSearch(entry.code);
  const label = normalizeForSearch(entry.label);
  const definition = normalizeForSearch(entry.definition);
  const aliases = (entry.aliases ?? []).map(normalizeForSearch);

  let total = 0;
  for (const tok of tokens) {
    let tokScore = 0;
    if (code === tok) tokScore = 100;
    else if (aliases.some((a) => a === tok)) tokScore = 90;
    else if (code.startsWith(tok)) tokScore = 70;
    else if (code.includes(tok)) tokScore = 50;
    else if (aliases.some((a) => a.includes(tok))) tokScore = 45;
    else if (label.includes(tok)) tokScore = 30;
    else if (definition.includes(tok)) tokScore = 15;
    else if (code.length >= 3 && tok.length >= 3) {
      // Fuzzy : 1 édit toléré tous les 3 caractères du code.
      const tolerance = Math.max(1, Math.floor(code.length / 3));
      if (levenshtein(tok, code) <= tolerance) tokScore = 8;
    }
    // Tous les tokens doivent toucher quelque chose, sinon l'entrée
    // est rejetée — "office finance" ne doit pas matcher ONEM juste
    // parce que "office" est dans le label.
    if (tokScore === 0) return 0;
    total += tokScore;
  }
  return total;
}

/**
 * Recherche les sigles correspondant à la requête. Retourne aussi des
 * suggestions (sigles proches phonétiquement / orthographiquement)
 * quand il n'y a pas de match exact — utile pour récupérer une
 * frappe "nisss" → NISS.
 *
 * Trim + normalisation accents sont appliqués → "C3 " ou "Sécu"
 * matchent ce qu'on attend.
 */
export function searchAcronyms(rawQuery: string): AcronymSearchResult {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return {
      matches: Object.values(ACRONYMS),
      suggestions: [],
    };
  }

  const normalized = normalizeForSearch(trimmed);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  const scored: { entry: AcronymEntry; score: number }[] = [];
  for (const entry of Object.values(ACRONYMS)) {
    const score = scoreEntry(entry, tokens);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return { matches: scored.map((s) => s.entry), suggestions: [] };
  }

  // Aucun match — on cherche les sigles les plus proches par
  // distance Levenshtein sur le code OU le premier mot du label.
  // Tolérance proportionnelle à la longueur de la requête : 1 édit
  // pour 3 caractères, sinon "xyz" matcherait "RIS" (3 édits sur 3
  // chars = score laxiste mais sémantiquement vide).
  const tolerance = Math.max(1, Math.floor(normalized.length / 3));
  const suggestionPool = Object.values(ACRONYMS)
    .map((entry) => {
      const code = normalizeForSearch(entry.code);
      const firstWord = normalizeForSearch(entry.label.split(/\s+/)[0] ?? "");
      const dist = Math.min(
        levenshtein(normalized, code),
        firstWord ? levenshtein(normalized, firstWord) : Infinity,
      );
      return { entry, dist };
    })
    .filter((x) => x.dist <= tolerance)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 4)
    .map((x) => x.entry);

  return { matches: [], suggestions: suggestionPool };
}
