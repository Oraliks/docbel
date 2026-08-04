// Schéma enrichi du formulaire C1A — "Déclaration d'aide à un travailleur
// indépendant / déclaration d'une activité accessoire" (mandat politique
// inclus). Formulaire compagnon du C1, déclenché par plusieurs questions du
// C1 (activiteAccessoireOuAide, administrateurSociete,
// independantAccessoireOuPrincipal, mandatPolitique) — cf. C1_TRIGGERS dans
// c1-fields-improvements.ts.
//
// Mapping AcroForm vérifié sur le dump JSON fourni (132 widgets, 2 pages).
// Référence métier : texte imprimé du formulaire officiel ONEM C1A
// (version 01.11.2013/830.10.002).
//
// ⚠ Le PDF a une mise en page à 2 COLONNES par page (gauche = questions
// impaires, droite = questions paires globalement) mais l'ORDRE DES WIDGETS
// AcroForm (utilisé comme `order` dans le dump) suit l'ordre de création du
// formulaire, PAS la position visuelle — comme déjà documenté pour le C1
// principal. On se fie donc au TEXTE + à la déduction logique des groupes de
// widgets consécutifs pour rattacher chaque champ à sa question, en croisant
// avec les numéros "voir N" imprimés.
//
// Structure logique (numéros de question du PDF officiel) :
//   Q1  Aidez-vous un indépendant ?                          oui/non
//   Q2  Données de l'indépendant aidé (nom, n° entreprise,     texte
//       adresse activité, nature de l'activité x5)
//   Q3  Aiderez-vous cet indépendant PENDANT votre chômage ?  oui/non
//   Q4  Quand aiderez-vous cet indépendant ? (grille horaire)  checkboxes
//   Q5  Décrivez l'aide que vous apporterez (x9 lignes)        texte
//   Q6  Combien gagnez-vous pour votre aide ?                  montant
//   Q7  Aidiez-vous déjà cet indépendant dans le passé ?       oui/non
//   Q8  À partir de quelle date ?                               date
//   Q9  Exercez-vous un mandat politique ou une fonction        oui/non
//       de juge/conseiller ?
//   Q10 Quel mandat ou fonction ?                               texte
//   Q11 Quel en est le revenu annuel net imposable ?            2 montants
//   Q12 Exercez-vous une autre activité à titre accessoire ?   oui/non
//   Q13 Exercez-vous cette activité comme salarié ?             oui/non
//   Q14 Données concernant votre employeur                     texte
//   Q15 À quelle adresse exercez-vous cette activité ?          adresse
//   Q16 J'exerce l'activité comme : personne physique /         radio + toggle
//       mandataire·administrateur·gestionnaire + n° entreprise + description
//   Q17 Exercerez-vous cette activité PENDANT votre chômage ?   oui/non
//   Q18 Quand exercerez-vous cette activité ? (grille horaire)  checkboxes
//   Q19 Quel est le revenu net de votre activité ?               montants
//   Q20 Exerciez-vous déjà cette activité dans le passé ?       oui/non
//   Q21 Depuis quand ?                                           date
//   Q22 Quels jours occupé chez l'employeur (chômeur temp.)     checkboxes
//   Q23 Indépendant à titre principal ?                         radio spécial
//   Q24 Affirmation finale + annexes + signature
//
// ----- Zone d'ambiguïté documentée -----
// Les 4 paires oui_3/non_3, oui_4/non_4, oui_5/non_5, oui_6/non_6 (ordre
// 54-61 du dump) précèdent immédiatement le widget "14 Données concernant
// votre employeur" (ordre 62 = Q14). En comptant les questions oui/non
// restant à placer avant Q14 (Q7, Q9, Q12, Q13, dans cet ordre de lecture du
// texte), on les rattache dans l'ordre : oui_3/non_3→Q7, oui_4/non_4→Q9,
// oui_5/non_5→Q12, oui_6/non_6→Q13. Cohérent avec la suite (oui_7/non_8→Q17,
// oui_8/non_9→Q20, oui_et_je_sais.../non_10→Q23) où la numérotation des
// widgets ne saute JAMAIS un numéro sans une raison identifiable (non_7 est
// "consommé" par le toggle numéro d'entreprise de Q16).

import type { PdfFormField, VisibleIf } from "../types";
import { compilerRoutage } from "../routing";
import { mergeEnrichedFields } from "./_merge";
import { appliquerGroupes } from "./_shared/moules";
import { C1A_DEPART, C1A_ROUTAGE } from "./c1a-routing";

const SECTION_IDENTITE = "identite";
const SECTION_ADRESSE = "adresse";
const SECTION_EMPLOYEUR = "employeur";
const SECTION_ACTIVITES = "mes-activites";
const SECTION_REVENUS = "mes-revenus";
const SECTION_AFFIRMATIONS = "affirmations";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";
/// Réutilise la section partagée "divers" (section-labels.ts) pour le champ
/// non rattaché avec certitude à une question (cf. A VALIDER Oraliks en fin
/// de fichier).
const SECTION_DIVERS_INCONNU = "divers";

/// Section dédiée à la partie "aide à un indépendant" (Q1-Q11) — distincte
/// de "mes-activites" (réutilisée pour Q12-Q23, qui décrit une activité
/// accessoire propre au déclarant, pas une aide à un tiers).
const SECTION_AIDE_INDEPENDANT = "aide-independant";

const YN = [
  { value: "oui", label: { fr: "Oui" } },
  { value: "non", label: { fr: "Non" } },
];

/// Condition des sept cases de Q22 (« à compléter uniquement si tu es chômeur
/// temporaire »). Écrite une fois, posée sur chaque jour — cf. le commentaire
/// détaillé sur `joursOccupeLundi`.
const VISIBLE_SI_CHOMEUR_TEMPORAIRE: VisibleIf = {
  fieldId: "estChomeurTemporaire",
  op: "equals",
  value: "oui",
};

/// Grille horaire répétée 2 fois sur le PDF (Q4 "quand aiderez-vous
/// l'indépendant" et Q18 "quand exercerez-vous cette activité"). Structure
/// identique : lundi à vendredi (chacun x avant 7h / entre 7h et 18h /
/// après 18h), puis samedi et dimanche (sans horaire), puis un choix parmi
/// "toute l'année" / "pendant les périodes suivantes" (UN textarea libre,
/// réparti à la génération sur les lignes pointillées du PDF via
/// `lineTargets` — cf. plus bas) / "irrégulièrement, à savoir" (idem).
//
// La grille reproduit celle du formulaire papier : les sept jours et leurs
// créneaux sont visibles d'emblée, sans dévoilement progressif (décision
// Oraliks 2026-07-28). Les créneaux gardent en revanche la condition de branche
// posée par `appliquerRoutage` sur leur question d'entrée — Q3 ou Q17.
function grilleHoraire(opts: {
  idPrefix: string;
  questionLabel: string;
  parentId: string;
  parentValue: string;
  section: string;
  order: number;
  // Suffixes exacts des pdfFieldName pour cette occurrence de la grille.
  suffixes: {
    lundi: string; mardi: string; mercredi: string; jeudi: string; vendredi: string;
    samedi: string; dimanche: string;
    avant7h: string[]; // 5 valeurs, lundi→vendredi
    entre7h18h: string[]; // 5 valeurs, lundi→vendredi
    apres18h: string[]; // 5 valeurs, lundi→vendredi
    touteLannee: string;
    pendantPeriodes: string;
    irregulierement: string;
  };
  // Lignes pointillées physiques du PDF pour "pendant les périodes" et pour
  // "irrégulièrement", dans l'ordre d'apparition sur le document (pdfFieldName
  // exacts). Un élément peut aussi être un objet `{ pdfFieldName: "", drawAt }`
  // quand la case AcroForm ne peut pas être revendiquée (widget partagé avec
  // une autre case du PDF) — cf. Q18 ci-dessous, seul appelant à en avoir
  // besoin ; Q4 continue de fournir de simples chaînes, la fabrique n'est pas
  // dénaturée. Ces listes deviennent le `lineTargets` d'UN SEUL champ
  // `textarea` par option (cf. plus bas) : le citoyen écrit librement, et
  // `filler.ts` répartit son texte sur ces cibles dans l'ordre donné ici.
  periodesTextFields: Array<string | { pdfFieldName: string; drawAt?: PdfFormField["drawAt"] }>;
  // Même union que `periodesTextFields` : la Q18 a besoin d'une entrée
  // POSITIONNELLE pour sa 4ᵉ ligne — le widget qui la porte est partagé.
  irregulierementTextFields: Array<string | { pdfFieldName: string; drawAt?: PdfFormField["drawAt"] }>;
}): PdfFormField[] {
  const { suffixes } = opts;
  const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"] as const;
  const fields: PdfFormField[] = [];

  // Numérotation DENSE. La grille est une seule rubrique du document : elle
  // doit occuper un bloc d'`order` contigu, sinon les questions voisines
  // s'intercalent entre ses lignes. Avec des sauts de 10, Q4 (base 10)
  // s'étalait sur 10→93 et encastrait les neuf lignes de description de Q5
  // (46→54) au milieu de la semaine — le citoyen voyait lundi à jeudi, la
  // description, vendredi, puis samedi vingt champs plus loin.
  //
  // Le compteur suit l'ordre de poussée, qui est déjà celui du document.
  let rang = 0;
  const ordre = () => opts.order + rang++;

  jours.forEach((jour, i) => {
    fields.push({
      id: `${opts.idPrefix}${jour}`,
      // `required` reste `false` (Commit 3, décision Oraliks) : aucun jour
      // précis du calendrier n'a de raison objective d'être obligatoire — un
      // citoyen peut légitimement n'aider/travailler que le mercredi. La
      // « donnée principale » exigible de cette rubrique est posée sur
      // `${idPrefix}periode` (toute l'année / périodes / irrégulier)
      // ci-dessous, pas sur un jour précis. `requiredGroup` ("au moins un
      // jour coché") est explicitement écarté : il bascule le rendu de la
      // section entière sur `MotifSituationPicker`, qui remplacerait le
      // calendrier par une liste de chips (cf. pdf-form-runner.tsx).
      pdfFieldName: suffixes[jour],
      type: "checkbox",
      required: false,
      label: { fr: jour.charAt(0).toUpperCase() + jour.slice(1) },
      // Pas de `help` : le nom du jour EST déjà toute l'information.
      visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
      section: opts.section,
      order: ordre(),
      // Regroupement PRÉSENTATIONNEL en tableau (cf. types.ts) : ce champ est
      // la case "jour" de sa ligne — rendue dans la cellule de tête avec son
      // propre libellé (le nom du jour), pas une colonne de créneau.
      scheduleGrid: { row: jour },
    });
    fields.push({
      id: `${opts.idPrefix}${jour}Avant7h`,
      pdfFieldName: suffixes.avant7h[i],
      type: "checkbox",
      required: false,
      label: { fr: "Avant 7 h" },
      // Pas de `help` : la tranche horaire EST déjà toute l'information.
      section: opts.section,
      order: ordre(),
      scheduleGrid: { row: jour, col: "avant7h" },
    });
    fields.push({
      id: `${opts.idPrefix}${jour}Entre7h18h`,
      pdfFieldName: suffixes.entre7h18h[i],
      type: "checkbox",
      required: false,
      label: { fr: "Entre 7 h et 18 h" },
      // Pas de `help` : la tranche horaire EST déjà toute l'information.
      section: opts.section,
      order: ordre(),
      scheduleGrid: { row: jour, col: "entre7h18h" },
    });
    fields.push({
      id: `${opts.idPrefix}${jour}Apres18h`,
      pdfFieldName: suffixes.apres18h[i],
      type: "checkbox",
      required: false,
      label: { fr: "Après 18 h" },
      // Pas de `help` : la tranche horaire EST déjà toute l'information.
      section: opts.section,
      order: ordre(),
      scheduleGrid: { row: jour, col: "apres18h" },
    });
  });

  fields.push({
    id: `${opts.idPrefix}samedi`,
    pdfFieldName: suffixes.samedi,
    type: "checkbox",
    required: false,
    label: { fr: "Samedi" },
    // Pas de `help` : le nom du jour EST déjà toute l'information.
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: ordre(),
    // Pas de créneau pour le week-end : ligne avec la seule case "jour",
    // cf. `scheduleGrid` — les colonnes de créneau restent vides pour elle.
    scheduleGrid: { row: "samedi" },
  });
  fields.push({
    id: `${opts.idPrefix}dimanche`,
    pdfFieldName: suffixes.dimanche,
    type: "checkbox",
    required: false,
    label: { fr: "Dimanche" },
    // Pas de `help` : le nom du jour EST déjà toute l'information.
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: ordre(),
    scheduleGrid: { row: "dimanche" },
  });

  fields.push({
    id: `${opts.idPrefix}periode`,
    pdfFieldName: `${suffixes.touteLannee}|${suffixes.pendantPeriodes}|${suffixes.irregulierement}`,
    type: "radio",
    // Required (Commit 3) : c'est la « donnée principale » de la rubrique
    // grille horaire, posée ICI plutôt que sur l'ancre C1A_ROUTAGE
    // (`${idPrefix}lundi`) — cocher une case précise du calendrier (lundi,
    // mardi…) n'a jamais de raison objective d'être obligatoire (un citoyen
    // peut légitimement n'aider que le mercredi). La fréquence globale
    // (toute l'année / périodes / irrégulier), elle, est bien LA question
    // que Q4/Q18 posent sur le papier.
    required: true,
    label: { fr: opts.questionLabel },
    help: {
      fr: "Choisissez la fréquence qui correspond le mieux : toute l'année, seulement certaines périodes (précisez-les), ou de façon irrégulière (précisez aussi).",
    },
    options: [
      { value: "toute-annee", label: { fr: "Toute l'année" } },
      { value: "periodes", label: { fr: "Pendant les périodes suivantes de l'année" } },
      { value: "irregulier", label: { fr: "Irrégulièrement, à savoir" } },
    ],
    visibleIf: { fieldId: opts.parentId, op: "equals", value: opts.parentValue },
    section: opts.section,
    order: ordre(),
  });

  // UN SEUL champ `textarea` par option (2026-07-30, retour Oraliks après
  // test) — plus de "Période 1/2/3/4" ni de "Précision 2/3" : « c'est pas
  // nécessaire, juste un input plus grand en mode texte suffit et à toi
  // d'adapter pour que sur la C1 ça apparaisse correctement ». Le citoyen
  // écrit librement ; `lineTargets` porte les lignes pointillées physiques
  // ci-dessus, dans l'ordre du PDF, et `filler.ts` y replie le texte par mots
  // (repli de taille sur la dernière cible en cas de débordement — jamais de
  // perte silencieuse). `type: "textarea"` suffit à obtenir une zone plus
  // grande qu'un `text` (cf. `components/ui/textarea.tsx` : hauteur mini +
  // croissance automatique avec le contenu), sans nouvelle prop de schéma.
  //
  // Aucune de ces deux lignes n'a de libellé imprimé propre sur le PDF (la
  // ligne pointillée prolonge simplement la phrase de l'option choisie
  // ci-dessus) : les libellés ci-dessous sont des instructions neutres, pas
  // une formulation recopiée du papier — "Précisez à quel rythme" reprend le
  // texte déjà utilisé ici avant ce lot pour la 1re ligne "irrégulièrement".
  fields.push({
    id: `${opts.idPrefix}periodesTexte`,
    pdfFieldName: "",
    lineTargets: opts.periodesTextFields.map((entree) =>
      typeof entree === "string" ? { pdfFieldName: entree } : entree,
    ),
    type: "textarea",
    required: false,
    label: { fr: "Précisez les périodes" },
    visibleIf: { fieldId: `${opts.idPrefix}periode`, op: "equals", value: "periodes" },
    section: opts.section,
    order: ordre(),
  });

  fields.push({
    id: `${opts.idPrefix}irregulierementTexte`,
    pdfFieldName: "",
    lineTargets: opts.irregulierementTextFields.map((cible) =>
      typeof cible === "string" ? { pdfFieldName: cible } : cible,
    ),
    type: "textarea",
    required: false,
    label: { fr: "Précisez à quel rythme" },
    visibleIf: { fieldId: `${opts.idPrefix}periode`, op: "equals", value: "irregulier" },
    section: opts.section,
    order: ordre(),
  });

  return fields;
}

export const C1A_FIELDS: PdfFormField[] = [
  // ====================================================================
  // IDENTITÉ DU DÉCLARANT (le chômeur qui remplit le formulaire)
  // ====================================================================
  //
  // Les six champs de ce bloc portent `inheritedFromDossier` : dans un dossier,
  // le C1 les a DÉJÀ posés, et Oraliks (2026-07-29) ne veut pas qu'on les
  // repose — « si elle change sur la C1 alors elle changera sur la C1A aussi ».
  // Ils disparaissent alors du parcours, sans disparaître du PDF : la valeur
  // héritée reste dans le payload et part sur le papier (cf.
  // `dossier-inheritance.ts`, et la preuve bout en bout dans
  // `__tests__/c1a-identite-heritee.test.ts`).
  //
  // Ils restent en revanche `required` et SANS `autoAnswered` en dur : le C1A a
  // aussi une URL publique (`/document/onem/c1a`), où aucun C1 n'a été rempli.
  // Là, l'étape d'identité s'affiche normalement — sans quoi la déclaration
  // partirait à l'ONEM sans nom ni NISS.
  {
    // `fullname` plutôt que `text` (2026-07-26) : deux cases à l'écran
    // (prénom / nom), une seule chaîne sur le PDF, assemblée par le filler
    // dans l'ordre imposé par le libellé imprimé (« Nom et prénom »).
    //
    // C'est ce qui rend la reprise depuis le C1 AUTOMATIQUE : `extract.ts`
    // remplit tout champ `fullname` à partir de `identity.prenom` +
    // `identity.nom`, sans qu'il ait besoin de porter une clé canonique.
    // Avant, le champ était un simple texte préremplí par `profile.lastName` :
    // il recevait le NOM SEUL et paraissait rempli — le prénom disparaissait
    // sans que rien ne le signale.
    id: "nomEtPrenom",
    pdfFieldName: "Nom et prénom",
    type: "fullname",
    nameOrder: "last-first",
    required: true,
    inheritedFromDossier: true,
    label: { fr: "Nom et prénom" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    section: SECTION_IDENTITE,
    order: -99,
  },
  {
    id: "niss",
    pdfFieldName: "NISS",
    type: "niss",
    required: true,
    inheritedFromDossier: true,
    label: { fr: "Numéro NISS (registre national)" },
    help: {
      fr: "11 chiffres au dos de votre carte d'identité (eID), au-dessus du code-barres. Le formulaire le rappelle : « voir coin supérieur droit de votre carte SIS ».",
    },
    placeholder: { fr: "00.00.00-000.00" },
    prefillFrom: "profile.niss",
    canonicalKey: "identity.niss",
    // Guide imprimé en peigne, ajouté le 2026-08-02 à la relecture d'un PDF
    // généré : sans lui, « 78.11.02-088.44 » partait d'un bloc PAR-DESSUS les
    // onze cases, points et tirets compris, et les deux dernières cases
    // restaient visibles à droite du texte. Même défaut qu'Oraliks avait
    // signalé sur le C1 le 2026-07-27.
    //
    // Onze glyphes SymbolMT mesurés à pdfplumber (x=31,7 → 167,9), groupés
    // 9 + 2 : ce formulaire-ci ne sépare que les deux chiffres de contrôle, là
    // où le C1 et les compagnons découpent en 6-3-2. Pas de 13,02 pt et écart
    // de groupe de 6,06 — exactement les mesures des deux peignes BCE déjà
    // câblés dans ce fichier, le PDF réutilisant le même gabarit.
    fontSize: 9,
    printAsComb: { groups: [9, 2], slotWidth: 13.02, groupExtra: 6.06, startX: 0.7, baselineY: 1.3 },
    section: SECTION_IDENTITE,
    // -100 et non -99 : sur la page 1, la case NISS (y=573) est imprimée
    // AU-DESSUS de la case Nom et prénom (y=534). L'ordre suit celui du
    // document, où le NISS précède le nom.
    order: -100,
  },
  // ADRESSE — deux widgets du PDF fusionnent chacun DEUX informations
  // (« rue + numéro », « code postal + commune »). On saisit donc les quatre
  // valeurs séparément, chacune avec sa clé canonique, et deux règles serveur
  // recomposent les widgets (`bindings/per-form/c1a.ts`). C'est le pattern
  // déjà utilisé par le C1 pour son widget « CodePostal et Commune ».
  //
  // Sans cette séparation (état avant le 2026-07-26), un `prefillFrom` sur le
  // champ fusionné ne pouvait ramener QU'UNE des deux valeurs : la rue sans le
  // numéro, le code postal sans la commune. Le champ paraissait rempli et
  // partait incomplet à l'ONEM.
  {
    id: "rue",
    pdfFieldName: "",
    type: "text",
    required: true,
    inheritedFromDossier: true,
    label: { fr: "Rue" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    prefillFrom: "profile.street",
    canonicalKey: "adresse.rue",
    section: SECTION_IDENTITE,
    order: -98,
  },
  {
    id: "numero",
    pdfFieldName: "",
    type: "text",
    required: true,
    inheritedFromDossier: true,
    label: { fr: "Numéro" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    canonicalKey: "adresse.numero",
    section: SECTION_IDENTITE,
    order: -97.5,
  },
  {
    id: "codePostal",
    pdfFieldName: "",
    type: "postal_be",
    required: true,
    inheritedFromDossier: true,
    label: { fr: "Code postal" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    prefillFrom: "profile.postalCode",
    canonicalKey: "adresse.codePostal",
    section: SECTION_IDENTITE,
    order: -97,
  },
  {
    id: "commune",
    pdfFieldName: "",
    type: "text",
    required: true,
    inheritedFromDossier: true,
    label: { fr: "Commune" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    prefillFrom: "profile.city",
    canonicalKey: "adresse.commune",
    section: SECTION_IDENTITE,
    order: -96.5,
  },

  // ====================================================================
  // Q1 — AIDEZ-VOUS UN INDÉPENDANT ?
  // ====================================================================
  {
    id: "aideIndependant",
    pdfFieldName: "oui|non",
    type: "radio",
    required: true,
    label: {
      fr: "Aidez-vous un indépendant (par ex. dans son activité même, administration, comptabilité, permanence téléphonique…) ?",
    },
    labelShort: { fr: "Aidez-vous un indépendant ?" },
    help: {
      fr: "Par exemple dans son activité même, l'administration, la comptabilité, une permanence téléphonique… Si vous aidez plus d'un indépendant, complétez un formulaire C1A pour chaque indépendant.",
    },
    options: YN,
    section: SECTION_AIDE_INDEPENDANT,
    order: 0,
  },

  // ====================================================================
  // Q2 — DONNÉES DE L'INDÉPENDANT AIDÉ
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, donnée principale de Q2 — chemin
    // unique (aideIndependant=oui), pas de branche alternative à discriminer.
    id: "independantNom",
    pdfFieldName: "Nom",
    type: "text",
    required: true,
    label: { fr: "Nom de l'indépendant que vous aidez" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 1,
  },
  {
    // Le n° d'entreprise de l'indépendant aidé n'avait aucun champ : la case
    // (p1, y=342, sous son nom) est le premier widget de `TVA`, capté par Q16.
    // `TVA` couvrant les DEUX cases avec une seule valeur, écriture
    // positionnelle ici aussi — cf. le commentaire de `numeroEntreprise`.
    //
    // `printAsComb` (audit placement 2026-07-30, rapport
    // .superpowers/sdd/bce-peigne-report.md) : le guide imprimé sous cette
    // case n'est PAS un rectangle graphique mais dix glyphes du sous-jeu
    // `SymbolMT` (mesurés pdfplumber sur private/pdfs/C1A_FR.pdf, mode
    // `chars` — ce ne sont pas des `rects`/`lines`), groupés 4-3-3 comme le
    // format BCE 0123.456.789. Avant ce lot, le numéro s'imprimait en texte
    // plein compact, décalé par rapport aux dix cases. Abscisses mesurées des
    // dix glyphes : 113.88 / 126.90 / 139.92 / 152.94 (groupe 1), 172.02 /
    // 185.04 / 198.06 (groupe 2), 217.13 / 230.15 / 243.17 (groupe 3) — pas
    // constant de 13.02 pt, écart supplémentaire de 6.06 pt aux deux ruptures
    // de groupe (mesure identique aux deux ruptures, à 0.003 pt près).
    // `drawAt.x` déplacé de 115 (ancien calage texte-plein, formule
    // rect.x0+2) à 113.88 (abscisse RÉELLE de la 1re case) : les deux calages
    // divergent légèrement car ils répondent à des questions différentes (où
    // commencer un bloc de texte compact / où poser le 1er caractère d'un
    // peigne).
    //
    // `drawAt.y` RELEVÉ de 338 à 343 (+5) : l'ancien 338 était correct pour du
    // TEXTE PLEIN (aucun défaut vertical relevé par l'audit précédent, la
    // ligne de base traversait juste la bande du guide sans que ça choque,
    // faute de correspondance case-par-case à respecter). En mode peigne,
    // chaque tiret SymbolMT mesure lui-même un bloc de 9 pt de haut
    // (338.60-347.60 pour celui-ci) : à y=338, la ligne de base tombe SOUS ce
    // bloc, et le tiret traverse le chiffre en son MILIEU au rendu (constaté
    // à l'écran, PDF de test généré) — lisible mais peu soigné. Recalibré à
    // l'œil (5 candidats rendus avec la police et le pipeline réels, de 338 à
    // 345) contre l'esthétique du peigne NISS déjà validée par Oraliks
    // (`seed/c1/identite.ts`, chiffre posé SUR son tiret, jamais traversé) :
    // 343 pose chaque chiffre juste au-dessus de son tiret, comme le NISS.
    id: "independantNumeroEntreprise",
    pdfFieldName: "",
    drawAt: { page: 0, x: 113.88, y: 343, size: 9, maxWidth: 134 },
    printAsComb: { groups: [4, 3, 3], slotWidth: 13.02, groupExtra: 6.06 },
    type: "bce",
    required: false,
    label: { fr: "Numéro d'entreprise de l'indépendant que vous aidez" },
    help: {
      fr: "Numéro à la Banque-Carrefour des Entreprises, au format 0123.456.789.",
    },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 2,
  },
  {
    // `Adresse de lactivité indépendante` est posé sur la ligne « rue numéro »
    // (widget y=308, ligne y=315) : c'est une case de saisie, pas un libellé —
    // d'où le renommage de l'identifiant. Ancien id : `adresseActiviteIndependanteLabel`
    // (cf. LEGACY_C1A_FIELD_IDS, même widget).
    id: "independantAdresseRueNumero",
    pdfFieldName: "Adresse de lactivité indépendante",
    type: "text",
    required: false,
    label: { fr: "Adresse de l'activité indépendante — rue et numéro" },
    help: { fr: "Rue et numéro où l'indépendant exerce son activité." },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 3,
  },
  {
    // `rue_2` est la ligne SUIVANTE (y=284), celle du code postal et de la
    // commune — pas une suite de la rue. Ancien id : `independantAdresseRue`
    // (cf. LEGACY_C1A_FIELD_IDS, même widget).
    id: "independantAdresseCodePostalCommune",
    pdfFieldName: "rue_2",
    type: "text",
    required: false,
    label: { fr: "Code postal et commune de l'activité indépendante" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 4,
  },
  {
    // Consolidé en UN champ répétable (Commit 2, retour Oraliks 2026-07-29 :
    // « mets une seule nature, description, et ajoute un + explicite pour
    // ajouter d'autres natures »). Les 5 lignes fixes affichées d'un coup
    // étaient presque toujours vides à l'écran. Le PDF n'offre que 5 lignes
    // imprimées ("mentionnez les toutes 1" à "5", cf. `pdfFieldNameTemplate`
    // ci-dessous) : `maxRows` empêche d'en saisir une 6e qui ne
    // s'imprimerait nulle part.
    id: "natureActiviteIndependant",
    pdfFieldName: "",
    type: "array",
    // `required: true` (2026-07-29, après levée de la limite array —
    // commit 28debed : `isArrayFieldFilled` dans validation.ts exige
    // désormais AU MOINS UNE ligne réellement remplie, appliqué à la fois
    // par `buildValidator` — superRefine, blocage à l'envoi — et par
    // `isFieldComplete`/`countRequirements` — compteur du stepper). Une
    // ligne vierge fraîchement ajoutée ne compte pas. Protégé par le
    // `visibleIf` ci-dessous (dérivé de l'arbre via le rattachement à
    // `independantNom`, cf. RATTACHEMENTS plus bas) : répondre « non » à
    // Q1 masque le champ, donc `buildValidator` ne le vérifie jamais.
    required: true,
    label: { fr: "Nature de l'activité de l'indépendant" },
    help: {
      fr: "Si l'indépendant exerce plusieurs activités, ajoutez une ligne par activité — le formulaire officiel en offre quatre.",
    },
    addRowLabel: { fr: "Ajouter une autre nature d'activité" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 5,
    // QUATRE lignes, et non cinq (2026-08-02, relecture d'un PDF généré).
    //
    // Le papier n'imprime que quatre pointillés (y=229,6 / 214,6 / 199,6 /
    // 184,6, tous à x=42,3), mais l'AcroForm porte CINQ widgets : « mentionnez
    // les toutes 4 » et « … 5 » sont posés sur la MÊME ligne, la dernière —
    // le premier décalé de 11 pt vers la droite (x=53,8 contre 42,8 pour les
    // quatre autres). Anomalie du PDF officiel, pas de notre mapping.
    //
    // À cinq lignes, les deux dernières activités s'imprimaient donc l'une
    // PAR-DESSUS l'autre, illisibles, sur une déclaration officielle. Le
    // template `mentionnez les toutes {index}` ne permet pas de sauter le
    // numéro 4 : la 4ᵉ ligne atterrit sur le widget décalé, soit onze points
    // trop à droite. C'est inélégant, mais lisible — et sans commune mesure
    // avec deux textes superposés.
    maxRows: 4,
    itemFields: [
      {
        id: "nature",
        pdfFieldName: "",
        type: "text",
        required: true,
        label: { fr: "Nature de l'activité" },
        // Liste EXPLICITE, et non le template : le PDF officiel numérote ces
        // quatre lignes 1, 2, 3 et **5**. Son widget n° 4 est un doublon posé
        // sur la même dernière ligne, décalé de onze points vers la droite —
        // c'est lui que `{index}` attrapait, d'où une 4ᵉ activité imprimée en
        // retrait des trois autres (relevé le 2026-08-02).
        pdfFieldNames: [
          "mentionnez les toutes 1",
          "mentionnez les toutes 2",
          "mentionnez les toutes 3",
          "mentionnez les toutes 5",
        ],
        order: 1,
      },
    ],
  },

  // ====================================================================
  // Q3 — AIDERAS-TU CET INDÉPENDANT PENDANT TON CHÔMAGE ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (aideIndependant=oui) —
    // tranche si la grille horaire Q4 et la suite de la rubrique s'appliquent.
    id: "aideraPendantChomage",
    pdfFieldName: "oui_2|non_2",
    type: "radio",
    required: true,
    label: { fr: "Aiderez-vous cet indépendant pendant votre chômage ?" },
    labelShort: { fr: "Pendant votre chômage ?" },
    help: {
      fr: "Répondez également « oui » si, durant des périodes de chômage temporaire, vous aidez cet indépendant (à partir du premier jour de chômage du mois concerné jusqu'à la fin du mois). Vous êtes chômeur temporaire si vous êtes toujours au service de votre employeur mais que temporairement vous ne travaillez pas, par exemple en raison d'un manque de travail ou d'intempéries.",
    },
    options: YN,
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    // 9.5 : reste strictement entre le bloc Q2 (jusqu'à l'order 5, le champ
    // array `natureActiviteIndependant` depuis le Commit 2) et la grille Q4
    // (order 10). Fractionnaire pour ne pas renuméroter toute la suite du
    // fichier (même convention que `numero`/`commune` en tête de fichier).
    order: 9.5,
  },

  // ====================================================================
  // Q4 — QUAND AIDERAS-TU CET INDÉPENDANT ? (grille horaire n°1)
  // ====================================================================
  ...grilleHoraire({
    idPrefix: "q4",
    questionLabel: "4. Quand aiderez-vous cet indépendant ?",
    parentId: "aideraPendantChomage",
    parentValue: "oui",
    section: SECTION_AIDE_INDEPENDANT,
    order: 10,
    suffixes: {
      lundi: "lundi", mardi: "mardi", mercredi: "mercredi", jeudi: "jeudi", vendredi: "vendredi",
      samedi: "samedi", dimanche: "dimanche",
      avant7h: ["avant 7 h", "avant 7 h_2", "avant 7 h_3", "avant 7 h_4", "avant 7 h_5"],
      entre7h18h: ["entre 7 h et 18 h", "entre 7 h et 18 h_2", "entre 7 h et 18 h_3", "entre 7 h et 18 h_4", "entre 7 h et 18 h_5"],
      apres18h: ["après 18 h", "après 18 h_2", "après 18 h_3", "après 18 h_4", "après 18 h_5"],
      touteLannee: "toute lannée",
      pendantPeriodes: "pendant les périodes suivantes de lannée",
      irregulierement: "irrégulièrement à savoir",
    },
    // Géométrie réelle mesurée sur private/pdfs/C1A_FR.pdf (page 1, colonne
    // de droite, widgets bruts) :
    //   y=633 case "pendant les périodes suivantes de l'année"
    //   y=621 "1"   y=607 "2"   y=594 "3"   y=581 "4"        (4 lignes)
    //   y=568 case "irrégulièrement à savoir"   y=568 "undefined" (x=432)
    //   y=555 "1_2" y=542 "2_2" y=529 "3_2" y=516 "4_2"      (4 lignes)
    // Le widget "undefined" est à la MÊME hauteur que la case
    // "irrégulièrement" : c'est la fin de la ligne imprimée
    // « irrégulièrement, à savoir : ...... », pas une 5e ligne de
    // "périodes". L'ancienne répartition (5 lignes périodes / 4 lignes
    // irrégulier) décalait donc tout le bloc "irrégulier" d'une ligne :
    // qui cochait "irrégulièrement" et décrivait son rythme voyait la ligne
    // imprimée partir blanche, et qui remplissait les 5 lignes "périodes"
    // déclarait un rythme irrégulier jamais coché — une déclaration ONEM
    // fausse dans les deux cas.
    periodesTextFields: ["1", "2", "3", "4"],
    irregulierementTextFields: ["undefined", "1_2", "2_2", "3_2", "4_2"],
  }),

  // ====================================================================
  // Q5 — DÉCRIVEZ L'AIDE QUE VOUS APPORTEREZ
  // ====================================================================
  {
    // UN SEUL champ `textarea` (2026-07-30, retour Oraliks après test sur ce
    // lot : « fais plutôt un input texte plus grand comme t'as fait aux
    // autres, c'est plus propre » — le champ `array` du Commit 2 affichait
    // encore une mécanique de liste ("Ligne 1", "Ligne 2"…, bouton
    // "+ Ajouter") pour ce qui n'est qu'un paragraphe). Le citoyen écrit
    // librement dans un seul textarea ; `lineTargets` porte les 9 lignes
    // pointillées imprimées ("Décrivez laide que vous apporterez 1" à "9",
    // vérifiées une à une sur le vrai PDF), dans l'ordre, et `filler.ts` y
    // replie le texte par mots — même mécanisme que les grilles horaires
    // Q4/Q18 ci-dessus (repli de taille sur la 9e cible en cas de
    // débordement, jamais de perte silencieuse).
    //
    // id conservé à `descriptionAide1` : c'est l'ANCRE de Q5 dans
    // C1A_ROUTAGE (cf. c1a-routing.ts), sa condition est remplacée par
    // `appliquerRoutage` plus bas — même convention que
    // `revenuNetSalarieParMois`, ancre de Q19. La renommer casserait la
    // table de routage (hors périmètre de ce lot).
    //
    // `required: true` (hérité du Commit 3 puis de la levée de limite
    // commit 28debed) : la validation passe désormais par la règle standard
    // `textarea` (chaîne non vide) au lieu de `isArrayFieldFilled` ("au
    // moins une ligne réellement remplie") — le comportement observable par
    // le citoyen ne change pas (toujours obligatoire), seule la mécanique de
    // validation change de famille avec le type du champ. `visibleIf` est de
    // toute façon REMPLACÉ (pas empilé) par `appliquerRoutage` : répondre
    // « non » à Q1 (ou « non » à Q3) masque le champ dans tous les cas.
    //
    // Plus de `help` : l'ancien texte ("ajoutez une ligne par tâche")
    // décrivait le bouton "+ Ajouter" du champ array, disparu avec lui — ni
    // le PDF ni ce lot n'en fournissent de remplacement, même parti pris que
    // les deux textarea de grille horaire ci-dessus (aucun `help`).
    id: "descriptionAide1",
    pdfFieldName: "",
    lineTargets: [
      "Décrivez laide que vous apporterez 1",
      "Décrivez laide que vous apporterez 2",
      "Décrivez laide que vous apporterez 3",
      "Décrivez laide que vous apporterez 4",
      "Décrivez laide que vous apporterez 5",
      "Décrivez laide que vous apporterez 6",
      "Décrivez laide que vous apporterez 7",
      "Décrivez laide que vous apporterez 8",
      "Décrivez laide que vous apporterez 9",
    ].map((pdfFieldName) => ({ pdfFieldName })),
    type: "textarea",
    required: true,
    label: { fr: "Décrivez l'aide que vous apporterez" },
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 46,
  },

  // ====================================================================
  // Q6 — COMBIEN GAGNEZ-VOUS POUR VOTRE AIDE ?
  // ====================================================================
  {
    // Q6 attend un montant « par mois » OU « par an » sur une même ligne
    // pointillée. Le widget `Montant` couvre cette ligne ET les deux montants
    // de Q11 en page 2, avec une seule valeur partagée — donc inexploitable.
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (aideraPendantChomage=oui)
    // — le choix mois/an est LA question de Q6. Le montant lui-même
    // (montantAide/montantAideAnnuel) reste facultatif : rattachement, pas
    // une clé de l'arbre, et une aide peut être non chiffrée au moment de la
    // déclaration.
    id: "montantAidePeriodicite",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "Ce montant est :" },
    // Pas de `help` : les deux options recopient fidèlement les cases imprimées.
    options: [
      { value: "mois", label: { fr: "Par mois" } },
      { value: "an", label: { fr: "Par an" } },
    ],
    visibleIf: { fieldId: "aideraPendantChomage", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 54.5,
  },
  {
    id: "montantAide",
    pdfFieldName: "",
    // Moitié gauche de la ligne pointillée (y=315), au-dessus de « par mois ».
    drawAt: { page: 0, x: 322, y: 311, size: 9, maxWidth: 110 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Combien gagnez-vous pour votre aide ? (EUR)" },
    help: {
      fr: "Ou à combien s'élève la valeur de votre aide. Joignez une copie de la plus récente note de calcul de l'administration des contributions directes.",
    },
    visibleIf: { fieldId: "montantAidePeriodicite", op: "equals", value: "mois" },
    section: SECTION_REVENUS,
    order: 55,
  },
  {
    id: "montantAideAnnuel",
    pdfFieldName: "",
    // Moitié droite de la même ligne, avant la légende « par an » (x=503).
    drawAt: { page: 0, x: 440, y: 311, size: 9, maxWidth: 58 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Combien gagnez-vous pour votre aide ? (EUR)" },
    help: {
      fr: "Ou à combien s'élève la valeur de votre aide. Joignez une copie de la plus récente note de calcul de l'administration des contributions directes.",
    },
    visibleIf: { fieldId: "montantAidePeriodicite", op: "equals", value: "an" },
    section: SECTION_REVENUS,
    order: 55.5,
  },

  // ====================================================================
  // Q7 — AIDIEZ-VOUS DÉJÀ CET INDÉPENDANT DANS LE PASSÉ ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (aideIndependant=oui).
    id: "aidaitDejaIndependant",
    pdfFieldName: "oui_3|non_3",
    type: "radio",
    required: true,
    label: { fr: "Aidiez-vous déjà cet indépendant dans le passé ?" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    options: YN,
    visibleIf: { fieldId: "aideIndependant", op: "equals", value: "oui" },
    section: SECTION_AIDE_INDEPENDANT,
    order: 56,
  },

  // ====================================================================
  // Q8 — À PARTIR DE QUELLE DATE ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, donnée principale de Q8, visible
    // seulement si Q7 (aidaitDejaIndependant) = oui.
    id: "dateDebutAide",
    pdfFieldName: "Date41_af_date",
    type: "date",
    required: true,
    label: { fr: "À partir de quelle date aidiez-vous déjà cet indépendant ?" },
    // Pas de `help` : le label reprend déjà, mot pour mot, la question imprimée.
    visibleIf: { fieldId: "aidaitDejaIndependant", op: "equals", value: "oui" },
    // Guide « __ __ / __ __ / __ __ __ __ » sous-titré jour / mois / année.
    // Huit glyphes mesurés à x=316,7 → 406,5 : pas de 11,52 pt, +4,58 aux deux
    // ruptures. Sans peigne, « 01/09/2025 » s'imprimait d'un bloc sur les
    // quatre premières cases et les quatre autres restaient vides à droite.
    fontSize: 9,
    printAsComb: { groups: [2, 2, 4], slotWidth: 11.52, groupExtra: 4.58, startX: 0.8, baselineY: 1.1 },
    section: SECTION_AIDE_INDEPENDANT,
    order: 57,
  },

  // ====================================================================
  // Q9 — MANDAT POLITIQUE OU FONCTION DE JUGE/CONSEILLER
  // ====================================================================
  {
    id: "mandatPolitiqueOuJuge",
    pdfFieldName: "oui_4|non_4",
    type: "radio",
    required: true,
    label: {
      fr: "Exercez-vous un mandat politique ou une fonction de juge ou de conseiller ?",
    },
    labelShort: { fr: "Mandat politique ou fonction de juge ?" },
    help: {
      fr: "Si vous êtes conseiller communal, conseiller provincial, membre d'un C.P.A.S., juge social, juge consulaire ou conseiller social, répondez « non ».",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 58,
  },

  // ====================================================================
  // Q10/Q11 — MANDAT/FONCTION + REVENU ANNUEL NET IMPOSABLE
  // ====================================================================
  {
    // Q10 et Q11 n'ont AUCUN widget AcroForm (vérifié : rien en page 2, colonne
    // de gauche, entre y=690 et y=800). Écriture positionnelle sur les lignes
    // imprimées : Q10 occupe trois lignes entre y=779 et y=743, Q11 deux lignes
    // « EUR … EUR » à y=714 et y=702.
    //
    // Correctif mesure (audit placement 2026-07-30) : y=766 faisait chevaucher
    // la valeur avec la 2e ligne du libelle imprime lui-meme ("plus d'une
    // fonction, mentionnez les tous)", mesuree a y=770.14-779.14 sur le PDF
    // reel via pdfplumber, chars DejaVuSans) -- un recouvrement mesure de
    // 2.74 pt entre les deux boites de texte, confirme par relecture visuelle
    // du PDF genere (la reponse s'imprimait collee sous la question, sans
    // aucun espace). y=755 degage une marge mesuree des deux cotes : ~8.3 pt
    // sous le bas du libelle (770.14) et ~9.8 pt au-dessus de "voir 11" (case
    // imprimee vers y=734-743). Coordonnee X et maxWidth inchanges (mesures
    // sans defaut : aucun chevauchement horizontal constate).
    id: "mandatDescription",
    pdfFieldName: "",
    drawAt: { page: 1, x: 50, y: 755, size: 9, maxWidth: 236 },
    type: "text",
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (mandatPolitiqueOuJuge=oui).
    required: true,
    label: { fr: "Quel mandat ou quelle fonction ?" },
    help: {
      fr: "Si vous exercez plus d'un mandat ou avez plus d'une fonction, mentionnez-les tous.",
    },
    visibleIf: { fieldId: "mandatPolitiqueOuJuge", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 59,
  },
  {
    // Q11 imprime deux lignes de montant, matérialisées par les 2ᵉ et 3ᵉ
    // widgets du champ `Montant` — dont le 1ᵉʳ est le montant de Q6, en page 1.
    // Une seule valeur pour les trois : écriture positionnelle obligatoire.
    id: "revenuAnnuelMandat",
    pdfFieldName: "",
    drawAt: { page: 1, x: 69, y: 706, size: 9, maxWidth: 62 },
    type: "number",
    numberFormat: "money",
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (mandatPolitiqueOuJuge=oui) —
    // 1er montant de Q11. Le second (revenuAnnuelMandat2, cas d'un 2e mandat)
    // reste facultatif : rattachement, pas une clé de l'arbre.
    required: true,
    label: { fr: "Revenu annuel net imposable de ce mandat (EUR)" },
    help: {
      fr: "Joignez une copie de la plus récente note de calcul de l'administration des contributions directes.",
    },
    visibleIf: { fieldId: "mandatPolitiqueOuJuge", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 60,
  },
  {
    // A VALIDER Oraliks : la seconde ligne de Q11. Le formulaire prévoit deux
    // montants sans préciser à l'impression ce qui les distingue — un second
    // mandat, ou une seconde composante du même revenu.
    id: "revenuAnnuelMandat2",
    pdfFieldName: "",
    drawAt: { page: 1, x: 69, y: 694, size: 9, maxWidth: 62 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Second montant, si vous exercez plus d'un mandat (EUR)" },
    // Pas de `help` : l'ambiguïté du PDF ci-dessus (« A VALIDER Oraliks »)
    // empêche d'écrire une explication fiable — inventer une précision ici
    // trancherait silencieusement une question ouverte.
    visibleIf: { fieldId: "mandatPolitiqueOuJuge", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 60.5,
  },

  // ====================================================================
  // Q12 — EXERCEZ-VOUS UNE AUTRE ACTIVITÉ À TITRE ACCESSOIRE ?
  // ====================================================================
  {
    id: "autreActiviteAccessoire",
    pdfFieldName: "oui_5|non_5",
    type: "radio",
    required: true,
    label: { fr: "Exercez-vous une autre activité à titre accessoire ?" },
    labelShort: { fr: "Autre activité accessoire ?" },
    help: {
      fr: "Répondez toujours « oui » si vous êtes inscrit comme indépendant à titre accessoire ou si vous êtes administrateur de société. Complétez un formulaire C1A pour chaque activité que vous exercez.",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 61,
  },

  // ====================================================================
  // Q13 — EXERCEZ-VOUS CETTE ACTIVITÉ COMME SALARIÉ ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (autreActiviteAccessoire=oui).
    id: "activiteCommeSalarie",
    pdfFieldName: "oui_6|non_6",
    type: "radio",
    required: true,
    label: { fr: "Exercez-vous cette activité comme salarié ?" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 62,
  },

  // ====================================================================
  // Q14 — DONNÉES CONCERNANT VOTRE EMPLOYEUR
  // ====================================================================
  {
    // Le widget porte le nom du TITRE imprimé au-dessus de lui ("14. Données
    // concernant votre employeur"), mais il est posé sur la 1ʳᵉ ligne de
    // saisie — celle légendée « nom » juste en dessous (widget y=500, ligne
    // imprimée y=507, légende y=498). C'est bien la case du NOM.
    //
    // Un commentaire antérieur le tenait pour un intitulé de zone et le
    // laissait non référencé : la ligne du nom partait donc vide à l'ONEM.
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (activiteCommeSalarie=oui),
    // donnée principale de Q14. L'adresse employeur (employeurAdresse) reste
    // facultative : rattachement, pas une clé de l'arbre.
    id: "employeurNom",
    pdfFieldName: "14 Données concernant votre employeur",
    type: "text",
    required: true,
    label: { fr: "Nom de votre employeur" },
    help: { fr: "Tapez le nom pour rechercher votre employeur — son adresse se remplira automatiquement." },
    enterpriseAutocomplete: { addressFieldId: "employeurAdresse" },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_EMPLOYEUR,
    order: 63,
  },
  {
    // Même décalage : le widget nommé « Nom employeur » est posé sur la 2ᵉ
    // ligne, légendée « adresse » (widget y=477, ligne imprimée y=484).
    id: "employeurAdresse",
    pdfFieldName: "Nom employeur",
    type: "text",
    required: false,
    label: { fr: "Adresse de votre employeur" },
    help: { fr: "Adresse du siège social — à corriger si vous travailliez ailleurs." },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_EMPLOYEUR,
    order: 64,
  },

  // ====================================================================
  // Q15 — À QUELLE ADRESSE EXERCEZ-VOUS CETTE ACTIVITÉ ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (autreActiviteAccessoire=oui,
    // atteint que Q13 réponde oui ou non), donnée principale de Q15.
    id: "adresseActivite",
    pdfFieldName: "A quelle adresse exercezvous cette activité",
    type: "text",
    required: true,
    label: { fr: "À quelle adresse exercez-vous cette activité ? — rue et numéro" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 65,
  },
  {
    // `rue_3` est la 2ᵉ ligne de Q15, légendée « code postal commune »
    // (widget y=398, ligne imprimée y=405). Elle était affectée à l'adresse de
    // l'employeur (Q14), et ce champ-ci écrivait dans `undefined_2`, qui est en
    // réalité la 1ʳᵉ ligne de description d'activité de Q16. Ancien id :
    // `adresseActiviteNumero` (cf. LEGACY_C1A_FIELD_IDS, widget aussi corrigé).
    id: "adresseActiviteCodePostalCommune",
    pdfFieldName: "rue_3",
    type: "text",
    required: false,
    label: { fr: "Code postal et commune (activité accessoire)" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ADRESSE,
    order: 66,
  },

  // ====================================================================
  // Q16 — J'EXERCE L'ACTIVITÉ COMME... + NUMÉRO D'ENTREPRISE
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (autreActiviteAccessoire=oui).
    id: "formeActivite",
    pdfFieldName: "personne phys|mandataire administrateur ou gestionnaire",
    type: "radio",
    required: true,
    label: { fr: "J'exerce l'activité comme :" },
    // Pas de `help` : les deux options recopient fidèlement les cases imprimées.
    options: [
      { value: "personne-physique", label: { fr: "Personne physique" } },
      { value: "mandataire", label: { fr: "Mandataire, administrateur ou gestionnaire" } },
    ],
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 67,
  },
  {
    id: "disposeNumeroEntreprise",
    pdfFieldName: "toggle_8|non_7",
    type: "radio",
    required: false,
    label: { fr: "Je dispose d'un numéro d'entreprise :" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    options: YN,
    visibleIf: { fieldId: "formeActivite", op: "equals", value: "mandataire" },
    section: SECTION_ACTIVITES,
    order: 68,
  },
  {
    // Le champ `TVA` porte DEUX widgets : la case n° d'entreprise de Q2 (p1,
    // y=342, celle de l'indépendant aidé) et celle de Q16 (p2, y=302, celle de
    // l'activité). Ils partagent une seule valeur — écrire dans l'un remplit
    // l'autre. Ce champ écrivait donc le n° de l'activité DANS LES DEUX cases,
    // y compris celle de l'indépendant qu'on aide.
    //
    // Aucune réattribution ne peut résoudre ça : les deux questions passent en
    // écriture positionnelle et `TVA` reste non revendiqué.
    //
    // `printAsComb` (audit placement 2026-07-30, rapport
    // .superpowers/sdd/bce-peigne-report.md) : même guide imprimé que
    // `independantNumeroEntreprise` ci-dessus (dix glyphes `SymbolMT`,
    // groupes 4-3-3), mesuré séparément sur cette 2e occurrence (page 2) pour
    // ne pas supposer une géométrie identique sans vérifier. Abscisses
    // mesurées : 118.32 / 131.34 / 144.36 / 157.38 (groupe 1), 176.46 /
    // 189.48 / 202.50 (groupe 2), 221.58 / 234.60 / 247.62 (groupe 3) — même
    // pas (13.02 pt) et même écart de rupture (6.06 pt) qu'en page 1, à
    // 0.003 pt près (confirme un même guide dupliqué par le gabarit source,
    // pas une coïncidence de mesure). `drawAt.x` déplacé de 119 (ancien
    // calage texte-plein) à 118.32 (abscisse RÉELLE de la 1re case).
    //
    // `drawAt.y` RELEVÉ de 298 à 303 (+5, même delta qu'`independantNumeroEntreprise`
    // ci-dessus — même tiret SymbolMT, même taille, seule l'ordonnée absolue
    // diffère d'une page à l'autre) : même raison que ci-dessus, confirmée
    // séparément par rendu sur cette 2e occurrence (candidat 303 rendu et
    // comparé à l'esthétique du peigne NISS avant de figer la valeur).
    id: "numeroEntreprise",
    pdfFieldName: "",
    drawAt: { page: 1, x: 118.32, y: 303, size: 9, maxWidth: 155 },
    printAsComb: { groups: [4, 3, 3], slotWidth: 13.02, groupExtra: 6.06 },
    type: "bce",
    required: false,
    label: { fr: "Numéro d'entreprise (BCE)" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    visibleIf: { fieldId: "disposeNumeroEntreprise", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 69,
  },
  {
    // « Je décris mon activité » occupe TROIS lignes pointillées imprimées.
    // Vérifié sur le vrai PDF (private/pdfs/C1A_FR.pdf, page 2, colonne de
    // gauche) : la 1re est le widget `undefined_2` (rect y=287.28, nom
    // trompeur — ce n'est PAS un champ non résolu, juste le nom que porte ce
    // widget dans le PDF), posé sur la ligne qui prolonge le libellé ; puis
    // `Je décris mon activité 1` (y=274.32) et `Je décris mon activité 2`
    // (y=261.24), dans cet ordre strictement décroissant. Les trois lignes
    // partagent la même largeur utile (~236 pt).
    //
    // UN SEUL champ `textarea` (2026-07-30, retour Oraliks après test :
    // « input texte plus grand au lieu de 3× "décris mon activité" ») — avant
    // ce lot, trois champs distincts affichaient « Je décris mon activité »,
    // « … (suite) », « … (fin) », des libellés inventés pour numéroter des
    // lignes qui n'ont qu'une seule question imprimée derrière elles.
    // `lineTargets` porte les trois widgets ci-dessus, dans l'ordre du
    // document, et `filler.ts` y replie le texte par mots — même mécanisme
    // que Q5 et les grilles horaires Q4/Q18 (repli de taille sur la 3e cible
    // en cas de débordement, jamais de perte silencieuse).
    //
    // id conservé à `descriptionActivite1` (celui de l'ex-1re ligne) : il
    // reste listé dans RATTACHEMENTS (question `formeActivite`, cf. plus
    // bas), seul survivant du trio — `descriptionActivite2` et
    // `descriptionActivite3` disparaissent, purgés via
    // `LEGACY_C1A_FIELD_IDS` pour un brouillon déjà en base.
    id: "descriptionActivite1",
    pdfFieldName: "",
    lineTargets: ["undefined_2", "Je décris mon activité 1", "Je décris mon activité 2"].map(
      (pdfFieldName) => ({ pdfFieldName }),
    ),
    type: "textarea",
    required: false,
    label: { fr: "Je décris mon activité" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 70,
  },

  // ====================================================================
  // Q17 — EXERCEREZ-VOUS CETTE ACTIVITÉ PENDANT VOTRE CHÔMAGE ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (autreActiviteAccessoire=oui)
    // — tranche si la grille horaire Q18 et Q19-Q21 s'appliquent.
    id: "exerceraPendantChomage",
    pdfFieldName: "oui_7|non_8",
    type: "radio",
    required: true,
    label: { fr: "Exercerez-vous cette activité pendant votre chômage ?" },
    labelShort: { fr: "Pendant votre chômage ?" },
    help: {
      fr: "Répondez également « oui » si vous exercerez cette activité pendant des périodes de chômage temporaire auprès de votre employeur (à partir du premier jour de chômage du mois concerné jusqu'à la fin du mois). Vous êtes chômeur temporaire si vous êtes toujours au service de votre employeur mais que temporairement vous ne travaillez pas, par exemple en raison d'un manque de travail ou d'intempéries.",
    },
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    // 72.5 : reste strictement après le bloc Q16 ci-dessus (une seule ligne
    // désormais, order 70, depuis sa consolidation en textarea le
    // 2026-07-30) sans renuméroter toute la grille horaire Q18 qui suit
    // (base 73, cf. plus bas). Valeur historique conservée telle quelle —
    // aucune raison de la resserrer à 71 tant qu'elle reste entre les deux.
    order: 72.5,
  },

  // ====================================================================
  // Q18 — QUAND EXERCEREZ-VOUS CETTE ACTIVITÉ ? (grille horaire n°2)
  // ====================================================================
  ...grilleHoraire({
    idPrefix: "q18",
    questionLabel: "18. Quand exercerez-vous cette activité ?",
    parentId: "exerceraPendantChomage",
    parentValue: "oui",
    section: SECTION_ACTIVITES,
    order: 73,
    suffixes: {
      lundi: "lundi_2", mardi: "mardi_2", mercredi: "mercredi_2", jeudi: "jeudi_2", vendredi: "vendredi_2",
      samedi: "samedi_2", dimanche: "dimanche_2",
      avant7h: ["avant 7 h_6", "avant 7 h_7", "avant 7 h_8", "avant 7 h_9", "avant 7 h_10"],
      entre7h18h: ["entre 7 h et 18 h_6", "entre 7 h et 18 h_7", "entre 7 h et 18 h_8", "entre 7 h et 18 h_9", "entre 7 h et 18 h_10"],
      apres18h: ["après 18 h_6", "après 18 h_7", "après 18 h_8", "après 18 h_9", "après 18 h_10"],
      touteLannee: "toute lannée_3",
      pendantPeriodes: "pendant les périodes suivantes de lannée_2",
      irregulierement: "irrégulièrement à savoir_2",
    },
    // 6 lignes de texte libre identifiées après la grille Q18 (ordre 98-103 :
    // "2_3","3_3","4_3","1_4","2_4","3_4") + 1 ligne isolée en fin de dump
    // ("1_3", ordre 130), logiquement la 1re ligne de "pendant les périodes"
    // de Q18 (numérotation [1] manquante dans le groupe 98-103, qui commence
    // directement à [2]).
    //
    // "1_3" est en réalité un widget PARTAGÉ (confirmé via pypdf/`/Kids`,
    // audit du 2026-07-29) : le même champ AcroForm couvre AUSSI les deux
    // cases d'en-tête de la page 2 — nom et NISS (rects [293,799,560,809] et
    // [109,799,265,812]). Écrire dans cette ligne imprimait donc le texte
    // saisi ici dans la case du numéro de registre national du citoyen : une
    // déclaration officielle faussée. Même famille de défaut que
    // `TVA`/`Montant`/`voir 19` ci-dessus : écriture positionnelle, "1_3"
    // reste non revendiqué par qui que ce soit (et les deux cases d'en-tête
    // restent blanches comme aujourd'hui — les y écrire est une décision
    // séparée, hors de ce correctif).
    //
    // Calage mesuré sur le rect réel du widget "1_3" ([335,753,557,764], soit
    // 222 pt de large) selon la MÊME convention que les `drawAt` déjà en
    // place sur cette page pour des lignes de même gabarit — vérifiée à
    // l'identique (x = arrondi(rect.x0) + 2, y = arrondi(rect.y0) − 4) sur
    // `independantNumeroEntreprise`/`numeroEntreprise` (TVA) et sur
    // `revenuAnnuelMandat`/`revenuAnnuelMandat2` (Montant, mêmes lignes
    // pointillées « EUR » de la page 2) : le texte s'imprime ainsi ~2 pt sous
    // les pointillés imprimés, pas au-dessus.
    //
    // Vérification du défaut du Commit 1 ci-dessus (décalage périodes /
    // irrégulier d'une ligne sur Q4) : Q18 n'a PAS le même défaut. Géométrie
    // mesurée (page 2, colonne de droite) : case "pendant les périodes..."
    // à y=766, puis 1_3/2_3/3_3/4_3 à y=753/740/727/714 (4 lignes) ; case
    // "irrégulièrement à savoir_2" à y=699 SEULE sur sa ligne — aucun widget
    // texte n'y est superposé (contrairement au "undefined" de Q4 à côté de
    // sa case) — puis 1_4/2_4/3_4 à y=686/673/660 (3 lignes) ; le widget
    // suivant est "voir 19" (y=647), déjà rattaché à Q19 plus bas. Le PDF ne
    // fournit donc ici aucune ligne partagée à réattribuer : la répartition
    // 4 lignes périodes / 3 lignes irrégulier ci-dessous est déjà correcte.
    periodesTextFields: [
      { pdfFieldName: "", drawAt: { page: 1, x: 337, y: 749, size: 9, maxWidth: 218 } },
      "2_3", "3_3", "4_3",
    ],
    // QUATRE lignes, et non trois (2026-08-02). Le papier en imprime quatre
    // sous « irrégulièrement, à savoir » (pointillés à y=684 / 671 / 658 /
    // 645) ; le seed n'en câblait que trois. La quatrième EXISTE bien comme
    // widget — c'est le premier des quatre rectangles du champ « voir 19 »,
    // que le passage précédent avait rattaché à Q19 sur la foi de son nom.
    // Or il est aligné sur les trois autres (x=334,6) et treize points sous
    // « 3_4 » : c'est la ligne suivante du MÊME bloc, pas une case de Q19.
    //
    // Le revendiquer par son nom stamperait ses quatre rectangles — dont les
    // deux cases de revenus de Q19. D'où l'écriture positionnelle, calée comme
    // la première ligne de `periodesTextFields` juste au-dessus.
    irregulierementTextFields: [
      "1_4",
      "2_4",
      "3_4",
      { pdfFieldName: "", drawAt: { page: 1, x: 337, y: 643, size: 9, maxWidth: 218 } },
    ],
  }),

  // ====================================================================
  // Q19 — QUEL EST LE REVENU NET DE VOTRE ACTIVITÉ ?
  // ====================================================================
  {
    // Les trois cases de revenu de Q19 appartiennent au champ AcroForm
    // « voir 19 », qui porte QUATRE widgets partageant une seule valeur — donc
    // inutilisable pour trois montants distincts. Écriture positionnelle.
    // Coordonnées mesurées : ligne « par mois : … EUR / par heure : … EUR »
    // imprimée à y=567, ligne « par an : … » à y=497.
    //
    // `required` reste `false` (Commit 3, décision volontaire) bien que ce
    // soit une clé C1A_ROUTAGE : sa condition compilée est
    // "exerceraPendantChomage=oui AND autreActiviteAccessoire=oui" SEULE — la
    // Task 13 (2026-07-28) a délibérément retiré le garde-fou
    // `activiteCommeSalarie` pour garder « par mois »/« par heure » sur la
    // même ligne imprimée. Résultat : ce champ (et ses frères parHeure/
    // parAn) sont visibles pour TOUT citoyen ayant une activité accessoire
    // pendant son chômage, salarié OU indépendant. Le rendre `required`
    // forcerait donc un indépendant pur à renseigner un revenu « salarié »
    // qui ne le concerne pas — une case remplie hors de propos plutôt que
    // vide, le même risque qu'un remplissage au mauvais endroit. Le
    // mécanisme qui poserait « au moins un des 3 montants » proprement
    // (`requiredGroup`) est explicitement écarté pour le C1A (cf. plus haut).
    id: "revenuNetSalarieParMois",
    pdfFieldName: "",
    drawAt: { page: 1, x: 360, y: 563, size: 9, maxWidth: 62 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Revenu net comme salarié — par mois (EUR)" },
    help: {
      fr: "Montant brut diminué des cotisations de sécurité sociale et du précompte professionnel retenus à la source par l'employeur (rémunération mensuelle normale, mais aussi pécule de vacances, 13ᵉ mois et avantages en nature éventuels). Indiquez jusqu'à 2 chiffres après la virgule.",
    },
    visibleIf: { fieldId: "activiteCommeSalarie", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 140,
  },
  {
    // Pas de visibleIf propre (2026-07-28, correctif) : « par mois » et
    // « par heure » sont la MÊME ligne imprimée. `revenuNetSalarieParMois` est
    // l'ancre de Q19 dans l'arbre de routage — sa condition écrite ci-dessus
    // sur ce champ-frère serait de toute façon remplacée par celle de la
    // branche (Q17 ET Q12), donc sans garde-fou `activiteCommeSalarie`. Garder
    // ce garde-fou UNIQUEMENT ici cassait la ligne en deux : un indépendant
    // voyait « par mois » sans « par heure ». Cohérent avec la Task 13 : la
    // grille reproduit le papier, où rien ne disparaît selon Q13.
    id: "revenuNetSalarieParHeure",
    pdfFieldName: "",
    drawAt: { page: 1, x: 487, y: 563, size: 9, maxWidth: 46 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Revenu net comme salarié — par heure (EUR)" },
    help: { fr: "Indiquez jusqu'à 4 chiffres après la virgule." },
    section: SECTION_REVENUS,
    order: 141,
  },
  {
    id: "revenuNetIndependantParAn",
    pdfFieldName: "",
    drawAt: { page: 1, x: 350, y: 493, size: 9, maxWidth: 185 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Revenu net comme indépendant — par an (EUR)" },
    help: {
      fr: "Revenu imposable indiqué sur l'avertissement-extrait de rôle et la note de calcul (recettes diminuées des charges, dépenses et pertes professionnelles). Joignez une copie de la plus récente note de calcul de l'administration des contributions directes.",
    },
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_REVENUS,
    order: 142,
  },

  // ====================================================================
  // Q20 — EXERCIEZ-VOUS DÉJÀ CETTE ACTIVITÉ DANS LE PASSÉ ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, chemin unique (autreActiviteAccessoire=oui).
    id: "exerceDejaActivite",
    pdfFieldName: "oui_8|non_9",
    type: "radio",
    required: true,
    label: { fr: "Exerciez-vous déjà cette activité dans le passé ?" },
    // Pas de `help` : le label EST déjà la question complète imprimée.
    options: YN,
    visibleIf: { fieldId: "autreActiviteAccessoire", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 150,
  },

  // ====================================================================
  // Q21 — DEPUIS QUAND ?
  // ====================================================================
  {
    // Required (Commit 3) : clé C1A_ROUTAGE, donnée principale de Q21, visible
    // seulement si Q20 (exerceDejaActivite) = oui.
    id: "dateDebutActivite",
    pdfFieldName: "Date43_af_date",
    type: "date",
    required: true,
    label: { fr: "Depuis quand exercez-vous cette activité ?" },
    // Pas de `help` : le label reprend déjà, mot pour mot, la question imprimée.
    visibleIf: { fieldId: "exerceDejaActivite", op: "equals", value: "oui" },
    // Même guide que Q8, sur la page 2 : huit glyphes à x=323,0 → 412,8.
    fontSize: 9,
    printAsComb: { groups: [2, 2, 4], slotWidth: 11.52, groupExtra: 4.58, startX: 0.1, baselineY: 1.4 },
    section: SECTION_ACTIVITES,
    order: 151,
  },

  // ====================================================================
  // Q22 — JOURS HABITUELLEMENT OCCUPÉ CHEZ L'EMPLOYEUR (CHÔMEUR TEMPORAIRE)
  // ====================================================================
  {
    // Q22 imprime « À COMPLÉTER UNIQUEMENT SI VOUS ÊTES CHÔMEUR TEMPORAIRE »
    // sans qu'aucune question n'établisse le statut : les sept cases
    // s'affichaient à tout le monde. Cette question n'existe pas sur le papier
    // (d'où l'absence de widget) — elle matérialise la consigne imprimée.
    //
    // La définition affichée est celle imprimée DEUX FOIS sur le formulaire,
    // sous Q3 et sous Q17.
    //
    // `order` 159 et non 100 comme prévu au plan : la numérotation a été refaite
    // en ordre de lecture, et 100 tombe désormais au milieu de la grille horaire
    // de Q18 (73→102). 159 la place juste avant `joursOccupeLundi` (160).
    id: "estChomeurTemporaire",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "Êtes-vous chômeur temporaire ?" },
    labelShort: { fr: "Chômeur temporaire ?" },
    help: {
      fr: "Vous êtes chômeur temporaire si vous êtes toujours au service de votre employeur mais que temporairement vous ne travaillez pas, par exemple en raison d'un manque de travail ou d'intempéries.",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 159,
  },
  {
    // `required` reste `false` (Commit 3, même décision que les grilles
    // horaires Q4/Q18 ci-dessus) : aucun jour précis n'a de raison objective
    // d'être obligatoire, et Q22 n'a pas d'équivalent au radio "période" (pas
    // de résumé de fréquence à côté des 7 cases) sur lequel reporter une
    // exigence. `requiredGroup` reste écarté pour la même raison qu'ailleurs
    // sur ce formulaire.
    // `visibleIf` écrit en clair (2026-07-29) : les sept jours étaient jusqu'ici
    // conditionnés par l'arbre, via un nœud `joursOccupeLundi` dont ils
    // dépendaient. Ce nœud a disparu (une question = une étape : il aurait
    // produit une étape intitulée « Lundi »), la rubrique entière est
    // désormais rattachée à `estChomeurTemporaire`. La condition est donc
    // portée ici — elle est directe, et `estChomeurTemporaire` est posée sur
    // tous les chemins : aucune condition transitive à dériver.
    id: "joursOccupeLundi",
    pdfFieldName: "lu",
    type: "checkbox",
    required: false,
    label: { fr: "Lundi" },
    // Pas de `help` : le nom du jour EST déjà toute l'information ; le
    // contexte (« chômeur temporaire ») est expliqué par estChomeurTemporaire.
    visibleIf: VISIBLE_SI_CHOMEUR_TEMPORAIRE,
    section: SECTION_ACTIVITES,
    order: 160,
    // Sept jours SANS créneau : même tableau que Q4/Q18 (cf. `scheduleGrid`
    // dans types.ts) mais où aucun champ ne porte jamais `col` — il se rend
    // donc à une seule colonne "jour", plutôt qu'une rangée de cases séparée
    // à maintenir en plus (un seul composant de rendu, cf. pdf-form-runner.tsx).
    scheduleGrid: { row: "lundi" },
  },
  {
    id: "joursOccupeMardi",
    pdfFieldName: "ma",
    type: "checkbox",
    required: false,
    label: { fr: "Mardi" },
    // Pas de `help` : le nom du jour EST déjà toute l'information ; le
    // contexte (« chômeur temporaire ») est expliqué par estChomeurTemporaire.
    visibleIf: VISIBLE_SI_CHOMEUR_TEMPORAIRE,
    section: SECTION_ACTIVITES,
    order: 161,
    scheduleGrid: { row: "mardi" },
  },
  {
    id: "joursOccupeMercredi",
    pdfFieldName: "me",
    type: "checkbox",
    required: false,
    label: { fr: "Mercredi" },
    // Pas de `help` : le nom du jour EST déjà toute l'information ; le
    // contexte (« chômeur temporaire ») est expliqué par estChomeurTemporaire.
    visibleIf: VISIBLE_SI_CHOMEUR_TEMPORAIRE,
    section: SECTION_ACTIVITES,
    order: 162,
    scheduleGrid: { row: "mercredi" },
  },
  {
    id: "joursOccupeJeudi",
    pdfFieldName: "je",
    type: "checkbox",
    required: false,
    label: { fr: "Jeudi" },
    // Pas de `help` : le nom du jour EST déjà toute l'information ; le
    // contexte (« chômeur temporaire ») est expliqué par estChomeurTemporaire.
    visibleIf: VISIBLE_SI_CHOMEUR_TEMPORAIRE,
    section: SECTION_ACTIVITES,
    order: 163,
    scheduleGrid: { row: "jeudi" },
  },
  {
    id: "joursOccupeVendredi",
    pdfFieldName: "ve",
    type: "checkbox",
    required: false,
    label: { fr: "Vendredi" },
    // Pas de `help` : le nom du jour EST déjà toute l'information ; le
    // contexte (« chômeur temporaire ») est expliqué par estChomeurTemporaire.
    visibleIf: VISIBLE_SI_CHOMEUR_TEMPORAIRE,
    section: SECTION_ACTIVITES,
    order: 164,
    scheduleGrid: { row: "vendredi" },
  },
  {
    id: "joursOccupeSamedi",
    pdfFieldName: "sa",
    type: "checkbox",
    required: false,
    label: { fr: "Samedi" },
    // Pas de `help` : le nom du jour EST déjà toute l'information ; le
    // contexte (« chômeur temporaire ») est expliqué par estChomeurTemporaire.
    visibleIf: VISIBLE_SI_CHOMEUR_TEMPORAIRE,
    section: SECTION_ACTIVITES,
    order: 165,
    scheduleGrid: { row: "samedi" },
  },
  {
    id: "joursOccupeDimanche",
    pdfFieldName: "di",
    type: "checkbox",
    required: false,
    label: { fr: "Dimanche" },
    help: {
      fr: "À compléter uniquement si vous êtes chômeur temporaire : cochez les jours où vous êtes habituellement occupé chez votre employeur.",
    },
    visibleIf: VISIBLE_SI_CHOMEUR_TEMPORAIRE,
    section: SECTION_ACTIVITES,
    order: 166,
    scheduleGrid: { row: "dimanche" },
  },

  // ====================================================================
  // Q23 — INDÉPENDANT À TITRE PRINCIPAL ?
  // ====================================================================
  {
    id: "independantTitrePrincipal",
    pdfFieldName: "oui et je sais que je nai pas droit aux allocations|non_10",
    type: "radio",
    required: true,
    label: { fr: "Je suis indépendant à titre principal :" },
    help: {
      fr: "⚠ À compléter toujours. Si vous êtes indépendant à titre principal, vous n'avez pas droit aux allocations de chômage.",
    },
    options: [
      { value: "oui", label: { fr: "Oui, et je sais que je n'ai pas droit aux allocations" } },
      { value: "non", label: { fr: "Non" } },
    ],
    section: SECTION_AFFIRMATIONS,
    order: 170,
  },

  // ====================================================================
  // Q24 — AFFIRMATION FINALE + ANNEXES + SIGNATURE
  // ====================================================================
  {
    id: "affirmationSincerite",
    pdfFieldName: "",
    type: "checkbox",
    required: true,
    label: {
      fr: "J'affirme sur l'honneur que la présente déclaration est sincère et complète et je m'engage à communiquer toute modification à mon organisme de paiement.",
    },
    // Pas de `help` : le label EST la déclaration légale complète imprimée.
    section: SECTION_AFFIRMATIONS,
    order: 180,
  },
  // A VALIDER Oraliks : aucun widget checkbox dédié identifié dans le dump
  // pour cette affirmation (contrairement au C1 principal qui a un widget
  // par affirmation) — laissé virtuel. Le texte n'est peut-être qu'une
  // mention imprimée sans case à cocher sur ce formulaire ; à confirmer sur
  // le PDF réel.
  {
    // La case « Je joins …… annexe(s) » de Q24 a bien un widget :
    // `Liste déroulante44`, à (350, 171), juste au-dessus de la ligne imprimée
    // (y=179). Le schéma l'avait classée « champ non identifié » et masquée,
    // et ce champ-ci restait virtuel — le nombre ne s'imprimait jamais.
    //
    // Facultatif (décision Oraliks), mais la case doit exister à l'écran.
    id: "nombreAnnexesJointes",
    pdfFieldName: "Liste déroulante44",
    type: "number",
    required: false,
    label: { fr: "Nombre d'annexes jointes" },
    help: {
      fr: "Par exemple la copie de la plus récente note de calcul de l'administration des contributions directes, demandée aux questions 6, 11 et 19.",
    },
    section: SECTION_ANNEXES,
    order: 190,
  },
  {
    id: "dateSignature",
    pdfFieldName: "AUJOURD'HUI",
    type: "date",
    required: true,
    label: { fr: "Date de signature" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour." },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 200,
  },
  {
    id: "signature",
    pdfFieldName: "Signature42",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique" },
    help: {
      fr: "Signature « façon Adobe » : votre nom + prénom + horodatage seront appliqués à la position de la signature.",
    },
    section: SECTION_SIGNATURE,
    order: 201,
  },

  // ====================================================================
  // CHAMPS NON RATTACHÉS AVEC CERTITUDE
  // ====================================================================
  {
    // Troisième exemplaire d'un « toute l'année », isolé en bas de page 2
    // (x=156, y=43), alors que les deux grilles horaires sont déjà câblées sur
    // `toute lannée` (Q4) et `toute lannée_3` (Q18). Aucune donnée perdue.
    id: "touteLanneeOrpheline",
    pdfFieldName: "toute lannée_2",
    type: "checkbox",
    required: false,
    label: { fr: "(case orpheline — voir A VALIDER)" },
    hidden: true,
    section: SECTION_DIVERS_INCONNU,
    order: 902,
  },
];

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id` ET les `pdfFieldName`
/// désormais couverts).
/// Champs d'une version antérieure du schéma qui n'existent plus et dont le
/// widget est désormais écrit par une RÈGLE serveur. L'overlay ne peut pas les
/// détecter tout seul : leur `pdfFieldName` n'est plus « couvert » par aucun
/// champ, donc le filtre `covered` les laisserait survivre en base — ils se
/// battraient alors avec la règle pour le même widget.
const LEGACY_C1A_FIELD_IDS = new Set<string>([
  // Scindé en `codePostal` + `commune` (2026-07-26) ; le widget fusionné
  // « Code postal et commune » est recomposé par `bindings/per-form/c1a.ts`.
  "codePostalEtCommune",
  // Même widget, mais l'`id` produit par l'INFÉRENCE à l'import — distinct du
  // camelCase ci-dessus, donc jamais attrapé par cette liste. Il survivait, et
  // avec un libellé faux : l'inférence déduit le sien de l'infobulle du widget,
  // qui dit ici « rue ». Le citoyen se voyait donc poser une seconde question
  // « rue » qui attendait en réalité un code postal.
  "code_postal_et_commune",
  // Réalignement géométrique de Q2/Q15 (2026-07-28) : trois champs renommés
  // pour que l'id reflète enfin la vraie case (cf. commentaires sur les
  // nouveaux champs). La couverture par pdfFieldName suffirait déjà à les
  // écarter dans le cas nominal, mais les lister ici les écarte aussi si leur
  // pdfFieldName stocké en base venait à différer (état antérieur imprévu).
  "adresseActiviteIndependanteLabel", // -> independantAdresseRueNumero (même widget)
  "independantAdresseRue", // -> independantAdresseCodePostalCommune (même widget)
  "adresseActiviteNumero", // -> adresseActiviteCodePostalCommune (widget aussi corrigé : undefined_2 -> rue_3)
  // Q19 (2026-07-28) : les trois revenus passent en écriture positionnelle
  // (drawAt), le widget "voir 19" reste non revendiqué. Sans cette entrée,
  // un ancien champ `voir19Artefact` déjà en base survivrait au merge : ni
  // `newIds` ni `covered` (pdfFieldName) ne le voient plus.
  "voir19Artefact",
  // Q24 (2026-07-28) : "Liste déroulante44" est désormais revendiqué par
  // `nombreAnnexesJointes`. L'ancien `listeDeroulante44` (masqué à tort comme
  // "champ non identifié") doit être purgé s'il est déjà en base, sinon il
  // survivrait à côté du nouveau champ qui porte le même pdfFieldName.
  "listeDeroulante44",
  // Q4 (2026-07-29) : correctif de la coupure périodes/irrégulier — le
  // widget "undefined" appartient désormais à la ligne 1 de
  // `q4irregulierementTexte` (cf. entrée dédiée plus bas, 2026-07-30), mais
  // `q4periodesTexte5` disparaît du seed (périodesTextFields n'a plus que 4
  // entrées) : listé ici par prudence, même raison que les trois entrées
  // Q2/Q15 ci-dessus — sans cette entrée, un brouillon déjà en base garderait
  // une 5e case "Période 5" fantôme, qui n'écrirait plus rien de cohérent
  // nulle part.
  "q4periodesTexte5",
  // Q2/Q5 (Commit 2, 2026-07-29) : natureActiviteIndependant1..5 et
  // descriptionAide2..9 consolidés en deux champs `array`
  // (natureActiviteIndependant, descriptionAide1). Ici la couverture par
  // `pdfFieldName` NE SUFFIT PAS : les widgets "mentionnez les toutes N" et
  // "Décrivez laide que vous apporterez N" ne sont plus référencés que via
  // `pdfFieldNameTemplate` sur un sous-champ d'`itemFields`, invisible à
  // `coveredWidgetNames` (qui ne lit que `field.pdfFieldName` au premier
  // niveau). Sans ces entrées, un brouillon déjà en base garderait les 14
  // anciens champs ligne-par-ligne À CÔTÉ du nouveau tableau — doublon
  // silencieux, pas une case fantôme qui se voit tout de suite.
  "natureActiviteIndependant1",
  "natureActiviteIndependant2",
  "natureActiviteIndependant3",
  "natureActiviteIndependant4",
  "natureActiviteIndependant5",
  "descriptionAide2",
  "descriptionAide3",
  "descriptionAide4",
  "descriptionAide5",
  "descriptionAide6",
  "descriptionAide7",
  "descriptionAide8",
  "descriptionAide9",
  // Grilles horaires Q4/Q18 (2026-07-30) : "Période 1..4" et "Précisez à quel
  // rythme"/"Précision 2..N" consolidés en UN SEUL champ `textarea` par
  // option (`periodesTexte`, `irregulierementTexte`), qui répartit sa valeur
  // sur les mêmes widgets via `lineTargets` au lieu d'un champ par ligne. La
  // couverture par `pdfFieldName` NE SUFFIT PAS ici : les widgets ("1", "2",
  // "1_2"…) ne sont plus référencés qu'à l'intérieur de `lineTargets`,
  // invisible à `coveredWidgetNames` (qui ne lit que `field.pdfFieldName` au
  // premier niveau) — même limite que `natureActiviteIndependant1..5`
  // ci-dessus. Sans ces entrées, un brouillon déjà en base garderait les 16
  // anciens champs numérotés À CÔTÉ des deux nouveaux textarea.
  // (`q4periodesTexte5` est déjà listé plus haut — jamais un id réel du seed,
  // gardé par prudence depuis le correctif Q4 du 2026-07-29.)
  "q4periodesTexte1",
  "q4periodesTexte2",
  "q4periodesTexte3",
  "q4periodesTexte4",
  "q4irregulierementTexte1",
  "q4irregulierementTexte2",
  "q4irregulierementTexte3",
  "q4irregulierementTexte4",
  "q4irregulierementTexte5",
  "q18periodesTexte1",
  "q18periodesTexte2",
  "q18periodesTexte3",
  "q18periodesTexte4",
  "q18irregulierementTexte1",
  "q18irregulierementTexte2",
  "q18irregulierementTexte3",
  // Q16 (2026-07-30) : "Je décris mon activité" / "… (suite)" / "… (fin)"
  // (3 champs distincts) consolidés en UN SEUL textarea
  // (`descriptionActivite1`, qui reste l'id de l'ex-1re ligne), dont
  // `lineTargets` porte les 3 mêmes widgets. La couverture par
  // `pdfFieldName` NE SUFFIT PAS : `Je décris mon activité 1`/`2` et
  // `undefined_2` ne sont plus référencés qu'à l'intérieur de `lineTargets`,
  // invisible à `coveredWidgetNames` — même limite que
  // natureActiviteIndependant1..5/descriptionAide2..9 et les grilles
  // horaires Q4/Q18 ci-dessus. Sans ces entrées, un brouillon déjà en base
  // garderait descriptionActivite2 et descriptionActivite3 À CÔTÉ du champ
  // consolidé.
  //
  // (Q5, `descriptionAide1`, subit la même conversion array -> textarea ce
  // même jour, mais SANS entrée LEGACY nécessaire : son id ne change pas,
  // rien ne disparaît au niveau des ids top-level.)
  "descriptionActivite2",
  "descriptionActivite3",
]);

/// Champs qui suivent la même condition que la question qui les porte : les
/// lignes d'une même rubrique du PDF s'affichent ou disparaissent ensemble.
/// Clé = identifiant de la question dans `C1A_ROUTAGE`.
const RATTACHEMENTS: Record<string, string[]> = {
  independantNom: [
    "independantNumeroEntreprise",
    "independantAdresseRueNumero",
    "independantAdresseCodePostalCommune",
    // natureActiviteIndependant1..5 consolidés (Commit 2) en un seul champ
    // `array` : plus besoin de les rattacher un par un.
    "natureActiviteIndependant",
  ],
  // descriptionAide2..9 ont disparu (Commit 2) : consolidés dans le champ
  // `array` descriptionAide1 ci-dessus, qui reste lui-même la clé
  // C1A_ROUTAGE de Q5 — plus rien à rattacher séparément.
  montantAidePeriodicite: ["montantAide", "montantAideAnnuel"],
  mandatDescription: [],
  // Q11 imprime DEUX lignes de montant : la seconde suit la première, sinon
  // elle serait le seul champ de sa rubrique à échapper à l'arbre.
  revenuAnnuelMandat: ["revenuAnnuelMandat2"],
  employeurNom: ["employeurAdresse"],
  adresseActivite: ["adresseActiviteCodePostalCommune"],
  formeActivite: [
    "disposeNumeroEntreprise", "numeroEntreprise",
    // descriptionActivite2/3 ont disparu (2026-07-30) : consolidés dans
    // descriptionActivite1 (désormais un textarea + lineTargets), seul
    // survivant du trio dans ce rattachement.
    "descriptionActivite1",
  ],
  revenuNetSalarieParMois: ["revenuNetSalarieParHeure", "revenuNetIndependantParAn"],
  // Q22 : les sept jours suivent la consigne « à compléter uniquement si tu es
  // chômeur temporaire », qui est leur question (cf. c1a-routing.ts).
  estChomeurTemporaire: [
    "joursOccupeLundi", "joursOccupeMardi", "joursOccupeMercredi", "joursOccupeJeudi",
    "joursOccupeVendredi", "joursOccupeSamedi", "joursOccupeDimanche",
  ],
  affirmationSincerite: ["nombreAnnexesJointes"],
};

/// Rubriques dont TOUS les champs se reconnaissent à un préfixe d'identifiant :
/// les deux grilles horaires, soixante champs à elles deux. Les énumérer à la
/// main serait une liste à retomber en panne au premier créneau ajouté — et un
/// créneau oublié ici est un créneau qui échappe à l'arbre. Les créneaux ne
/// tiennent aujourd'hui que par leur condition interne (« le jour est coché »),
/// qui n'a pas vocation à rester : la grille doit reproduire la disposition du
/// papier, tout visible d'emblée.
const RATTACHEMENTS_PAR_PREFIXE: Array<{ prefixe: string; question: string }> = [
  { prefixe: "q4", question: "q4periode" },
  { prefixe: "q18", question: "q18periode" },
];

/// Une condition, aplatie : la principale et ses `and` sur le même plan.
type Clause = Pick<VisibleIf, "fieldId" | "op" | "value">;

function aplatir(condition: VisibleIf): Clause[] {
  return [
    { fieldId: condition.fieldId, op: condition.op, value: condition.value },
    ...(condition.and ?? []).map((a) => ({ fieldId: a.fieldId, op: a.op, value: a.value })),
  ];
}

/// Première clause en tête, le reste en `and` — et pas de `and: []` parasite,
/// qui ferait échouer toute comparaison structurelle avec une condition simple.
function assembler(clauses: Clause[]): VisibleIf {
  const [tete, ...reste] = clauses;
  return { ...tete, ...(reste.length ? { and: reste } : {}) };
}

/// Empile la condition de branche SOUS la condition existante, sans la
/// remplacer. Dédoublonnage sur la paire (champ, valeur) : une condition déjà
/// juste reste identique à elle-même.
function empiler(existante: VisibleIf | undefined, branche: VisibleIf): VisibleIf {
  const cle = (c: Clause) => `${c.fieldId}=${JSON.stringify(c.value)}`;
  const base = existante ? aplatir(existante) : [];
  const deja = new Set(base.map(cle));
  return assembler([...base, ...aplatir(branche).filter((c) => !deja.has(cle(c)))]);
}

/// Pose sur chaque champ la condition dérivée de l'arbre imprimé.
///
/// Deux populations, deux traitements :
///   • un champ qui EST une question de l'arbre voit sa condition REMPLACÉE —
///     c'est l'arbre qui fait foi, et les conditions écrites à la main sont
///     précisément ce qu'on répare (Q4 à Q8 étaient accrochées à Q1 en oubliant
///     Q3) ;
///   • un champ rattaché à une question garde SA condition en tête et reçoit
///     les clauses de branche en `and`. Écraser détruirait des conditions
///     intra-question légitimes : les deux montants de Q6 ne se distinguent que
///     par leur périodicité et s'afficheraient ensemble, sous le même libellé ;
///     le numéro d'entreprise de Q16 serait demandé à qui vient de déclarer ne
///     pas en avoir.
///
/// Une question posée sur tous les chemins (condition compilée `undefined`)
/// n'ajoute rien : le champ garde ce qu'il porte.
function appliquerRoutage(fields: PdfFormField[]): PdfFormField[] {
  const conditions = compilerRoutage(C1A_ROUTAGE, C1A_DEPART);
  const questions = new Set(Object.keys(C1A_ROUTAGE));
  const porteuse = questionParChamp(fields);

  return fields.map((f) => {
    if (questions.has(f.id)) {
      const condition = conditions[f.id];
      if (!condition) {
        // Question posée sur tous les chemins : toujours visible.
        const toujoursVisible = { ...f };
        delete toujoursVisible.visibleIf;
        return toujoursVisible;
      }
      return { ...f, visibleIf: assembler(aplatir(condition)) };
    }

    const question = porteuse.get(f.id);
    if (!question) return f;

    const branche = conditions[question];
    if (!branche) return f;
    return { ...f, visibleIf: empiler(f.visibleIf, branche) };
  });
}

/// Question de l'arbre à laquelle appartient chaque champ : une question
/// s'appartient à elle-même, les autres champs sont ceux de sa rubrique
/// (`RATTACHEMENTS`, ou préfixe d'identifiant pour les rubriques à soixante
/// champs). Un champ absent de la table n'appartient à aucune question.
///
/// Cette correspondance sert DEUX FOIS : à propager la condition de branche
/// (ci-dessus) et à découper le parcours en étapes (ci-dessous). C'est
/// délibéré — la question qui conditionne un champ est aussi celle qui doit
/// l'afficher, et deux tables diraient un jour deux choses différentes.
function questionParChamp(fields: PdfFormField[]): Map<string, string> {
  const questions = new Set(Object.keys(C1A_ROUTAGE));
  const porteuse = new Map<string, string>();
  for (const [question, rattaches] of Object.entries(RATTACHEMENTS)) {
    if (!questions.has(question)) {
      throw new Error(`RATTACHEMENTS : « ${question} » n'est pas une question de C1A_ROUTAGE`);
    }
    for (const id of rattaches) porteuse.set(id, question);
  }
  for (const { question } of RATTACHEMENTS_PAR_PREFIXE) {
    if (!questions.has(question)) {
      throw new Error(`RATTACHEMENTS_PAR_PREFIXE : « ${question} » n'est pas une question de C1A_ROUTAGE`);
    }
  }

  const parChamp = new Map<string, string>();
  for (const f of fields) {
    if (questions.has(f.id)) {
      parChamp.set(f.id, f.id);
      continue;
    }
    const question =
      porteuse.get(f.id) ??
      RATTACHEMENTS_PAR_PREFIXE.find((r) => f.id.startsWith(r.prefixe))?.question;
    if (question) parChamp.set(f.id, question);
  }
  return parChamp;
}

/// Étape de l'en-tête d'identité (nom, NISS, adresse). C'est la SEULE étape
/// qui ne corresponde pas à une question numérotée : le bandeau d'identité du
/// C1A n'a pas de numéro sur le papier et n'entre donc pas dans l'arbre de
/// renvois. Son titre reste une clé i18n (cf. `form-presentation.ts`).
const GROUPE_IDENTITE = "identite";

/// Macro-étape de chaque champ : UNE QUESTION = UNE ÉTAPE.
///
/// Le découpage n'est pas une table de plus (les anciennes `GROUPE_PAR_SECTION`
/// / `GROUPE_PAR_CHAMP` regroupaient tout le formulaire en cinq écrans, dont un
/// de cinquante champs) : il réutilise la correspondance champ → question déjà
/// établie par l'arbre de renvois. Une question sautée par l'arbre n'a plus
/// aucun champ visible et `buildMacroSteps` ne produit alors pas d'étape — le
/// repli du parcours est automatique.
///
/// L'ordre des étapes est celui du document (cf. `C1A_QUESTIONS`), consommé
/// par `form-presentation.ts`.
/// Contrairement aux six autres documents, la carte du C1A se DÉRIVE des champs
/// reçus (rattachements par préfixe d'identifiant) : elle se construit à chaque
/// appel, et non une fois pour toutes en portée module.
export function applyC1AImprovements(fields: PdfFormField[]): PdfFormField[] {
  const enrichis = appliquerRoutage(mergeEnrichedFields(fields, C1A_FIELDS, LEGACY_C1A_FIELD_IDS));
  return appliquerGroupes(enrichis, {
    parChamp: questionParChamp(enrichis),
    groupeEntete: GROUPE_IDENTITE,
    sectionsEntete: [SECTION_IDENTITE],
  });
}
