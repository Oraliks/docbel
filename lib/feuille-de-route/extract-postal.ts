// Trouve le code postal belge du citoyen dans les payloads d'un run :
// d'abord la clé canonique adresse.codePostal (posée sur le C1 —
// lib/pdf-forms/seed/c1/identite.ts), puis l'id de champ historique
// `code_postal` en repli (spec). Renvoie null si rien d'exploitable —
// le consommateur bascule alors la feuille en mode générique.

import { extractCanonical } from "@/lib/pdf-forms/canonical/extract";
import type { PdfFormField } from "@/lib/pdf-forms/types";

const CP_BELGE = /^\d{4}$/;

export function postalCodeFromPayloads(
  pairs: Array<{ fields: PdfFormField[]; payload: Record<string, unknown> }>,
): string | null {
  for (const { fields, payload } of pairs) {
    const canonical = extractCanonical(fields, payload);
    const candidats = [
      canonical["adresse.codePostal"],
      typeof payload["code_postal"] === "string" ? (payload["code_postal"] as string) : null,
    ];
    for (const brut of candidats) {
      const cp = brut?.trim() ?? "";
      if (CP_BELGE.test(cp)) return cp;
    }
  }
  return null;
}
