/// Détection best-effort de nationalité EEE/Suisse. La nationalité C1
/// (`nationalit_3`) est un champ TEXTE LIBRE (ex. « Belge », « Marocaine »),
/// sans liste de pays — cette fonction sert uniquement la dérivation de
/// `nationaliteHorsEEE` (cf. field-derivations.ts). Un texte non reconnu
/// (nationalité hors-liste, faute de frappe non couverte…) est traité comme
/// "hors EEE" par la dérivation appelante : risque de faux positif accepté
/// par Oraliks le 2026-07-08 malgré la nature non structurée du champ source
/// (choix "verrouillé", comme les dérivations NISS/code postal existantes —
/// cf. docs/superpowers/plans/2026-07-07-pdf-bindings-canonical-ux-plan.md).
const ACCENTED_CHARS: Record<string, string> = {
  à: "a", â: "a", ä: "a",
  ç: "c",
  è: "e", é: "e", ê: "e", ë: "e",
  î: "i", ï: "i",
  ô: "o", ö: "o",
  ù: "u", û: "u", ü: "u",
  ÿ: "y",
};

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[àâäçèéêëîïôöùûüÿ]/g, (ch) => ACCENTED_CHARS[ch] ?? ch)
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Démonymes (masculin/féminin/pluriel) + nom de pays — UE 27 + Islande +
// Liechtenstein + Norvège (EEE) + Suisse. Écrits en clair (accents) : chaque
// entrée est normalisée à la construction du Set via `normalize`, la même
// fonction que pour le texte utilisateur.
const EEE_SUISSE_NAMES = [
  "belge", "belgique",
  "allemand", "allemande", "allemands", "allemandes", "allemagne",
  "autrichien", "autrichienne", "autrichiens", "autrichiennes", "autriche",
  "bulgare", "bulgares", "bulgarie",
  "chypriote", "chypriotes", "chypre",
  "croate", "croates", "croatie",
  "danois", "danoise", "danoises", "danemark",
  "espagnol", "espagnole", "espagnols", "espagnoles", "espagne",
  "estonien", "estonienne", "estoniens", "estoniennes", "estonie",
  "finlandais", "finlandaise", "finlandaises", "finlande",
  "français", "française", "françaises", "france",
  "grec", "grecque", "grecs", "grecques", "grèce",
  "hongrois", "hongroise", "hongroises", "hongrie",
  "irlandais", "irlandaise", "irlandaises", "irlande",
  "italien", "italienne", "italiens", "italiennes", "italie",
  "letton", "lettone", "lettons", "lettones", "lettonie",
  "lituanien", "lituanienne", "lituaniens", "lituaniennes", "lituanie",
  "luxembourgeois", "luxembourgeoise", "luxembourgeoises", "luxembourg",
  "maltais", "maltaise", "maltaises", "malte",
  "néerlandais", "néerlandaise", "néerlandaises",
  "hollandais", "hollandaise", "hollandaises", "pays-bas",
  "polonais", "polonaise", "polonaises", "pologne",
  "portugais", "portugaise", "portugaises", "portugal",
  "tchèque", "tchèques", "république tchèque", "tchéquie",
  "roumain", "roumaine", "roumains", "roumaines", "roumanie",
  "slovaque", "slovaques", "slovaquie",
  "slovène", "slovènes", "slovénie",
  "suédois", "suédoise", "suédoises", "suède",
  "islandais", "islandaise", "islandaises", "islande",
  "liechtensteinois", "liechtensteinoise", "liechtensteinoises", "liechtenstein",
  "norvégien", "norvégienne", "norvégiens", "norvégiennes", "norvège",
  "suisse", "suisses",
];

const EEE_SUISSE_SET = new Set(EEE_SUISSE_NAMES.map(normalize));

/// `true` si le texte (nom de pays ou démonyme, isolé ou noyé dans une phrase
/// libre) désigne la Belgique, un pays de l'EEE, ou la Suisse.
export function isEeeOrSuisseNationality(raw: string): boolean {
  const normalized = normalize(raw);
  if (!normalized) return false;
  if (EEE_SUISSE_SET.has(normalized)) return true;
  return normalized.split(" ").some((word) => EEE_SUISSE_SET.has(word));
}
