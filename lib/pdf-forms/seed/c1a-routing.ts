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
  aideraPendantChomage: { on: { oui: "q4periode", non: "mandatPolitiqueOuJuge" } },
  // Q4 → Q5. Ancre = `q4periode`, le choix « toute l'année / pendant les
  // périodes suivantes / irrégulièrement », et NON `q4lundi` : c'est lui qui
  // porte la question imprimée (« Quand aiderez-vous cet indépendant ? ») et
  // c'est la seule donnée exigible de la rubrique (cf. `grilleHoraire`, où
  // aucun jour précis n'est obligatoire). Les trente autres champs de la
  // grille lui sont rattachés par préfixe : leur condition d'affichage est
  // inchangée, seule l'ancre l'est.
  q4periode: { next: "descriptionAide1" },
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
  autreActiviteAccessoire: { on: { oui: "activiteCommeSalarie", non: "estChomeurTemporaire" } },
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
  exerceraPendantChomage: { on: { oui: "q18periode", non: "estChomeurTemporaire" } },
  // Q18 → Q19. Même ancre que Q4 ci-dessus, pour la même raison.
  q18periode: { next: "revenuNetSalarieParMois" },
  // Q19 → Q20
  revenuNetSalarieParMois: { next: "exerceDejaActivite" },
  // Q20 → Q21 / Q22
  exerceDejaActivite: { on: { oui: "dateDebutActivite", non: "estChomeurTemporaire" } },
  // Q21 → Q22
  dateDebutActivite: { next: "estChomeurTemporaire" },
  // Q22 → Q23. Rubrique réservée aux chômeurs temporaires : la question
  // d'entrée `estChomeurTemporaire` n'existe pas sur le papier, elle
  // matérialise la consigne imprimée « À COMPLÉTER UNIQUEMENT SI… ».
  //
  // Un seul nœud pour toute la rubrique : la consigne et les sept jours qu'elle
  // conditionne sont UNE question du document, et l'arbre découpe désormais le
  // parcours en étapes (une question = une étape). Les jours porteraient sinon
  // leur propre étape, intitulée « Lundi ». Leur condition d'affichage
  // (`estChomeurTemporaire = oui`) est écrite en clair sur chacun d'eux dans
  // c1a-fields.ts : `estChomeurTemporaire` étant posée sur tous les chemins,
  // il n'y a ici aucune condition transitive à dériver — et s'il en apparaissait
  // une, leur rattachement à cette question la leur appliquerait quand même.
  estChomeurTemporaire: { next: "independantTitrePrincipal" },
  // Q23 et Q24 — terminales, « COMPLÉTEZ TOUJOURS CETTE RUBRIQUE ».
  independantTitrePrincipal: { next: "affirmationSincerite" },
  affirmationSincerite: { next: FIN },
};

/// Questions du document, DANS L'ORDRE DE LECTURE.
///
/// Dérivée de la table ci-dessus, jamais recopiée : l'arbre est écrit dans
/// l'ordre du formulaire papier (Q1 → Q24) et l'ordre d'insertion des clés
/// d'un objet JavaScript est garanti pour les clés de type chaîne. Une
/// question ajoutée à l'arbre prend donc sa place dans le parcours sans qu'on
/// ait à y penser — une seconde liste à tenir à jour serait exactement le
/// genre de doublon qui finit désynchronisé.
///
/// Consommée par `form-presentation.ts` : une question = une étape du runner.
export const C1A_QUESTIONS: readonly string[] = Object.keys(C1A_ROUTAGE);

/// Étape de l'en-tête d'identité (nom, NISS, adresse) — la SEULE qui ne soit
/// pas une question : ce bandeau n'a pas de numéro sur le papier et n'entre
/// donc pas dans l'arbre. Déclarée ici pour que `c1a-fields.ts` (qui la pose
/// sur les champs) et `form-presentation.ts` (qui la place en tête du
/// parcours) désignent la même chose.
export const C1A_GROUPE_IDENTITE = "identite";
