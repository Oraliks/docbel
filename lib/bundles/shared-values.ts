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
import { extractCanonical, mergeCanonical, type CanonicalMap } from "@/lib/pdf-forms/canonical/extract";

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

/// Construit, à partir des documents DÉJÀ COMPLÉTÉS d'un bundle (hors le
/// document courant), les valeurs partagées par `prefillFrom` ET par
/// `canonicalKey` — les deux mécanismes de prefill cross-document (cf.
/// extractSharedValues / extractCanonical). `items` DOIT déjà être trié par
/// `order` croissant côté appelant (requête Prisma `orderBy: { order: "asc" }`,
/// cf. `loadDossierState`) : `mergeSharedValues`/`mergeCanonical` font gagner
/// la PREMIÈRE occurrence d'une clé, donc sans ce tri en amont, le document
/// qui l'emporte en cas de doublon dépend de l'ordre de retour — non garanti
/// — de la base plutôt que de la position déclarée du document dans le
/// bundle (S3 de l'audit du 2026-08-01).
export function buildBundleSharedMaps(
  items: readonly { pdfForm: { id: string; fields: PublicField[] } | null }[],
  currentFormId: string,
  payloads: Record<string, Record<string, unknown> | undefined>
): { shared: SharedBundleValues; canonical: CanonicalMap } {
  const sharedMaps: SharedBundleValues[] = [];
  const canonicalMaps: CanonicalMap[] = [];
  for (const item of items) {
    if (!item.pdfForm || item.pdfForm.id === currentFormId) continue;
    const payload = payloads[item.pdfForm.id];
    if (!payload) continue;
    sharedMaps.push(extractSharedValues(item.pdfForm.fields, payload));
    canonicalMaps.push(extractCanonical(item.pdfForm.fields, payload));
  }
  return {
    shared: mergeSharedValues(...sharedMaps),
    canonical: mergeCanonical(...canonicalMaps),
  };
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
