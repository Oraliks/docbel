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

import { isFullNameValue, type FieldValue, type FormPayload } from "./types";
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
    } else if (typeof pv === "string" && pv !== "") {
      v[f.id] = pv;
    } else if (Array.isArray(pv)) {
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
