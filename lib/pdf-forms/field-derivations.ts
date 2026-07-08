import type { FieldDerivation, FieldValue, FormPayload } from "./types";
import { deriveBirthDateFromNiss } from "./niss-birthdate";
import { isEeeOrSuisseNationality } from "./nationalite-eee";

/// Registre des fonctions de dérivation, indexé par `FieldDerivation`.
/// Chaque fonction prend la valeur COURANTE du champ source et renvoie la
/// valeur dérivée (string) si elle peut être calculée, sinon `null` — auquel
/// cas le champ cible reste normalement éditable (cf. `derivedFrom` dans
/// types.ts). Module volontairement minimal (aucun import lourd) : le runner
/// (composant client partagé par tous les dossiers) l'importe directement.
export const FIELD_DERIVATIONS: Record<FieldDerivation, (sourceValue: FieldValue) => string | null> = {
  "niss-birth-date": (sourceValue) => {
    if (typeof sourceValue !== "string") return null;
    const result = deriveBirthDateFromNiss(sourceValue);
    return result?.iso ?? null;
  },
  /// Codes postaux belges = strictement 4 chiffres (1000–9999). France, Espagne,
  /// Italie, Allemagne… = 5 chiffres ; Pays-Bas = 4 chiffres + 2 lettres ; UK
  /// = alphanumérique. Un 4-chiffres nu suffit donc à identifier une adresse
  /// belge sans base tierce. Pour les adresses étrangères, la dérivation renvoie
  /// `null` → le champ pays reste éditable (l'utilisateur tape/choisit lui-même).
  "postal-be-country": (sourceValue) => {
    if (typeof sourceValue !== "string") return null;
    return /^\d{4}$/.test(sourceValue.trim()) ? "Belgique" : null;
  },
  /// Nationalité (texte libre, ex. « Belge ») → statut « hors EEE et hors
  /// Suisse » (C1, section 27). Vide/non-string = rien à dériver, le champ
  /// reste éditable ; sinon "non" si un pays EEE/Suisse est reconnu (cf.
  /// nationalite-eee.ts), "oui" sinon — y compris nationalité non reconnue
  /// (choix assumé, cf. commentaire d'en-tête de nationalite-eee.ts).
  "nationalite-hors-eee": (sourceValue) => {
    if (typeof sourceValue !== "string") return null;
    const trimmed = sourceValue.trim();
    if (!trimmed) return null;
    return isEeeOrSuisseNationality(trimmed) ? "non" : "oui";
  },
};

/// Forme minimale acceptée — couvre PdfFormField (serveur) ET PublicField
/// (client) sans cast.
interface DerivableFieldShape {
  id: string;
  derivedFrom?: { fieldId: string; via: FieldDerivation };
}

/// À appeler sur le payload juste avant l'envoi au serveur (génération PDF),
/// jamais sur le state React live du formulaire (cf. lib/pdf-forms/
/// c1-motif-transfer.ts, même principe). Pour chaque champ dont la source
/// produit ACTUELLEMENT une valeur dérivée, écrase la valeur soumise —
/// garantit que ce qui est envoyé correspond à ce qui était affiché
/// (verrouillé) à l'écran, même si `values` gardait une saisie manuelle
/// antérieure à la validation du champ source. No-op si aucun champ du
/// formulaire n'a de `derivedFrom`.
export function applyFieldDerivations(values: FormPayload, fields: DerivableFieldShape[]): FormPayload {
  let out = values;
  for (const f of fields) {
    if (!f.derivedFrom) continue;
    const derived = FIELD_DERIVATIONS[f.derivedFrom.via](values[f.derivedFrom.fieldId] ?? "");
    if (derived !== null && out[f.id] !== derived) {
      if (out === values) out = { ...values };
      out[f.id] = derived;
    }
  }
  return out;
}
