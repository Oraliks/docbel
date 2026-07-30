// Fusion « champs déjà en base » + « schéma enrichi du seed », partagée par les
// formulaires compagnons.
//
// Chaque seed en avait sa propre copie, et TROIS d'entre elles divergeaient :
// `c1-regis`, `c46` et `c47` ne dédoublonnaient que par `id`, les autres aussi
// par `pdfFieldName`. Conséquence : sur ces trois-là, un champ auto-inféré à
// l'import survivait à côté de sa version enrichie dès que l'inférence lui
// avait donné un id différent (`makeId` slugifie le nom du widget, il ne
// produit pas le camelCase du seed) — deux champs pour un même widget, l'un au
// libellé propre, l'autre au libellé brut du PDF.
//
// Le C1 principal garde SA fonction : elle fait davantage (profil de motif
// restreint, curation par regex, élagage des champs cachés dont le widget a
// disparu du PDF courant). L'unifier ici ferait de ce module un fourre-tout.

import type { PdfFormField } from "../types";

/// Noms de widgets couverts par le schéma enrichi. Gère la convention pipe
/// (`"oui_2|non_2"`) : chaque segment compte comme couvert.
///
/// `lineTargets` compte AUSSI : un `textarea` unique replié sur les N lignes
/// pointillées du papier (cf. `PdfFormField.lineTargets`) écrit bien dans ces
/// widgets, même si son propre `pdfFieldName` est vide. Sans ça, un champ
/// hérité de la base pointant sur l'une de ces lignes survivait au merge et se
/// battait avec le textarea pour la même case.
function coveredWidgetNames(enriched: readonly PdfFormField[]): Set<string> {
  const names = new Set<string>();
  const add = (raw: string | undefined) => {
    if (!raw) return;
    for (const part of raw.split("|")) {
      const trimmed = part.trim();
      if (trimmed) names.add(trimmed);
    }
  };
  for (const field of enriched) {
    add(field.pdfFieldName);
    for (const cible of field.lineTargets ?? []) add(cible.pdfFieldName);
  }
  return names;
}

/// Applique le schéma enrichi sur les champs existants. Idempotent.
///
/// Un champ existant est ÉCARTÉ quand :
///   • son `id` est redéfini par le seed ;
///   • son `pdfFieldName` est désormais couvert par un champ du seed (même
///     sous un autre id) ;
///   • son `id` figure dans `legacyIds` — champs d'une version antérieure dont
///     le widget est maintenant écrit par une RÈGLE serveur. L'overlay ne peut
///     pas les détecter seul : leur widget n'est plus couvert par aucun champ,
///     donc ils survivraient et se battraient avec la règle.
export function mergeEnrichedFields(
  current: readonly PdfFormField[],
  enriched: readonly PdfFormField[],
  legacyIds: ReadonlySet<string> = new Set(),
): PdfFormField[] {
  const covered = coveredWidgetNames(enriched);
  const newIds = new Set(enriched.map((f) => f.id));

  const preserved = current.filter((f) => {
    if (legacyIds.has(f.id)) return false;
    if (newIds.has(f.id)) return false;
    if (f.pdfFieldName && covered.has(f.pdfFieldName)) return false;
    return true;
  });

  return [...preserved, ...enriched];
}
