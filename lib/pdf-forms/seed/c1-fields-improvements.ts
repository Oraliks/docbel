// Schéma enrichi du formulaire C1 — point d'entrée historique.
//
// Le contenu vit désormais dans `./c1/`, découpé par thème (identité, motif,
// famille, activités, paiement, fin de formulaire), avec sa logique
// d'application isolée dans `./c1/overlay.ts` et ses fabriques de champs dans
// `./c1/helpers.ts`.
//
// Ce fichier reste comme FAÇADE : seize modules l'importent, et rien ne
// justifiait de leur faire tous changer d'adresse au passage. Les nouveaux
// imports peuvent viser `./c1` directement.
//
// Patterns de mapping `pdfFieldName` (documentés ici parce que c'est la
// première porte d'entrée quand on cherche à comprendre le C1) :
//   - "widget"               → champ texte, date, checkbox simple
//   - "oui_N|non_N"          → radio à 2 options sur paire de checkboxes ONEM
//   - "wA|wB|wC|wD"          → radio à N options sur N checkboxes distincts
//                              (ex. motifIntroduction : 4 cases mutuellement
//                              exclusives sur le PDF, cf. filler.ts pour la
//                              généralisation à N).
//   - "widget|"              → option « oui » seule a une case sur le PDF
//                              (l'option « non » ne coche rien).
//   - ""                     → champ virtuel : capturé dans le payload mais
//                              pas stampé sur le PDF (ex. follow-ups
//                              pédagogiques, ou champs sans widget officiel).
//
// Mapping AcroForm vérifié sur private/pdfs/C1_FR.pdf — le test
// `seeds-vs-pdf` le revérifie à chaque `pnpm test`.
// Référence métier : feuille d'information C1 (version 01.01.2024/831.10.000).

export { C1_QUESTIONS, C1_TRIGGERS, applyC1Improvements } from "./c1";
export type { ApplyC1ImprovementsOptions } from "./c1";
