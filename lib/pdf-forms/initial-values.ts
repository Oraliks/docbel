// Valeurs initiales du form-runner — logique PURE, extraite de
// `components/pdf-forms/pdf-form-runner.tsx` (où elle vivait en fonctions
// privées d'un composant client).
//
// Pourquoi la sortir : c'est le PREMIER maillon de la chaîne qui mène une
// valeur pré-remplie jusqu'au papier (`buildInitialValues` → soumission →
// `buildValidator` → `fillForm` → widget). Tant qu'elle était enfermée dans le
// composant, tout raisonnement sur « ce champ n'est plus à l'écran, sa valeur
// part-elle quand même ? » devait la RECOPIER pour être testé — et une copie
// finit toujours par diverger de l'original. `dossier-inheritance.ts` s'en sert
// pour décider quels champs masquer : masquer et remplir deviennent alors deux
// lectures de la MÊME fonction, pas deux règles à tenir d'accord.
//
// Aucune dépendance React : importable côté serveur (page dossier) comme côté
// client (runner), et testable seule.
//
// `isValueShapeUsable` / `sanitizeStoredPayload` (2026-07-30) : une valeur
// ENREGISTRÉE (brouillon serveur `BundleRun.draftPayloads`, brouillon local
// `PdfFormDraft`) peut avoir été écrite sous un ANCIEN schéma — un champ garde
// son `id` mais change de `type` (ex. Q5 du C1A, `descriptionAide1` : `array`
// → `textarea`, commit `1f36623`). Sans garde, cette valeur traverse telle
// quelle jusqu'au rendu : `<Textarea value={valeur} />` la fait passer par la
// conversion implicite de React, et `[{ description: "…" }].toString()` vaut
// littéralement `"[object Object]"` — c'est ce que voit le citoyen. Le
// mécanisme `LEGACY_C1A_FIELD_IDS` ne couvre PAS ce cas : il purge un `id` qui
// DISPARAÎT du schéma, jamais un `id` qui RESTE avec un type différent. Le
// garde-fou ici est générique PAR TYPE de champ, pas par id ni par
// formulaire : il protège les 8 formulaires du catalogue, et n'importe quel
// futur changement de type sur un id conservé — pas seulement Q5.

import {
  isFullNameValue,
  isFieldValueRecordArray,
  type FieldValue,
  type FieldType,
  type FormPayload,
} from "./types";
import type { PublicField } from "./public-serializer";
import type { PrefillMap } from "./canonical/extract";
import { isCreationDateField, isSignatureField } from "./auto-fields";
import { bicFromForeignIban } from "./bic-lookup";
import { todayISO } from "./system-values";

/// Aligne le BIC sur l'IBAN quand la table locale reconnaît la banque.
///
/// Le BIC déduit ÉCRASE une valeur existante (Oraliks 2026-07-26). Avant, un
/// BIC non vide bloquait la déduction : un brouillon restauré avec un IBAN
/// reconnu (BIC déduit « X ») et un BIC « Y » saisi à une session précédente
/// affichait « X » VERROUILLÉ à l'écran — le panneau de paiement rend
/// `detectedBic`, pas la valeur du state — pendant que le PDF recevait « Y ».
/// Le citoyen signait donc un document différent de ce qu'il venait de relire.
/// Puisque le champ est verrouillé dès qu'un BIC est déduit, la déduction est
/// la valeur de référence : une seule source de vérité, le state.
export function withSuggestedBic(values: FormPayload, fields: readonly PublicField[]): FormPayload {
  const ibanField = fields.find((field) => field.canonicalKey === "banque.iban");
  const bicField = fields.find((field) => field.canonicalKey === "banque.bic");
  const ibanValue = ibanField ? values[ibanField.id] : undefined;
  const currentBic = bicField ? values[bicField.id] : undefined;
  if (!ibanField || !bicField || typeof ibanValue !== "string") {
    return values;
  }

  const suggestedBic = bicFromForeignIban(ibanValue);
  return suggestedBic && currentBic !== suggestedBic
    ? { ...values, [bicField.id]: suggestedBic }
    : values;
}

/// Une valeur brute a-t-elle la FORME attendue par le type ACTUEL du champ ?
/// Ne juge que la forme, jamais le contenu : une chaîne vide reste une
/// chaîne valide pour un champ texte (cf. `buildInitialValues`, qui applique
/// séparément sa propre règle « prefill vide = absent »).
///
/// Conservateur par construction (dans le doute, on garde) : un type non
/// listé ici explicitement tombe dans le cas par défaut, qui accepte toute
/// chaîne — c'est déjà le cas de la grande majorité des types de champ
/// (text, textarea, date, select, radio, signature, niss, iban, postal_be,
/// tva_be, bce, phone_be, email : tous des `FieldValueScalar` textuels à
/// l'écran, cf. types.ts). Seuls `checkbox`, `array`, `fullname` et `number`
/// ont une forme distincte d'une chaîne quelconque.
///
/// Réutilise les gardes de types existants (`isFullNameValue`,
/// `isFieldValueRecordArray`) plutôt que de réinventer une détection —
/// notamment pour ne PAS casser `cohabitants` (C1, cf.
/// `lib/pdf-forms/seed/c1/famille.ts`) : sa ligne initiale
/// `[{ lien: "epoux" }]`, produite par l'assistant Mon dossier
/// (`familyAnswersToC1Prefill`), doit continuer à passer.
export function isValueShapeUsable(type: FieldType, raw: unknown): boolean {
  if (raw === undefined) return false;
  switch (type) {
    case "checkbox":
      return typeof raw === "boolean";
    case "array":
      return isFieldValueRecordArray(raw);
    case "fullname":
      return isFullNameValue(raw);
    case "number":
      // "nombre ou chaîne numérique" : une chaîne non vide qui ne se relit
      // pas comme un nombre fini (texte, vide, Infinity) n'est pas exploitable.
      if (typeof raw === "number") return Number.isFinite(raw);
      return typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw));
    default:
      return typeof raw === "string";
  }
}

/// Purge d'un payload BRUT (brouillon serveur `draftValues`, brouillon local
/// `PdfFormDraft`) les entrées dont la valeur ne correspond plus à la forme
/// attendue par le type ACTUEL du champ — cf. `isValueShapeUsable`. C'est le
/// point d'entrée générique à appliquer PARTOUT où un payload enregistré tel
/// quel (jamais revalidé depuis) rejoint l'état du runner : l'initialisation
/// du state (`pdf-form-runner.tsx`), la restauration du brouillon local
/// (même fichier), et `dossier-inheritance.ts` (qui doit juger si un champ
/// hérité est réellement « rempli » sur la même base que le runner).
///
/// Un `id` absent de `fields` (champ retiré du schéma) est conservé tel
/// quel : sans type à vérifier, on ne peut pas juger sa forme, et il ne sera
/// de toute façon ni rendu ni soumis (filtré ailleurs par le schéma courant).
/// Conservateur par construction, comme `isValueShapeUsable` : on ne retire
/// QUE ce qui est manifestement de la mauvaise forme pour le type actuel,
/// jamais une saisie du citoyen simplement vide.
export function sanitizeStoredPayload(
  fields: readonly PublicField[],
  raw: FormPayload | undefined
): FormPayload {
  if (!raw) return {};
  const typeById = new Map(fields.map((f) => [f.id, f.type]));
  const out: FormPayload = {};
  for (const [id, value] of Object.entries(raw)) {
    const type = typeById.get(id);
    if (type === undefined || isValueShapeUsable(type, value)) {
      out[id] = value as FieldValue;
    }
  }
  return out;
}

/// État de départ du runner : défauts du schéma, recouverts par le
/// pré-remplissage (profil + valeurs héritées des autres documents du dossier).
///
/// Un champ absent du résultat n'a AUCUNE valeur de départ ; un champ présent
/// en a une, même vide (`""`, `{ first: "", last: "" }`) — la distinction
/// compte pour `dossier-inheritance.ts`, qui ne masque que ce qui est
/// réellement rempli.
export function buildInitialValues(
  fields: readonly PublicField[],
  prefill?: PrefillMap
): FormPayload {
  const v: FormPayload = {};
  for (const f of fields) {
    const pv = prefill?.[f.id];
    // Cas fullname : accepte un objet composite `{ first, last }` (produit
    // par la voie canonical) OU une chaîne (fallback prefillFrom) qu'on
    // dispatche naïvement en `last` (compat historique — les fullname
    // prefill profil arrivaient déjà comme `lastName`).
    if (f.type === "fullname" && pv !== undefined) {
      if (isFullNameValue(pv)) {
        v[f.id] = pv;
      } else if (typeof pv === "string" && pv !== "") {
        v[f.id] = { first: "", last: pv };
      } else {
        v[f.id] = { first: "", last: "" };
      }
    } else if (typeof pv === "string" && pv !== "" && isValueShapeUsable(f.type, pv)) {
      v[f.id] = pv;
    } else if (Array.isArray(pv) && isValueShapeUsable(f.type, pv)) {
      // Cas réel aujourd'hui : `cohabitants` (C1) reçoit ainsi sa ligne
      // initiale depuis l'assistant Mon dossier (`familyAnswersToC1Prefill`,
      // `cohabitants: [{ lien }]`) — cf. `isValueShapeUsable`. Le garde évite
      // en retour qu'un tableau destiné à un ex-champ `array` devenu
      // `textarea`/`text` ne s'injecte tel quel dans un contrôle texte.
      v[f.id] = pv as FieldValue;
    } else if (isCreationDateField(f)) v[f.id] = todayISO();
    else if (f.defaultValue !== undefined) v[f.id] = f.defaultValue as FieldValue;
    else if (f.type === "checkbox") v[f.id] = false;
    else if (f.type === "fullname") v[f.id] = { first: "", last: "" };
    else if (isSignatureField(f)) v[f.id] = "";
  }

  // Un IBAN déjà prérempli (dossier/reprise) ne passe pas par `setValue`.
  return withSuggestedBic(v, fields);
}
