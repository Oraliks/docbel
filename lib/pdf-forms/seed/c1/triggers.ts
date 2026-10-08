// Déclencheurs de sous-formulaires portés par le C1.

import type { PdfFormTrigger } from "../../types";


/// Déclencheurs de sous-formulaires portés par le C1. Quand l'utilisateur
/// répond « oui » à une question sans avoir « déjà déclaré » la situation,
/// le sous-formulaire correspondant est ajouté au parcours.
///
/// Référence : feuille d'information C1 (version 01.01.2024/831.10.000).
export const C1_TRIGGERS: PdfFormTrigger[] = [
  {
    // Au moins une personne FAC déclarée « 1ʳᵉ fois » dans la grille des
    // cohabitants → joindre un C1-PARTENAIRE. Notation tableau [*] —
    // cf. lib/pdf-forms/triggers.ts#evaluateTrigger.
    whenFieldId: "cohabitants[*].c1PartenaireStatus",
    whenValue: "premiere-fois",
    requiresFormSlug: "c1-partenaire",
    reason: { fr: "Personne financièrement à charge à déclarer" },
  },
  {
    // Incapacité de travail permanente d'au moins 33 % → joindre un C47
    // pour fixer le montant des allocations (annule la dégressivité).
    whenFieldId: "incapacite33",
    whenValue: "oui",
    unlessFieldId: "incapacite33DejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c47",
    reason: { fr: "Incapacité 33 % — demande de fixation des allocations" },
  },
  {
    // L'ONEM décrit l'Annexe REGIS comme l'explication d'une différence entre
    // les déclarations C1 et les registres. Une colocation seule ne suffit pas
    // à la déduire : elle reste une information factuelle à confirmer.
    whenFieldId: "situationCohabitationAmbigue",
    whenValue: "oui",
    requiresFormSlug: "c1-regis",
    reason: { fr: "Une différence avec les registres est déclarée : l'Annexe REGIS permet de l'expliquer." },
  },
  {
    // Une demande explicite de co-housing appelle l'Annexe REGIS existante.
    // Ce n'est pas déduit d'une simple colocation : la qualification reste à l'ONEM.
    whenFieldId: "cohousingVieAutonomeRevendiquee",
    whenValue: "oui",
    requiresFormSlug: "c1-regis",
    reason: { fr: "Co-housing déclaré : l'Annexe REGIS existante permet d'expliquer la situation aux registres." },
  },
  {
    whenFieldId: "mandatArtistique",
    whenValue: "oui",
    unlessFieldId: "mandatArtistiqueDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c46",
    reason: { fr: "Mandat dans un organe consultatif culturel à déclarer" },
  },
  {
    // Mandat politique → C1A (arbitrage Oraliks 2026-07-26). L'aide du champ
    // `mandatPolitique` annonçait « → Joindre un FORMULAIRE C1A » depuis le
    // début, mais aucun déclencheur ne le faisait : le citoyen lisait la
    // consigne et aucun document ne s'ajoutait à son dossier. Les trois autres
    // activités de la même rubrique avaient bien le leur.
    //
    // Exception portée par l'aide du champ : conseiller communal ou membre du
    // Conseil de l'action sociale → répondre « non » (pas de C1A).
    whenFieldId: "mandatPolitique",
    whenValue: "oui",
    unlessFieldId: "mandatPolitiqueDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1a",
    reason: { fr: "Mandat politique à déclarer" },
  },
  {
    whenFieldId: "tremplinIndependants",
    whenValue: "oui",
    unlessFieldId: "tremplinIndependantsDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1c",
    reason: { fr: "Tremplin-indépendants à déclarer" },
  },
  {
    whenFieldId: "activiteAccessoireOuAide",
    whenValue: "oui",
    unlessFieldId: "activiteAccessoireDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1a",
    reason: { fr: "Activité accessoire ou aide à un indépendant à déclarer" },
  },
  {
    whenFieldId: "administrateurSociete",
    whenValue: "oui",
    unlessFieldId: "administrateurSocieteDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1a",
    reason: { fr: "Mandat d'administrateur de société à déclarer" },
  },
  {
    whenFieldId: "independantAccessoireOuPrincipal",
    whenValue: "oui",
    unlessFieldId: "independantAccessoireDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1a",
    reason: { fr: "Inscription indépendant à déclarer" },
  },
  {
    whenFieldId: "pensionRetraiteSurvie",
    whenValue: "oui",
    unlessFieldId: "pensionRetraiteDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1b",
    reason: { fr: "Pension de retraite ou de survie à déclarer" },
  },
];
