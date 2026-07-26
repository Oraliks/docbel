// Schéma enrichi du C1 — point d'entrée.
//
// Le contenu était un monolithe de 2379 lignes mêlant les définitions de
// champs et la logique qui les applique. Chaque thème a maintenant son
// module ; l'assemblage vit dans `questions.ts`, la logique dans
// `overlay.ts`, les moules partagés dans `helpers.ts`.

export { C1_QUESTIONS } from "./questions";
export { C1_TRIGGERS } from "./triggers";
export { applyC1Improvements, type ApplyC1ImprovementsOptions } from "./overlay";
