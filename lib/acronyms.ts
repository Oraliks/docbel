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

export type AcronymEntry = {
  /** Forme canonique du sigle, ex. "ONEM". */
  code: string;
  /** Expansion littérale, ex. "Office National de l'Emploi". */
  label: string;
  /** Définition courte pour le tooltip. */
  definition: string;
  /** Variantes (utile pour le matcher : "C.A.P.A.C", "Onem"…). */
  aliases?: readonly string[];
};

export const ACRONYMS: Readonly<Record<string, AcronymEntry>> = {
  ONEM: {
    code: "ONEM",
    label: "Office National de l'Emploi",
    definition:
      "Organisme fédéral qui paie et contrôle les allocations de chômage et délivre les documents officiels (C4, C3…)",
  },
  ONSS: {
    code: "ONSS",
    label: "Office National de Sécurité Sociale",
    definition:
      "Perçoit les cotisations sociales des employeurs et travailleurs et les redistribue aux organismes de sécurité sociale",
  },
  CAPAC: {
    code: "CAPAC",
    label: "Caisse Auxiliaire de Paiement des Allocations de Chômage",
    definition:
      "Caisse publique qui paie les allocations de chômage aux personnes non affiliées à un syndicat",
  },
  CPAS: {
    code: "CPAS",
    label: "Centre Public d'Action Sociale",
    definition:
      "Organisme communal qui garantit à chacun une vie conforme à la dignité humaine (revenu d'intégration, aide sociale, médicale…)",
  },
  RIS: {
    code: "RIS",
    label: "Revenu d'Intégration Sociale",
    definition:
      "Aide financière mensuelle versée par le CPAS aux personnes sans ressources suffisantes",
  },
  AGR: {
    code: "AGR",
    label: "Allocation de Garantie de Revenus",
    definition:
      "Complément payé par l'ONEM aux travailleurs à temps partiel involontaire pour atteindre un revenu minimum",
  },
  C4: {
    code: "C4",
    label: "Certificat de chômage C4",
    definition:
      "Document remis par l'employeur en fin de contrat — indispensable pour ouvrir un droit aux allocations de chômage",
  },
  C1: {
    code: "C1",
    label: "Déclaration de situation personnelle et familiale (C1)",
    definition:
      "Formulaire à remettre à l'organisme de paiement pour fixer le taux d'allocation (isolé, cohabitant, chef de ménage)",
  },
  C3: {
    code: "C3",
    label: "Carte de contrôle C3",
    definition:
      "Document mensuel où le chômeur indemnisé note ses jours de travail, maladie, vacances avant de l'envoyer à son organisme de paiement",
  },
  BCE: {
    code: "BCE",
    label: "Banque-Carrefour des Entreprises",
    definition:
      "Registre fédéral qui attribue un numéro d'entreprise unique à chaque entreprise et indépendant actif en Belgique",
    aliases: ["B.C.E."],
  },
  BCSS: {
    code: "BCSS",
    label: "Banque-Carrefour de la Sécurité Sociale",
    definition:
      "Plate-forme d'échange de données entre les institutions de sécurité sociale belges",
  },
  FOREM: {
    code: "FOREM",
    label: "Office wallon de la Formation professionnelle et de l'Emploi",
    definition:
      "Service public de l'emploi et de la formation en Wallonie — où s'inscrivent les demandeurs d'emploi wallons",
    aliases: ["Forem"],
  },
  VDAB: {
    code: "VDAB",
    label: "Vlaamse Dienst voor Arbeidsbemiddeling en Beroepsopleiding",
    definition:
      "Service public flamand de l'emploi et de la formation — équivalent du FOREM en Flandre",
  },
  ACTIRIS: {
    code: "Actiris",
    label: "Office régional bruxellois de l'emploi",
    definition:
      "Service public de l'emploi en Région de Bruxelles-Capitale — où s'inscrivent les demandeurs d'emploi bruxellois",
    aliases: ["Actiris", "ACTIRIS"],
  },
  ADG: {
    code: "ADG",
    label: "Arbeitsamt der Deutschsprachigen Gemeinschaft",
    definition:
      "Service public de l'emploi de la Communauté germanophone (cantons de l'Est)",
  },
  INASTI: {
    code: "INASTI",
    label: "Institut National d'Assurance Sociale pour Travailleurs Indépendants",
    definition:
      "Gère la sécurité sociale des travailleurs indépendants (pension, mutuelle, allocations familiales…)",
  },
  INAMI: {
    code: "INAMI",
    label: "Institut National d'Assurance Maladie-Invalidité",
    definition:
      "Organise l'assurance soins de santé et indemnités via les mutualités",
  },
  SPF: {
    code: "SPF",
    label: "Service Public Fédéral",
    definition:
      "Administration fédérale belge (ex. SPF Emploi, SPF Finances, SPF Justice)",
  },
  SPP: {
    code: "SPP",
    label: "Service Public de Programmation",
    definition:
      "Administration fédérale spécialisée — la plus connue est le SPP Intégration sociale, qui coordonne les CPAS",
  },
  PIIS: {
    code: "PIIS",
    label: "Projet Individualisé d'Intégration Sociale",
    definition:
      "Contrat conclu entre le CPAS et le bénéficiaire du RIS, qui fixe des objectifs personnalisés (formation, emploi, logement…)",
  },
  DIMONA: {
    code: "DIMONA",
    label: "Déclaration Immédiate à l'Emploi",
    definition:
      "Déclaration électronique que l'employeur doit transmettre à l'ONSS au plus tard au début de chaque mission",
    aliases: ["Dimona"],
  },
  DRS: {
    code: "DRS",
    label: "Déclaration des Risques Sociaux",
    definition:
      "Ensemble des déclarations électroniques (chômage, maladie, accident…) que l'employeur envoie aux organismes de sécurité sociale",
  },
  NISS: {
    code: "NISS",
    label: "Numéro d'Identification de la Sécurité Sociale",
    definition:
      "Numéro unique à 11 chiffres qui identifie chaque personne dans la sécurité sociale belge — figure au dos de la carte d'identité",
  },
  CCT: {
    code: "CCT",
    label: "Convention Collective de Travail",
    definition:
      "Accord signé entre employeurs et syndicats qui fixe les conditions de travail (salaires, congés…) d'un secteur ou d'une entreprise",
  },
  CP: {
    code: "CP",
    label: "Commission Paritaire",
    definition:
      "Organe sectoriel où patrons et syndicats négocient les conditions de travail. Chaque secteur a sa CP (numérotée)",
  },
  ASBL: {
    code: "ASBL",
    label: "Association Sans But Lucratif",
    definition:
      "Forme juridique d'association dont les bénéfices ne sont pas distribués aux membres mais réinvestis dans son objet social",
  },
  AR: {
    code: "AR",
    label: "Arrêté Royal",
    definition:
      "Acte signé par le Roi sur proposition d'un ministre — la principale source de droit réglementaire en Belgique",
  },
  ALE: {
    code: "ALE",
    label: "Agence Locale pour l'Emploi",
    definition:
      "Permet à un chômeur de longue durée d'effectuer des prestations occasionnelles (jardinage, garde d'enfants…) tout en gardant ses allocations",
  },
  PFI: {
    code: "PFI",
    label: "Plan Formation-Insertion",
    definition:
      "Formation en entreprise (Wallonie) pour un demandeur d'emploi : il garde ses allocations et reçoit une prime de l'employeur",
  },
  TVA: {
    code: "TVA",
    label: "Taxe sur la Valeur Ajoutée",
    definition:
      "Taxe indirecte payée sur la plupart des biens et services. Taux standard belge : 21%",
  },
};

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
