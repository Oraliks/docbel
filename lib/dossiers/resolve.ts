// Résout les champs d'un document de dossier en specs concrètes, en piochant
// dans le catalogue pour les références canoniques.

import { CATALOG } from "@/lib/fields/catalog";
import type { FieldType, Localized, PrefillSource } from "@/lib/pdf-forms/types";
import type { DossierDocument, DossierFieldRef } from "./types";

export interface ResolvedField {
  key: string;
  pdfFieldName: string;
  type: FieldType;
  label: Localized;
  help?: Localized;
  prefillFrom?: PrefillSource;
  required: boolean;
  section?: string;
}

export function resolveFieldRef(ref: DossierFieldRef): ResolvedField {
  if ("custom" in ref) {
    return {
      key: ref.custom.key,
      pdfFieldName: ref.custom.pdfFieldName,
      type: ref.custom.type,
      label: ref.custom.label,
      required: ref.required ?? false,
      section: ref.section,
    };
  }
  const c = CATALOG[ref.field];
  return {
    key: c.key,
    pdfFieldName: ref.pdfFieldName ?? c.pdfFieldName,
    type: c.type,
    label: c.label,
    help: "help" in c ? c.help : undefined,
    prefillFrom: "prefillFrom" in c ? c.prefillFrom : undefined,
    required: ref.required ?? false,
    section: ref.section,
  };
}

export function resolveDocumentFields(doc: DossierDocument): ResolvedField[] {
  return doc.fields.map(resolveFieldRef);
}
