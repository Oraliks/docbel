/// Champs partagés entre PDFs d'un même bundle.
///
/// **Principe** : un champ marqué `prefillFrom: "profile.X"` ou `"itsme.X"` est
/// considéré comme un *champ canonique*. Quand l'utilisateur le saisit dans le
/// premier PDF du bundle, sa valeur est automatiquement propagée à tous les
/// PDFs suivants qui ont un champ avec la **même** source de prefill.
///
/// Avantages :
/// - Zéro nouveau schéma : on réutilise `prefillFrom` (déjà présent sur tous les champs).
/// - Cohérent avec le prefill profil/itsme : pour les visiteurs non connectés,
///   la chaîne de prefill (système → profil → itsme) reste valide, on ajoute juste
///   un cinquième niveau "valeurs déjà saisies dans le bundle".
/// - Le "champ canonique" est l'identifiant `prefillFrom` lui-même (e.g. "profile.niss").

import type { PrefillSource } from "@/lib/pdf-forms/types";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";

/// Map opaque : `prefillFrom` → valeur saisie (cross-document dans un bundle).
export type SharedBundleValues = Partial<Record<PrefillSource, string>>;

/// Extrait les valeurs canoniques (par `prefillFrom`) d'un payload validé,
/// en utilisant le schéma du PDF qui les a produites.
export function extractSharedValues(
  fields: PublicField[],
  payload: Record<string, unknown>
): SharedBundleValues {
  const out: SharedBundleValues = {};
  for (const f of fields) {
    if (!f.prefillFrom) continue;
    const raw = payload[f.id];
    if (raw === undefined || raw === null || raw === "") continue;
    if (typeof raw !== "string") continue; // on partage seulement les chaînes (NISS, IBAN, etc.)
    out[f.prefillFrom] = raw;
  }
  return out;
}

/// Fusionne plusieurs `SharedBundleValues` (ordre = priorité décroissante : la
/// première occurrence d'une clé l'emporte). Utile quand on agrège les
/// payloads de plusieurs documents déjà complétés.
export function mergeSharedValues(...maps: SharedBundleValues[]): SharedBundleValues {
  const out: SharedBundleValues = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m) as [PrefillSource, string][]) {
      if (out[k] === undefined && v !== undefined) out[k] = v;
    }
  }
  return out;
}

/// Construit un `FormPayload` partiel pour le PDF cible, en mappant les valeurs
/// partagées sur les champs qui ont le `prefillFrom` correspondant.
/// Ne renvoie que les champs effectivement résolus.
export function applySharedValuesToForm(
  targetFields: PublicField[],
  shared: SharedBundleValues
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of targetFields) {
    if (!f.prefillFrom) continue;
    const v = shared[f.prefillFrom];
    if (v !== undefined && v !== "") out[f.id] = v;
  }
  return out;
}
