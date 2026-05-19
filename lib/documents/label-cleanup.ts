/// Nettoyage déterministe des labels bruts retournés par l'OCR.
///
/// L'OCR récupère souvent des labels pollués par les "fillers" visuels du PDF :
/// `Prénom :_____`, `Numéro NISS (*) __ __ __`, `Date *: __/__/____`, etc.
///
/// Ce module fournit une fonction pure qui retire ces parasites sans IA :
/// c'est appliqué automatiquement à chaque détection, et ça fait gagner
/// l'essentiel des corrections manuelles avant même l'enrichissement IA.

/// Patterns "parenthèses bruit" à retirer (parenthèses contenant uniquement un
/// symbole/numéro qui ne porte pas de sens métier — typiquement un astérisque
/// de note de bas de page ou une numérotation auto).
const NOISE_PARENS_PATTERNS: RegExp[] = [
  /\(\s*[*/\\]+\s*\)/g, // (*), (/), (\)
  /\(\s*\d+\s*\)/g, // (1), (12)
  /\(\s*N[°o0]\.?\s*\)/gi, // (N°), (No), (N0)
  /\(\s*[•·]+\s*\)/g, // bullets seuls
];

/// Nettoie un label OCR de ses fillers et ponctuations parasites.
///
/// Stratégie :
/// 1. Retire les parenthèses "bruit" (astérisques de note, numérotation auto)
/// 2. Retire les runs d'underscores (≥ 2) qui sont des fillers de zone de saisie
/// 3. Retire les runs de points (≥ 3) idem
/// 4. Retire les astérisques isolés (marques "champ obligatoire" type "Nom *")
/// 5. Retire les barres `|` ou `/` isolées (séparateurs visuels)
/// 6. Strip de la ponctuation en début/fin
/// 7. Collapse des espaces multiples
///
/// Préserve volontairement les parenthèses contenant du texte réel
/// (ex. "Nom (national)" reste intact).
export function cleanOcrLabel(raw: string): string {
  if (!raw) return raw;
  let s = raw;

  for (const pattern of NOISE_PARENS_PATTERNS) {
    s = s.replace(pattern, " ");
  }

  // Runs d'underscores (≥ 2) → suppression (fillers visuels de zone de saisie)
  s = s.replace(/_{2,}/g, " ");

  // Runs de points (≥ 3) → suppression (style "..............")
  s = s.replace(/\.{3,}/g, " ");

  // Astérisques isolés (entourés d'espaces ou en début/fin) → suppression
  s = s.replace(/(^|\s)\*+(?=\s|[:.;,]|$)/g, "$1");

  // Barres `|` isolées (séparateurs visuels OCR)
  s = s.replace(/(^|\s)\|+(?=\s|$)/g, "$1");

  // Ponctuation en fin : `:`, `;`, `.`, `,`, `_`, `*`, `/`, `\`, espaces
  s = s.replace(/[.,;:_*/\\\s]+$/, "");

  // Ponctuation en début : `_`, `*`, espaces (préserve les accents/lettres)
  s = s.replace(/^[_*\s]+/, "");

  // Collapse des espaces multiples
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/// Applique le nettoyage à une liste de détections.
/// Retourne une nouvelle liste — ne mute pas l'entrée.
export function cleanDetectionsLabels<T extends { label: string }>(detections: T[]): T[] {
  return detections.map((d) => ({ ...d, label: cleanOcrLabel(d.label) }));
}
