// Extraction / injection canonique — Phase 2 du plan pdf-bindings-canonical-ux.
//
// Deux fonctions pures :
//   - `extractCanonical(fields, payload)` : lit les valeurs des champs
//     porteurs d'un `canonicalKey` dans un payload validé, produit une map
//     canonique { "identity.nom": "Dupont", "banque.iban": "BE68…", … }.
//   - `canonicalToPrefill(fields, canonical)` : dans l'AUTRE sens, applique
//     la map canonique aux ids des champs CIBLE (formulaire compagnon)
//     qui portent la même `canonicalKey`.
//
// Aucun accès DB / fs ici : ces fonctions sont utilisables côté client
// (form-runner, wizard) et côté serveur (route generate / prefill helpers).
//
// Choix de scope :
//   - On ne canonise que les valeurs SCALAIRES (string). Les `checkbox`
//     (boolean) et `array` (records) ne sont pas concernés — leur sémantique
//     est trop dépendante du formulaire pour être partagée sereinement.
//   - Une valeur canonique VIDE ("", "   ") est ignorée : on ne polluerait
//     que le sous-formulaire avec un « vider ce champ » qui n'apporte rien.

import type { FormPayload, PdfFormField } from "../types";
import type { PublicField } from "../public-serializer";
import { isCanonicalKey, type CanonicalKey } from "./vocabulary";

/// Payload validé côté form-runner (les valeurs peuvent être string, number,
/// boolean, null ou fullname). Ne dépend pas de FormPayload car on veut
/// aussi pouvoir extraire depuis un draft (types plus lâches).
type PayloadLike = Record<string, unknown>;

/// Forme minimale exploitée par l'extracteur — commune à `PdfFormField` et
/// `PublicField`. On extrait canonicalKey + id + type.
type FieldLike = {
  id: string;
  type: PdfFormField["type"] | PublicField["type"];
  canonicalKey?: string;
};

/// Extrait les valeurs canoniques d'un payload validé, en lisant les
/// champs porteurs d'un `canonicalKey`. Idempotent : appeler deux fois
/// avec les mêmes arguments produit strictement la même map.
///
/// Cas particulier `fullname` : une valeur `{ first, last }` PEUT être
/// extraite si le champ porte un `canonicalKey` (rare — les seeds tagués
/// ce sont des champs texte simples). On concatène en `"first last"` pour
/// donner quelque chose de textuellement utilisable — un consommateur qui
/// s'attend à identity.nom en pur nom ne verra que du bruit si on lui
/// injecte du « Prénom Nom ». Aujourd'hui aucun seed ne tague un fullname
/// avec canonicalKey → cas essentiellement inaccessible, safe fallback.
export function extractCanonical<F extends FieldLike>(
  fields: readonly F[],
  payload: PayloadLike
): Partial<Record<CanonicalKey, string>> {
  const out: Partial<Record<CanonicalKey, string>> = {};
  for (const f of fields) {
    const key = f.canonicalKey;
    if (!key || !isCanonicalKey(key)) continue;
    const raw = payload[f.id];
    if (raw === null || raw === undefined) continue;
    let text: string | null = null;
    if (typeof raw === "string") text = raw;
    else if (typeof raw === "number" || typeof raw === "boolean") text = String(raw);
    else if (
      typeof raw === "object" &&
      raw !== null &&
      !Array.isArray(raw) &&
      ("first" in raw || "last" in raw)
    ) {
      const first = ((raw as Record<string, unknown>).first ?? "") as string;
      const last = ((raw as Record<string, unknown>).last ?? "") as string;
      const joined = [first, last].map((s) => s.trim()).filter(Boolean).join(" ");
      text = joined || null;
    }
    if (text === null) continue;
    const trimmed = text.trim();
    if (trimmed === "") continue;
    out[key] = trimmed;
  }
  return out;
}

/// Applique une map canonique aux champs d'un formulaire CIBLE : renvoie une
/// map `fieldId → valeur` pour chaque champ dont la `canonicalKey` est
/// présente dans la map d'entrée. Sert de source de pré-remplissage
/// cross-document (le C1 remplit la map, le C1A la consomme). Renvoie un
/// objet vide si aucun champ cible ne match.
export function canonicalToPrefill<F extends FieldLike>(
  targetFields: readonly F[],
  canonical: Partial<Record<CanonicalKey, string>>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of targetFields) {
    const key = f.canonicalKey;
    if (!key || !isCanonicalKey(key)) continue;
    const v = canonical[key];
    if (v === undefined || v === "") continue;
    out[f.id] = v;
  }
  return out;
}

/// Fusionne plusieurs cartes canoniques : la PREMIÈRE occurrence d'une clé
/// gagne (ordre = priorité décroissante). Utile pour agréger les valeurs
/// canoniques extraites de plusieurs PDFs déjà complétés dans un run —
/// le PDF le plus récent (fourni en premier dans la liste) prime.
export function mergeCanonical(
  ...maps: Array<Partial<Record<CanonicalKey, string>>>
): Partial<Record<CanonicalKey, string>> {
  const out: Partial<Record<CanonicalKey, string>> = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m) as [CanonicalKey, string][]) {
      if (out[k] === undefined && v) out[k] = v;
    }
  }
  return out;
}

/// Extraction "par lot" : plusieurs paires (fields, payload) → map canonique
/// fusionnée. Ordre = priorité (le premier prime).
export function extractCanonicalFromMany<F extends FieldLike>(
  pairs: Array<{ fields: readonly F[]; payload: PayloadLike }>
): Partial<Record<CanonicalKey, string>> {
  return mergeCanonical(...pairs.map((p) => extractCanonical(p.fields, p.payload)));
}

export type { PayloadLike };
export type CanonicalMap = Partial<Record<CanonicalKey, string>>;

// Re-export volontairement absent : le type utilisé côté client est
// `FormPayload` ; le `PayloadLike` interne du module reste privé.
export { type FormPayload };
