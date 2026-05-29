import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFRef,
  PDFDict,
  PDFString,
  PDFHexString,
} from "pdf-lib";

/// Supprime les widgets orphelins d'une page dont le `/T` matche un nom fourni.
///
/// Contexte : `form.removeField(name)` détache le PDFField de l'AcroForm
/// (`/Fields`), mais les annotations widget restent rattachées à la page via
/// `/Annots`. Si on recrée un champ du même nom plus tard sans nettoyer, on
/// finit avec des widgets fantômes affichés sans être adressables.
///
/// Stratégie : on parcourt `page.node.Annots()`, on filtre celles dont
/// `/Subtype = /Widget` ET dont `/T` (ou `/T` du parent) est dans
/// `namesToRemove`, et on remplace l'array `/Annots` par la version filtrée.
export function cleanupOrphanWidgets(doc: PDFDocument, namesToRemove: string[]): void {
  if (namesToRemove.length === 0) return;
  const wanted = new Set(namesToRemove);

  for (const page of doc.getPages()) {
    const annotsRaw = page.node.Annots();
    if (!annotsRaw) continue;
    const annots: PDFArray = annotsRaw instanceof PDFArray
      ? annotsRaw
      : (() => {
          const resolved = doc.context.lookup(annotsRaw);
          return resolved instanceof PDFArray ? resolved : null;
        })()!;
    if (!(annots instanceof PDFArray)) continue;

    const keep: (PDFRef | PDFDict)[] = [];
    const size = annots.size();
    for (let i = 0; i < size; i += 1) {
      const entry = annots.get(i);
      const dict = entry instanceof PDFRef ? doc.context.lookup(entry) : entry;
      if (!(dict instanceof PDFDict)) {
        keep.push(entry as PDFRef | PDFDict);
        continue;
      }
      if (!isWidget(dict)) {
        keep.push(entry as PDFRef | PDFDict);
        continue;
      }
      const name = readFieldName(dict, doc);
      if (name && wanted.has(name)) {
        continue; // drop this orphan widget
      }
      keep.push(entry as PDFRef | PDFDict);
    }
    if (keep.length === size) continue;

    const next = doc.context.obj(keep) as PDFArray;
    page.node.set(PDFName.of("Annots"), next);
  }
}

function isWidget(dict: PDFDict): boolean {
  const sub = dict.get(PDFName.of("Subtype"));
  if (!(sub instanceof PDFName)) return false;
  return sub === PDFName.of("Widget");
}

/// Lit /T sur le widget, puis remonte la hiérarchie /Parent si nécessaire.
/// pdf-lib peut stocker /T sur le field-parent et laisser le widget terminal
/// sans /T (cas standard).
function readFieldName(dict: PDFDict, doc: PDFDocument): string | null {
  let current: PDFDict | undefined = dict;
  let guard = 0;
  while (current && guard < 8) {
    const t = current.get(PDFName.of("T"));
    if (t instanceof PDFString || t instanceof PDFHexString) {
      return t.decodeText();
    }
    const parentRaw: unknown = current.get(PDFName.of("Parent"));
    if (parentRaw instanceof PDFRef) {
      const resolved: unknown = doc.context.lookup(parentRaw);
      current = resolved instanceof PDFDict ? resolved : undefined;
    } else if (parentRaw instanceof PDFDict) {
      current = parentRaw;
    } else {
      current = undefined;
    }
    guard += 1;
  }
  return null;
}
