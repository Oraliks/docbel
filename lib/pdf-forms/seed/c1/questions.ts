// Assemblage du schéma C1 à partir des modules thématiques.
//
// Fichier séparé de `index.ts` pour rompre un CYCLE : l'overlay a besoin
// du tableau, et `index.ts` réexporte l'overlay. Les deux passeraient par
// un import circulaire — supporté par ESM tant que l'usage est différé,
// mais c'est le genre de dépendance qui casse au premier changement
// d'ordre d'évaluation.
//
// L'ORDRE DES MODULES CI-DESSOUS EST L'ORDRE D'AFFICHAGE du formulaire.

import type { PdfFormField } from "../../types";
import { C1_IDENTITE } from "./identite";
import { C1_MOTIF } from "./motif";
import { C1_FAMILLE } from "./famille";
import { C1_ACTIVITES } from "./activites";
import { C1_PAIEMENT } from "./paiement";
import { C1_FINAL } from "./final";

export const C1_QUESTIONS: PdfFormField[] = [
  ...C1_IDENTITE,
  ...C1_MOTIF,
  ...C1_FAMILLE,
  ...C1_ACTIVITES,
  ...C1_PAIEMENT,
  ...C1_FINAL,
];
