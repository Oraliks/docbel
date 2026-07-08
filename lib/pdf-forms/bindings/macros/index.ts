// Bibliothèque de macro-rules réutilisables entre formulaires ONEM.
//
// Chaque macro produit une `MappingRule` complète (paramètres widgets +
// source du payload) au lieu de dupliquer la logique dans chaque
// `bindings/per-form/*.ts`. Ajoute une nouvelle macro dès qu'un pattern
// apparaît dans 2+ documents.
//
// Cf. `docs/pdf-forms-add-document.md` § 7 pour l'usage recommandé.

export { ibanBelgianSplit, type IbanBelgianSplitWidgets } from "./iban-belgian-split";
export { ibanForeignRouting } from "./iban-foreign-routing";
export { horsEeeTripleNon, type HorsEeeTripleNonWidgets } from "./hors-eee-triple-non";
export { dateHeaderFallback } from "./date-header-fallback";
