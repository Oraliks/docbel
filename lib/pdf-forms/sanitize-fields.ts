import { PdfFormField } from "./types";

/// Nettoie un tableau de champs reçu d'un client (éditeur admin) avant
/// persistance ou génération.
///
/// On ne garde que les champs structurellement valides : un `id` stable
/// (slug du schéma enrichi) et un `type` sémantique.
///
/// ATTENTION : `pdfFieldName` PEUT être vide. La définition de `PdfFormField`
/// documente explicitement qu'un champ « purement logique » n'a pas d'ancre
/// AcroForm. L'ancienne implémentation exigeait `f.pdfFieldName` truthy, ce qui
/// supprimait silencieusement ces champs à chaque enregistrement : le PATCH
/// répondait 200 mais le schéma persisté avait perdu le champ, qui disparaissait
/// alors côté front.
export function sanitizeFields(fields: unknown): PdfFormField[] {
  if (!Array.isArray(fields)) return [];
  return (fields as PdfFormField[]).filter(
    (f) =>
      !!f &&
      typeof f.id === "string" &&
      f.id.length > 0 &&
      typeof f.type === "string" &&
      (f.type as string).length > 0
  );
}
