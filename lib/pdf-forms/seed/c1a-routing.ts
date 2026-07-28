// Arbre des renvois imprimés du C1A, recopié du PDF officiel.
//
// Chaque arête vient d'un « voir N » imprimé : AUCUN enchaînement implicite.
// Les deux seules questions sans renvoi sont Q23 et Q24, terminales, qui
// portent leur propre consigne « COMPLÉTEZ TOUJOURS CETTE RUBRIQUE ».
//
// Version imprimée : 01.11.2013 / 830.10.002.

import { FIN, type TableRoutage } from "../routing";

export const C1A_DEPART = "aideIndependant";

export const C1A_ROUTAGE: TableRoutage = {
  // Q1 → Q2 / Q9
  aideIndependant: { on: { oui: "independantNom", non: "mandatPolitiqueOuJuge" } },
  // Q2 → Q3
  independantNom: { next: "aideraPendantChomage" },
  // Q3 → Q4 / Q9
  aideraPendantChomage: { on: { oui: "q4lundi", non: "mandatPolitiqueOuJuge" } },
  // Q4 → Q5
  q4lundi: { next: "descriptionAide1" },
  // Q5 → Q6
  descriptionAide1: { next: "montantAidePeriodicite" },
  // Q6 → Q7
  montantAidePeriodicite: { next: "aidaitDejaIndependant" },
  // Q7 → Q8 / Q9
  aidaitDejaIndependant: { on: { oui: "dateDebutAide", non: "mandatPolitiqueOuJuge" } },
  // Q8 → Q9
  dateDebutAide: { next: "mandatPolitiqueOuJuge" },
  // Q9 → Q10 / Q12. Exemption imprimée : conseiller communal, conseiller
  // provincial, membre d'un CPAS, juge social, juge consulaire ou conseiller
  // social → répondre « non ».
  mandatPolitiqueOuJuge: { on: { oui: "mandatDescription", non: "autreActiviteAccessoire" } },
  // Q10 → Q11
  mandatDescription: { next: "revenuAnnuelMandat" },
  // Q11 → Q12
  revenuAnnuelMandat: { next: "autreActiviteAccessoire" },
  // Q12 → Q13 / Q22
  autreActiviteAccessoire: { on: { oui: "activiteCommeSalarie", non: "joursOccupeLundi" } },
  // Q13 → Q14 / Q15
  activiteCommeSalarie: { on: { oui: "employeurNom", non: "adresseActivite" } },
  // Q14 → Q15
  employeurNom: { next: "adresseActivite" },
  // Q15 → Q16
  adresseActivite: { next: "formeActivite" },
  // Q16 → Q17. UNE seule sortie pour les deux options — pas de renvoi par
  // option, contrairement à Q1 ou Q13.
  formeActivite: { next: "exerceraPendantChomage" },
  // Q17 → Q18 / Q22
  exerceraPendantChomage: { on: { oui: "q18lundi", non: "joursOccupeLundi" } },
  // Q18 → Q19
  q18lundi: { next: "revenuNetSalarieParMois" },
  // Q19 → Q20
  revenuNetSalarieParMois: { next: "exerceDejaActivite" },
  // Q20 → Q21 / Q22
  exerceDejaActivite: { on: { oui: "dateDebutActivite", non: "joursOccupeLundi" } },
  // Q21 → Q22
  dateDebutActivite: { next: "joursOccupeLundi" },
  // Q22 → Q23. La rubrique porte la consigne « À COMPLÉTER UNIQUEMENT SI VOUS
  // ÊTES CHÔMEUR TEMPORAIRE », mais AUCUNE question imprimée n'établit ce
  // statut : le renvoi « voir 22 » tombe donc directement sur la première case
  // de la rubrique, et les sept jours restent posés à tout le monde. C'est ce
  // que la tâche suivante corrige, en intercalant ici une question virtuelle.
  joursOccupeLundi: { next: "independantTitrePrincipal" },
  // Q23 et Q24 — terminales, « COMPLÉTEZ TOUJOURS CETTE RUBRIQUE ».
  independantTitrePrincipal: { next: "affirmationSincerite" },
  affirmationSincerite: { next: FIN },
};
