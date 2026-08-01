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
    // L'utilisateur signale lui-même une situation de cohabitation ambiguë
    // → joindre une ANNEXE REGIS. Trigger sur la nouvelle question
    // `situationCohabitationAmbigue` qu'on ajoute juste après.
    whenFieldId: "situationCohabitationAmbigue",
    whenValue: "oui",
    unlessFieldId: "situationCohabitationAmbigueDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1-regis",
    reason: { fr: "Situation de cohabitation à préciser via Annexe REGIS" },
  },
  {
    // Nouvelle question concrète (2026-07) : la colocation (aucun lien de
    // parenté, pas de ménage commun) est exactement le cas couvert par le
    // code FN4 de l'Annexe Regis. Pas de suivi "déjà déclaré" pour cette
    // question — non demandé, cf. spec.
    whenFieldId: "habiteEnColocation",
    whenValue: "oui",
    requiresFormSlug: "c1-regis",
    reason: { fr: "Ne remplissez pas les détails du colocataire sur ce C1 : l'Annexe REGIS (code FN4) sera le prochain document à compléter." },
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
