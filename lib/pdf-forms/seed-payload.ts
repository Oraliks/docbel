import { PdfFormField, FormPayload } from "./types";

/// Exemples valides par type sémantique (checksums corrects) pour les tests
/// de génération et la prévisualisation admin.
const SAMPLES: Record<string, string> = {
  niss: "85073003328", // checksum valide
  iban: "BE68539007547034", // checksum valide
  postal_be: "1000",
  tva_be: "BE0123456749",
  bce: "0123456749",
  phone_be: "+32470123456",
  email: "exemple@beldoc.be",
  date: new Date().toISOString().slice(0, 10),
};

/// Génère un payload de test cohérent pour un schéma donné.
/// Déterministe → exploitable pour les tests golden-file.
export function generateSeedPayload(fields: PdfFormField[]): FormPayload {
  const payload: FormPayload = {};
  for (const f of fields) {
    switch (f.type) {
      case "checkbox":
        payload[f.id] = true;
        break;
      case "number":
        payload[f.id] = typeof f.min === "number" ? f.min : 42;
        break;
      case "select":
      case "radio":
        payload[f.id] = f.options?.[0]?.value ?? "";
        break;
      default:
        payload[f.id] = SAMPLES[f.type] ?? `Exemple ${f.id}`.slice(0, f.maxLength ?? 80);
    }
  }
  return payload;
}
