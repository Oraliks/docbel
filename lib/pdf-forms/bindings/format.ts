// Formatage partagé pour le stamping des widgets AcroForm.
//
// Extrait de `filler.ts` pour que le moteur de bindings (module PUR, aucun
// import fs/prisma) puisse l'utiliser sans créer d'import croisé.
// `filler.ts` continue de l'importer d'ici — c'est la même fonction, plus une
// seule source de vérité.

/// Reformate une date ISO (YYYY-MM-DD) vers le format FR (DD/MM/YYYY) utilisé
/// sur les formulaires officiels ONEM. Toute autre valeur est renvoyée telle
/// quelle (idempotent : sûr si l'utilisateur a déjà saisi en format FR, ou
/// si la valeur est vide).
export function formatDateFR(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/// Répartit un texte sur les lignes SUCCESSIVES d'un même bloc du PDF (les
/// zones « Remarques » du C1 sont deux widgets distincts qui, à l'impression,
/// forment une seule boîte de deux lignes).
///
/// Coupe aux espaces ; un mot plus long qu'une ligne n'est jamais tronqué au
/// milieu. Le reliquat va TOUJOURS sur la dernière ligne : sur un document
/// officiel, un débordement visuel vaut mieux qu'une remarque silencieusement
/// amputée. Renvoie moins d'entrées que de lignes quand le texte tient : les
/// widgets restants ne sont alors pas stampés.
///
/// `maxCharsPerLine` est un budget approximatif en caractères, dérivé de la
/// largeur du widget (≈ largeur / 5,3 pt par caractère à 10 pt en Helvetica).
export function wrapAcrossLines(
  text: string,
  maxCharsPerLine: readonly number[],
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || maxCharsPerLine.length === 0) return [];

  const lines: string[] = [];
  let i = 0;
  for (let line = 0; line < maxCharsPerLine.length && i < words.length; line++) {
    if (line === maxCharsPerLine.length - 1) {
      lines.push(words.slice(i).join(" "));
      break;
    }
    let current = "";
    while (i < words.length) {
      const candidate = current ? `${current} ${words[i]}` : words[i];
      // `current &&` : un mot seul plus long que la ligne y est quand même
      // placé, sinon on bouclerait sans jamais avancer.
      if (current && candidate.length > maxCharsPerLine[line]) break;
      current = candidate;
      i++;
    }
    lines.push(current);
  }
  return lines.filter((line) => line.length > 0);
}
