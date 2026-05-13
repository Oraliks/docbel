/// Matching texte libre → bundles via tags vocabulaire.
///
/// L'utilisateur tape une phrase en langage courant (ex. "mon patron m'a dit
/// intempéries", "je perds mon emploi"). On veut suggérer les bundles
/// pertinents en se basant sur :
///   1. Le nom et la description du bundle
///   2. Les `vocabularyTags` (synonymes / termes courants saisis par l'admin)
///   3. Les noms des outils inclus dans le bundle
///
/// Ce matcher est local (pas d'IA) — rapide, déterministe, et sert de
/// fallback si l'endpoint AI d'intent-detection est désactivé.

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/// Retire les accents, met en minuscules, enlève la ponctuation.
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/// Mots vides (stopwords français) — exclus du matching pour réduire le bruit.
const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "d", "l",
  "et", "ou", "mais", "que", "qui", "quoi", "ce", "cet", "cette", "ces",
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "me", "te", "se", "ma", "mon", "mes", "ta", "ton", "tes", "sa", "son", "ses",
  "notre", "votre", "leur", "leurs",
  "en", "dans", "sur", "sous", "avec", "sans", "pour", "par",
  "a", "au", "aux", "y",
  "est", "etre", "ete", "suis", "es", "sommes", "etes", "sont",
  "ai", "as", "avons", "avez", "ont", "avoir", "eu",
  "fait", "faire", "fais", "font",
  "si", "alors", "plus", "moins",
  "pas", "ne", "non", "oui",
]);

/// Découpe et nettoie un texte en tokens significatifs.
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export interface BundleMatchInput {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  vocabularyTags?: string[];
  toolNames?: string[];
}

export interface BundleMatchScore {
  bundleId: string;
  slug: string;
  name: string;
  score: number;
  matchedTags: string[];
}

const WEIGHTS = {
  tagExact: 10, // un tag est intégralement présent dans la requête
  tagPartial: 5, // au moins 70 % des tokens du tag présents
  nameToken: 3,
  toolToken: 2,
  descToken: 1,
};

/// Calcule un score de matching entre une requête utilisateur et un bundle.
/// Score 0 = aucun match. Plus c'est haut, plus c'est pertinent.
export function scoreBundleMatch(query: string, bundle: BundleMatchInput): BundleMatchScore {
  const queryTokens = new Set(tokenize(query));
  const queryNormalized = normalizeText(query);
  const matchedTags: string[] = [];
  let score = 0;

  // Tags vocabulaire — match prioritaire
  for (const tag of bundle.vocabularyTags ?? []) {
    if (!tag) continue;
    const tagNormalized = normalizeText(tag);
    if (!tagNormalized) continue;
    // Match exact (le tag est une sous-chaîne de la requête, ou inverse pour
    // les mots courts)
    if (
      queryNormalized.includes(tagNormalized) ||
      (tagNormalized.length >= 4 && queryTokens.has(tagNormalized))
    ) {
      score += WEIGHTS.tagExact;
      matchedTags.push(tag);
      continue;
    }
    // Match partiel : ≥ 70 % des tokens du tag sont dans la requête
    const tagTokens = tokenize(tag);
    if (tagTokens.length === 0) continue;
    const overlap = tagTokens.filter((t) => queryTokens.has(t)).length;
    if (overlap / tagTokens.length >= 0.7) {
      score += WEIGHTS.tagPartial;
      matchedTags.push(tag);
    }
  }

  // Nom du bundle
  for (const t of tokenize(bundle.name)) {
    if (queryTokens.has(t)) score += WEIGHTS.nameToken;
  }

  // Description du bundle
  if (bundle.description) {
    for (const t of tokenize(bundle.description)) {
      if (queryTokens.has(t)) score += WEIGHTS.descToken;
    }
  }

  // Outils inclus dans le bundle
  for (const toolName of bundle.toolNames ?? []) {
    for (const t of tokenize(toolName)) {
      if (queryTokens.has(t)) score += WEIGHTS.toolToken;
    }
  }

  return {
    bundleId: bundle.id,
    slug: bundle.slug,
    name: bundle.name,
    score,
    matchedTags,
  };
}

/// Recherche les meilleurs bundles correspondant à une requête.
/// Retourne triés par score décroissant, score 0 exclu.
export function searchBundles(
  query: string,
  bundles: BundleMatchInput[],
  limit = 5
): BundleMatchScore[] {
  if (!query.trim() || bundles.length === 0) return [];
  return bundles
    .map((b) => scoreBundleMatch(query, b))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Validation à l'entrée (sécurise les données JSON venant de la base)
// ---------------------------------------------------------------------------

export function parseVocabularyTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const t of input) {
    if (typeof t === "string" && t.trim().length > 0) out.push(t.trim());
  }
  return out;
}
