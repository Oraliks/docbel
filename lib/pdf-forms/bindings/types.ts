// Bindings PDF déclaratifs — types (Phase 1 du plan
// docs/superpowers/plans/2026-07-07-pdf-bindings-canonical-ux-plan.md).
//
// Vision : remplacer les 6 transforms client-side historiques du C1
// (c1-motif-transfer, c1-iban-routing, c1-remarque-derivation,
// c1-titulaire-derivation, c1-iban-split, c1-date-header-p2) par un TABLEAU
// de règles ÉVALUÉ CÔTÉ SERVEUR juste avant `fillForm`. Deux bénéfices :
//   1. Une seule source de vérité (registry par slug) pour tous les
//      formulaires — plus de "ce qui doit être stampé" éparpillé sur 6
//      fichiers ad hoc et 5 champs "workaround" dans le schéma.
//   2. Isole côté serveur les décisions de stamping — le client n'a plus
//      besoin d'importer 6 helpers avant d'envoyer le payload.
//
// ⚠ Le pipe-séparateur (`"widgetA|widgetB"`) reste la convention du
// MAPPING SCHÉMA (`PdfFormField.pdfFieldName` pour un radio N-options) —
// PAS des règles. Une règle émet des stamps par widget individuel (une
// entrée par case cible : `{ widget: "non_17", value: true }`), pour rester
// explicite et éviter toute ambiguïté au moment de la résolution.

import type { FormPayload, FieldValue } from "../types";

/// Condition SUR UN CHAMP du payload. Forme normalisée déclarative — pas de
/// fonction ici, tout est sérialisable en JSON (facilite le debug via
/// mapping-report en Phase 6). Une valeur brute (`string | number | boolean`)
/// vaut égalité stricte, équivalent à `{ equals: v }`. Les regex sont
/// stockées comme SOURCE (string) — le moteur les compile à la volée sur
/// un `String(dep ?? "")`.
export type WhenCondition =
  | string
  | number
  | boolean
  | { equals: FieldValue }
  | { in: readonly (string | number)[] }
  | { not: FieldValue }
  | { matches: string };

/// Clause de conditions sur PLUSIEURS champs. Les entrées sont combinées en
/// AND implicite : la règle s'active si TOUTES les conditions passent. Pour
/// un OR, décomposer en deux règles distinctes (le "dernier gagnant par
/// widget" du moteur permet de composer proprement).
export type WhenClause = Record<string, WhenCondition>;

/// Un stamp = une écriture sur UN widget AcroForm cible.
///   - `boolean` → checkbox (true = check, false = uncheck).
///   - `string`  → text field (setText + font size uniforme, cf. filler.ts).
/// PDFDropdown/PDFRadioGroup ne sont pas ciblés directement par les règles
/// dans cette phase ; le mapping schéma historique reste maître pour eux.
export interface StampEntry {
  /// Nom EXACT du widget dans l'AcroForm (identique à `pdfFieldName` côté
  /// schéma technique). Sensible aux espaces (« B E », « SEPA étranger IBAN
  /// BIC ») — reproduire au caractère près.
  widget: string;
  value: string | boolean;
}

/// Une règle de mapping.
///
/// Discipline attendue :
///   - `when` est déclaratif (JSON) → à privilégier ; sérialisable, testable
///     un par un, exploitable par le visualiseur admin de la Phase 6.
///   - `whenFn` est réservé aux cas dont la condition dépasse le champ
///     égalité/appartenance (ex. « l'IBAN commence par BE ET a au moins
///     16 caractères »). Combiné à `when`, l'AND s'étend à la fonction.
///   - `stamp` est statique (le widget cible ne dépend pas du payload) — à
///     privilégier pour la lisibilité et la couverture du mapping-report.
///   - `stampFn` sert quand la VALEUR à stamper dépend du payload
///     (concaténation, split, formatage). Dans ce cas, remplir
///     `declaredWidgets` pour que le visualiseur admin sache ce qui est
///     ciblé sans exécuter la fonction sur un payload d'exemple.
export interface MappingRule {
  /// Identifiant unique DANS LE REGISTRY d'un formulaire. Utile au debug
  /// (logs) ; sert aussi de clé d'override lorsqu'un formulaire redéfinit
  /// une règle partagée avec le même `name` (dernière position gagne au
  /// `resolveStamps` par widget, mais le `name` reste la marque humaine).
  name: string;
  when?: WhenClause;
  whenFn?: (v: FormPayload) => boolean;
  stamp?: StampEntry[];
  stampFn?: (v: FormPayload) => StampEntry[];
  /// Liste des widgets que `stampFn` PEUT écrire. Ignoré pour les règles
  /// à `stamp` statique (leurs cibles se lisent dans `stamp`). Consommé par
  /// le visualiseur admin de mapping (Phase 6) pour repérer les widgets
  /// couverts sans devoir exécuter la fonction sur un payload d'exemple.
  declaredWidgets?: string[];
}
