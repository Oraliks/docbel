// Métadonnées d'opposabilité d'une génération PDF (S7 de l'audit du
// 2026-08-01, décision n°1 : aucun fichier ni payload n'est stocké — seules
// ces deux valeurs non nominatives le sont).
//
// Module PUR : ni Prisma ni I/O, pour que la garantie « aucune donnée du
// citoyen ne part en base » soit vérifiable par des tests.

import { createHash } from "node:crypto";
import { stableDocumentKey } from "@/lib/bundles/document-identity";
import type { FillDiagnostic } from "./filler";

/// Forme minimale d'un champ — identique à celle de `stableDocumentKey`,
/// compatible `PdfFormField` comme `PublicField`.
interface FieldShape {
  id: string;
  type: string;
  prefillFrom?: string;
  label?: { fr?: string; nl?: string; de?: string };
  autoAnswered?: boolean;
  hidden?: boolean;
}

/// Empreinte du CONTENU MÉTIER d'un document généré.
///
/// À la différence de `payloadHash` (sha du payload brut), celle-ci ne bouge
/// pas d'un jour à l'autre : `stableDocumentKey` écarte les champs « auto »
/// (`isAutoField` = signature, date de création, `autoAnswered`) et les
/// valeurs vides, et trie les clés. Or ce sont EXACTEMENT les champs
/// qu'`applyServerAutoFields` injecte juste avant la génération — on peut donc
/// hacher le payload final, celui réellement imprimé, sans que la date du
/// téléchargement n'entre dans l'empreinte.
///
/// C'est ce qui rend la décision n°5 tenable : le PDF régénéré porte bien la
/// date du jour où on le retélécharge (voulu), et cette empreinte établit
/// malgré tout qu'il s'agit du même document au sens métier.
export function stablePayloadHashOf(
  payload: Record<string, unknown>,
  fields: FieldShape[],
): string {
  return createHash("sha256").update(stableDocumentKey(payload, fields)).digest("hex");
}

/// Résumé non nominatif du remplissage, tel que persisté.
export interface DiagnosticsSummary {
  count: number;
  /// Nombre d'anomalies par `FillDiagnostic["kind"]`.
  kinds: Record<string, number>;
}

/// Réduit les diagnostics du filler à un décompte par type.
///
/// Ne retient QUE `kind` : `detail` porte les caractères saisis par le citoyen
/// (nom hors alphabet latin non rendu, message d'erreur de stamping), et
/// `fieldId`/`widget` désignent nommément la rubrique en défaut sans rien
/// apporter à une statistique. Un tableau vide donne `{ count: 0 }` et non
/// `null` : l'absence d'anomalie doit être AFFIRMÉE — c'est elle qui prouve
/// qu'aucune case n'est restée blanche sur le document officiel.
export function buildDiagnosticsSummary(diagnostics: FillDiagnostic[]): DiagnosticsSummary {
  const kinds: Record<string, number> = {};
  for (const d of diagnostics) {
    kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;
  }
  return { count: diagnostics.length, kinds };
}
