// Fixtures de test par formulaire — Feature #8 des ameliorations post-plan
// bindings-canonical-ux.
//
// Un fixture = un scenario de test reproductible (nom, payload). Persiste
// dans `PdfForm.testFixtures` (Json[]). L'admin peut generer un PDF de
// test avec un fixture donne sans re-taper les 20+ champs.

import type { FormPayload } from "./types";

export interface TestFixture {
  /// Identifiant stable (uuid ou slug) — genere cote client au create,
  /// jamais reutilise apres suppression pour eviter les collisions
  /// d'historique.
  id: string;
  /// Nom lisible affiche dans la liste admin. Obligatoire.
  name: string;
  /// Description libre (contexte, source des donnees, etc.). Optionnel.
  description?: string;
  /// Payload complet compatible avec le schema du form. Serialise en Json.
  payload: FormPayload;
  /// Timestamps ISO — poses cote serveur au PATCH.
  createdAt?: string;
  updatedAt?: string;
}

/// Parse defensif de la colonne `testFixtures` — ignore silencieusement les
/// entrees mal formees plutot que de casser l'admin. Renvoie toujours un
/// tableau (peut-etre vide).
export function parseTestFixtures(raw: unknown): TestFixture[] {
  if (!Array.isArray(raw)) return [];
  const out: TestFixture[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string") continue;
    if (!o.payload || typeof o.payload !== "object") continue;
    out.push({
      id: o.id,
      name: o.name,
      description: typeof o.description === "string" ? o.description : undefined,
      payload: o.payload as FormPayload,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : undefined,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
    });
  }
  return out;
}
