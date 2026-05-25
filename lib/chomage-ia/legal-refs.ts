/**
 * Détection naïve de références à des sources légales belges dans un texte.
 *
 * Sert au feature "source manquante" du chat : on parse les réponses Claude
 * pour repérer des mentions de lois / AR / arrêtés / circulaires / articles
 * qui ne sont pas dans la KB, et on propose à l'admin de les uploader.
 *
 * Limites connues (acceptables pour MVP, à raffiner si besoin) :
 *   - Faux positifs possibles : "art. 5" sans contexte légal réel.
 *   - Faux négatifs : pas de support des dates en lettres ("loi du vingt-six décembre…").
 *   - Pas de gestion de l'orthographe néerlandaise (KB belge = surtout FR pour l'admin).
 *   - On dédoublonne case-insensitive après normalisation des espaces.
 */

/**
 * Patterns FR typiques de la réglementation belge sur le chômage.
 * Chaque pattern produit une référence "canonique" qu'on cherchera ensuite
 * dans les titres/contents/tags de la KB.
 */
const PATTERNS: RegExp[] = [
  // Loi du JJ Mois AAAA / Loi du JJ/MM/AAAA
  /\bloi\s+du\s+(?:\d{1,2}(?:er)?\s+(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+\d{4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/gi,
  // Arrêté royal / AR du …
  /\b(?:arr[êe]t[ée]\s+royal|a\.?\s*r\.?)\s+du\s+(?:\d{1,2}(?:er)?\s+(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+\d{4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/gi,
  // Arrêté ministériel / AM du …
  /\b(?:arr[êe]t[ée]\s+minist[ée]riel|a\.?\s*m\.?)\s+du\s+(?:\d{1,2}(?:er)?\s+(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+\d{4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/gi,
  // Article XX (avec ou sans § / alinéa) — au minimum "art. NN"
  /\bart(?:icle|\.)?\s*\d{1,4}(?:[a-z])?(?:\s*[,§§]\s*\d+)?(?:\s*,\s*al(?:in[ée]a|\.)?\s*\d+)?/gi,
  // Circulaire / instruction ONEM no XXX/YYYY
  /\b(?:circulaire|instruction)\s+(?:onem\s+)?(?:n[°o]\.?\s*)?[a-z]?\d{1,4}(?:\/\d{2,4})?/gi,
  // CIR92, CIR 92, CIR/92
  /\bcir\s*\/?\s*92\b/gi,
  // Code judiciaire / Code pénal / Code civil (générique)
  /\bcode\s+(?:judiciaire|p[ée]nal|civil|du\s+travail|de\s+la\s+s[ée]curit[ée]\s+sociale)\b/gi,
  // Moniteur belge du JJ Mois AAAA
  /\bmoniteur\s+belge\s+du\s+(?:\d{1,2}\s+(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+\d{4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/gi,
];

/**
 * Normalise un texte pour comparaison case-insensitive et tolérance accents/espaces.
 * Utilisé pour dédoublonner et pour faire le lookup dans la KB.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrait toutes les références légales détectées dans `text`.
 * Retourne la liste dédupliquée (sur clé normalisée), dans l'ordre d'apparition,
 * en conservant la forme originale pour l'affichage.
 *
 * Limité à 20 références max pour éviter de remplir un message massif.
 */
export function extractLegalReferences(text: string): string[] {
  if (!text || text.length === 0) return [];

  const found: Array<{ key: string; raw: string }> = [];
  const seen = new Set<string>();

  for (const re of PATTERNS) {
    // Reset lastIndex pour les regex avec flag /g qui sont partagées entre appels.
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = m[0].trim().replace(/\s+/g, " ");
      const key = normalize(raw);
      if (key.length < 5) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ key, raw });
      if (found.length >= 20) break;
    }
    if (found.length >= 20) break;
  }

  return found.map((f) => f.raw);
}

/**
 * Compare une liste de références extraites d'une réponse IA à un corpus
 * (titres + contents + tags des sources existantes) et renvoie celles qui
 * n'ont AUCUN match insensitive.
 *
 * Match = la référence normalisée apparaît dans au moins un des champs
 * normalisés du corpus. C'est volontairement large pour éviter de proposer
 * d'uploader une source déjà présente (faux positif gênant pour l'admin).
 *
 * Retourne au plus `maxResults` items (défaut 3) — on ne veut pas noyer
 * l'utilisateur sous des suggestions.
 */
export function findMissingInKb(
  refs: string[],
  existingTitles: string[],
  existingContents: string[],
  existingTags: string[] = [],
  maxResults = 3
): string[] {
  if (refs.length === 0) return [];

  // Pré-normalise le corpus une seule fois (évite N normalisations par ref).
  const corpus: string[] = [];
  for (const t of existingTitles) corpus.push(normalize(t));
  for (const c of existingContents) corpus.push(normalize(c));
  for (const tag of existingTags) corpus.push(normalize(tag));

  // On garde aussi une version concaténée pour les références multi-mots
  // qui pourraient s'éparpiller sur deux champs (rare mais possible).
  const corpusJoined = corpus.join(" \n ");

  const missing: string[] = [];
  for (const ref of refs) {
    const key = normalize(ref);
    // Tolérance : on accepte un match si la référence normalisée apparaît
    // entière dans un champ du corpus.
    const found = corpus.some((c) => c.includes(key)) ||
      corpusJoined.includes(key);
    if (!found) {
      missing.push(ref);
      if (missing.length >= maxResults) break;
    }
  }
  return missing;
}
