// Schéma enrichi du formulaire "C1-PARTENAIRE" — déclaration de cohabitation
// avec un partenaire financièrement à charge (personne qui n'est pas mariée
// au chômeur, cohabite avec lui, et ne perçoit ni revenu professionnel ni
// revenu de remplacement — ou, pour les allocations d'insertion, perçoit un
// revenu de remplacement).
//
// Mapping AcroForm vérifié sur le dump JSON fourni (1 page, 23 widgets).
// Référence métier : texte imprimé du FORMULAIRE C1-PARTENAIRE (ONEM,
// 15.09.2022/830.20.001) — 6 conditions cumulatives de la rubrique "Qui est
// considéré comme votre partenaire ?" et 6 questions oui/non de la rubrique
// "Le partenaire :".
//
// Déclenché depuis le C1 principal : cf. c1-fields-improvements.ts —
// C1_TRIGGERS[0] (cohabitants[*].c1PartenaireStatus === "premiere-fois").

import type { PdfFormField } from "../types";
import { mergeEnrichedFields } from "./_merge";

const SECTION_IDENTITE = "identite";
const SECTION_PARTENAIRE = "partenaire";
const SECTION_AFFIRMATIONS = "affirmations";
const SECTION_SIGNATURE = "signature";

const YN = [
  { value: "oui", label: { fr: "Oui" } },
  { value: "non", label: { fr: "Non" } },
];

/// « Date demande d'allocations ou modification : __ __ / __ __ / __ __ __ __ »
/// (en-tête, réservé à l'organisme de paiement). Guide en peigne : sans lui,
/// « 30/07/2026 » s'imprimait par-dessus les tirets ET les barres obliques déjà
/// dessinées — deux jeux de séparateurs superposés (relu sur un PDF généré).
///
/// Mesuré à pdfplumber : huit cases, pas de 9,78 pt, 4,62 pt de plus là où le
/// guide imprime « / ». `baselineY` presque nul (la ligne de base du guide
/// coïncide avec le bas de la case), `startX` centre le chiffre dans sa case.
const DATE_DA_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [2, 2, 4],
  slotWidth: 9.78,
  groupExtra: 4.62,
  startX: 1.83,
  baselineY: 0.02,
};

/// Guide NISS du chômeur : onze cases groupées 6-3-2, en tirets SymbolMT de
/// 9 pt (glyphe U+F8E7 — invisible à une recherche de « _ » ou de « . », c'est
/// pourquoi il avait été manqué au premier passage ; c'est la relecture d'un
/// PDF généré qui l'a montré). Pas mesuré : 12,99 pt, +6,06 aux ruptures —
/// exactement le pas des guides BCE du C1A, même gabarit ONEM.
///
/// Sans peigne, « 78.11.02-088.44 » s'imprimait d'un bloc à gauche du guide,
/// ses points et tirets doublant ceux déjà dessinés, et les dernières cases
/// restaient visiblement vides à droite.
const NISS_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [6, 3, 2],
  slotWidth: 12.99,
  groupExtra: 6.06,
  startX: 2.08,
  // Mesuré au pixel (rastérisation d'un tiret à 800 dpi) : l'encre du guide
  // occupe y=531,95→532,32, donc le trait tombe sur le BAS de la case
  // (532,04) — la même relation que sur le C1C et le C47. Le chiffre se pose
  // juste au-dessus. Deux essais avant celui-ci : +3 (valeur par défaut) les
  // laissait flotter au-dessus du trait, −2,1 (ligne de base déduite du
  // jambage supposé de SymbolMT) le faisait passer EN PLEIN MILIEU des
  // chiffres. Ne pas déduire ce calage d'une police : le mesurer.
  baselineY: 0.5,
};

/// Aide complète reprenant les 6 conditions cumulatives du texte imprimé
/// (rubrique "Qui est considéré comme votre partenaire ?"). Affichée sur le
/// premier champ d'identité du partenaire pour que le citoyen la voie avant
/// de remplir quoi que ce soit.
const PARTENAIRE_DEFINITION_HELP =
  "L'ONEM ne considère cette personne comme ton « partenaire à charge » que si TOUTES ces conditions sont remplies en même temps : (1) elle cohabite et forme un ménage de fait avec toi ; (2) elle n'est pas un membre de ta famille (pas un parent ou allié jusqu'au 3e degré inclus) ; (3) elle n'est pas un enfant encore à charge d'un parent qui doit une pension alimentaire ; (4) elle ne perçoit ni le revenu d'intégration, ni l'aide financière qui le remplace (aide du CPAS) ; (5) elle n'est pas déjà déclarée à charge d'un autre membre du ménage ; (6) elle n'est pas mariée et ne cohabite pas avec son/sa conjoint(e). Complète ce formulaire si ton partenaire (non marié) ne perçoit aucun revenu professionnel ni de remplacement — ou, pour une demande d'allocations d'insertion, s'il perçoit un revenu de remplacement.";

/// Construit une question oui/non fusionnée (paire de checkboxes ONEM) avec
/// ses éventuels champs de détail affichés seulement si la réponse est "oui".
function ynQuestion(opts: {
  id: string;
  pdfNon: string;
  pdfOui: string;
  label: string;
  help?: string;
  order: number;
}): PdfFormField {
  return {
    id: opts.id,
    pdfFieldName: `${opts.pdfOui}|${opts.pdfNon}`,
    type: "radio",
    required: true,
    label: { fr: opts.label },
    help: opts.help ? { fr: opts.help } : undefined,
    options: YN,
    section: SECTION_PARTENAIRE,
    order: opts.order,
  };
}

export const C1_PARTENAIRE_FIELDS: PdfFormField[] = [
  // ====================================================================
  // EN-TÊTE — cadre de l'organisme de paiement
  // ====================================================================
  {
    // EN TÊTE de l'ordre (2026-07-30) : sa case est tout en haut de la page
    // (y=743), au-dessus de l'identité. Elle était déclarée après, et le test
    // de géométrie ne le voyait pas — le découpage en deux colonnes la classait
    // « colonne de droite » (x=338) et masquait le retour en arrière. Cf.
    // `colonneX: null` sur la cible du c1-partenaire.
    //
    // Le champ est AUTO (`prefillFrom: system.today`, cf. `isCreationDateField`)
    // : il n'est jamais rendu à l'écran, son rang ne s'y voit donc pas.
    id: "dateDA",
    pdfFieldName: "Date de DA",
    type: "date",
    required: false,
    label: { fr: "Date de la demande d'allocations (ou de modification)" },
    help: {
      fr: "Case réservée à l'organisme de paiement (cachet dateur) — tu peux généralement la laisser vide.",
    },
    prefillFrom: "system.today",
    fontSize: 9,
    printAsComb: DATE_DA_COMB,
    section: SECTION_IDENTITE,
    order: -101,
  },

  // ====================================================================
  // IDENTITÉ DU CHÔMEUR ET DU PARTENAIRE
  // ====================================================================
  {
    id: "niss_ch_meur",
    pdfFieldName: "NISS Chômeur",
    type: "niss",
    required: true,
    label: { fr: "Ton numéro NISS (registre national)" },
    help: {
      fr: "11 chiffres au dos de ta carte d'identité (eID), au-dessus du code-barres.",
    },
    placeholder: { fr: "00.00.00-000.00" },
    prefillFrom: "profile.niss",
    // Chômeur = citoyen qui remplit ce formulaire (⇒ canonicalKey =
    // identity.niss). ATTENTION : les champs `niss_partenaire` et
    // `nom_partenaire` visent LE PARTENAIRE, PAS le citoyen — ne SURTOUT
    // PAS y poser identity.* (le prefill croisé injecterait la NISS du
    // citoyen dans le champ du partenaire).
    canonicalKey: "identity.niss",
    // Dans un dossier, le C1 a déjà donné le NISS du citoyen :
    // `applyDossierInheritance` rend le champ `autoAnswered` à l'ouverture.
    // Sur l'URL publique, où il n'y a aucun C1 dont hériter, il reste à
    // l'écran et obligatoire.
    inheritedFromDossier: true,
    // 12 pt comme sur le C1 : c'est la taille pour laquelle le peigne imprimé
    // est dessiné, et à 10 pt la saisie paraît rabougrie entre ses tirets.
    fontSize: 12,
    printAsComb: NISS_COMB,
    section: SECTION_IDENTITE,
    order: -100,
  },
  {
    // Champ COMPOSITE (2026-07-26) : deux cases à l'écran, une seule chaîne
    // sur le PDF, assemblée dans l'ordre du libellé imprimé (« nom et
    // prénom »). C'est le type — et non une clé canonique — qui fait le lien :
    // `canonicalToPrefill` et `buildProfilePrefill` remplissent tout champ
    // `fullname` depuis `identity.prenom` + `identity.nom`.
    //
    // Avant, ce champ n'avait NI `prefillFrom` NI `canonicalKey` : c'était le
    // seul du formulaire à être intégralement ressaisi par le citoyen.
    //
    // ⚠ Ce champ désigne LE CITOYEN (« Ton nom et prénom »). Les champs
    // `niss_partenaire` et `nom_partenaire` visent LE PARTENAIRE : ne jamais y
    // poser de clé `identity.*`, ni les passer en `fullname` — le prefill y
    // injecterait l'identité du citoyen à la place de celle du tiers.
    id: "nom_ch_meur",
    pdfFieldName: "Nom chômeur",
    alignTextToGuide: true,
    type: "fullname",
    nameOrder: "last-first",
    required: true,
    label: { fr: "Ton nom et prénom" },
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: -99,
  },
  {
    id: "niss_partenaire",
    pdfFieldName: "NISS Partenaire",
    // PAS de `printAsComb`, à la différence de la ligne du chômeur juste
    // au-dessus, qui porte pourtant le MÊME guide en onze cases. Le papier
    // accepte ici « NISS **ou date de naissance** » : un peigne 6-3-2 répartit
    // les caractères comme un NISS, et « 01/01/2005 » y sortirait en huit
    // chiffres éparpillés sur une grille de registre national — illisible, et
    // trompeur. Tant que la case accepte deux formats, la valeur s'écrit d'un
    // seul tenant.
    type: "text",
    required: true,
    label: { fr: "NISS ou date de naissance du partenaire" },
    help: {
      fr: "Indique le numéro NISS du partenaire. S'il n'en a pas encore (ex. personne récemment arrivée en Belgique), indique sa date de naissance à la place.",
    },
    section: SECTION_IDENTITE,
    order: -98,
  },
  {
    id: "nom_partenaire",
    pdfFieldName: "Nom partenaire",
    alignTextToGuide: true,
    type: "text",
    required: true,
    label: { fr: "Nom et prénom du partenaire" },
    help: { fr: PARTENAIRE_DEFINITION_HELP },
    section: SECTION_IDENTITE,
    order: -97,
  },

  // ====================================================================
  // "LE PARTENAIRE :" — 6 questions oui/non (dans l'ordre du texte imprimé)
  // ====================================================================
  ynQuestion({
    id: "partenaireRevenuProfessionnel",
    pdfNon: "non",
    pdfOui: "oui",
    label: "Le partenaire a un revenu professionnel",
    help: "Un salaire (comme salarié) ou un revenu d'indépendant, même partiel.",
    order: 100,
  }),
  {
    id: "m_tier",
    pdfFieldName: "métier",
    alignTextToGuide: true,
    type: "text",
    required: false,
    label: { fr: "Si oui, quelle activité professionnelle exerce-t-il/elle ?" },
    help: {
      fr: "Indique « salarié » et/ou « indépendant ». Si l'activité est exercée comme indépendant, ne remplis PAS le montant mensuel brut ci-dessous.",
    },
    visibleIf: { fieldId: "partenaireRevenuProfessionnel", op: "equals", value: "oui" },
    section: SECTION_PARTENAIRE,
    order: 101,
  },
  // ------------------------------------------------------------------
  // LES DEUX « MONTANT MENSUEL BRUT » — un seul champ AcroForm, deux cases
  // ------------------------------------------------------------------
  //
  // Le doute consigné ici depuis l'origine (« le formulaire réutilise-t-il le
  // MÊME widget pour les deux montants ? ») est TRANCHÉ, sur le PDF officiel et
  // sur un PDF généré : le champ `Montant mensuel brut` porte DEUX widgets
  // (`/Kids`, vérifié à pypdf) —
  //
  //   • page 1, y=406,5 : « Si oui, activité professionnelle exercée … Montant
  //     mensuel brut : ........ € » (le revenu PROFESSIONNEL) ;
  //   • page 1, y=376,7 : « Si oui, nature du revenu de remplacement … Montant
  //     mensuel brut :…… » (le revenu de REMPLACEMENT).
  //
  // Deux widgets d'un même champ partagent une seule valeur : un partenaire
  // déclarant 1 850 € de salaire et 1 200 € d'indemnité de mutuelle voyait
  // « 1850,00 » imprimé DEUX fois, l'indemnité écrasée en silence. Sortie :
  // écriture positionnelle des deux cases (cf. PDF_FORMS_RULES.md, « un champ
  // AcroForm peut porter plusieurs widgets »).
  //
  // Coordonnées MESURÉES à pdfplumber : `x` = début du guide pointillé,
  // `y` = sa ligne de base, `maxWidth` = jusqu'à la fin du guide (le « € »
  // imprimé de la 1re ligne est à x=479,7 — le montant ne doit pas l'atteindre).
  {
    id: "montant_mensuel_brut",
    pdfFieldName: "",
    drawAt: { page: 0, x: 415, y: 405.83, size: 9, maxWidth: 64 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Montant mensuel brut du revenu professionnel (si activité salariée)" },
    help: {
      fr: "Uniquement si l'activité est salariée. Laisse vide si le partenaire est indépendant : la note (2) du formulaire dit expressément de ne pas indiquer le montant dans ce cas.",
    },
    visibleIf: { fieldId: "partenaireRevenuProfessionnel", op: "equals", value: "oui" },
    section: SECTION_PARTENAIRE,
    order: 102,
  },
  ynQuestion({
    id: "partenaireRevenuRemplacement",
    pdfNon: "non_2",
    pdfOui: "oui_2",
    label: "Le partenaire a un revenu de remplacement",
    help: "Par exemple une indemnité de mutuelle, une pension, ou une allocation de chômage.",
    order: 110,
  }),
  {
    id: "revenu_de_remplacement",
    pdfFieldName: "Revenu de remplacement",
    alignTextToGuide: true,
    type: "text",
    required: false,
    label: { fr: "Si oui, nature du revenu de remplacement" },
    // Le texte imprimé ne donne pas d'exemples ici (contrairement à la
    // définition du « revenu de remplacement » ailleurs dans le C1) : l'aide
    // reste celle de la question, pas une liste inventée. Cf. la règle
    // « aucun texte réglementaire inventé » (PDF_FORMS_RULES.md).
    visibleIf: { fieldId: "partenaireRevenuRemplacement", op: "equals", value: "oui" },
    section: SECTION_PARTENAIRE,
    order: 111,
  },
  {
    // Le SECOND « Montant mensuel brut » — cf. le bloc de commentaire de son
    // jumeau, plus haut : même champ AcroForm, autre case, autre valeur.
    id: "montantMensuelBrutRemplacement",
    pdfFieldName: "",
    drawAt: { page: 0, x: 413.5, y: 375.82, size: 9, maxWidth: 58 },
    type: "number",
    numberFormat: "money",
    required: false,
    label: { fr: "Montant mensuel brut du revenu de remplacement" },
    visibleIf: { fieldId: "partenaireRevenuRemplacement", op: "equals", value: "oui" },
    section: SECTION_PARTENAIRE,
    order: 112,
  },
  ynQuestion({
    id: "partenaireRevenuIntegration",
    pdfNon: "non_3",
    pdfOui: "oui_3",
    label: "Le partenaire perçoit le revenu d'intégration ou l'aide du CPAS qui le remplace",
    help: "⚠ Si oui, cette personne ne peut pas être déclarée comme partenaire à charge (une des 6 conditions cumulatives n'est plus remplie).",
    order: 120,
  }),
  ynQuestion({
    id: "partenaireDejaDeclareAutreChomeur",
    pdfNon: "non_4",
    pdfOui: "oui_4",
    label: "Le partenaire est déjà déclaré à charge financièrement d'un autre chômeur membre du ménage",
    help: "⚠ Si oui, cette personne ne peut pas être déclarée une seconde fois à charge (une seule déclaration à la fois).",
    order: 130,
  }),
  ynQuestion({
    id: "partenaireApparente3eDegre",
    pdfNon: "non_5",
    pdfOui: "oui_5",
    label: "Le partenaire est apparenté au chômeur jusqu'au troisième degré",
    help: "Parent, beau-parent ou parent d'accueil, enfant, (arrière-)petit-enfant, (arrière-)grand-parent, oncle, tante, frère, sœur, neveu ou nièce. ⚠ Si oui, cette personne ne peut pas être déclarée comme partenaire à charge (elle est considérée comme un membre de la famille).",
    order: 140,
  }),
  ynQuestion({
    id: "partenaireAllocationsFamiliales",
    pdfNon: "non_6",
    pdfOui: "oui_6",
    label: "Le partenaire est une personne pour qui quelqu'un perçoit des allocations familiales",
    order: 150,
  }),

  // ====================================================================
  // AFFIRMATIONS ET SIGNATURES
  // ====================================================================
  {
    id: "aujourd_hui",
    pdfFieldName: "Aujourd'hui",
    type: "date",
    required: true,
    label: { fr: "Date de la déclaration" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour." },
    prefillFrom: "system.today",
    section: SECTION_AFFIRMATIONS,
    order: 900,
  },
  {
    id: "signature_du_ch_meur",
    pdfFieldName: "Signature du chômeur",
    type: "signature",
    required: true,
    label: { fr: "Ta signature" },
    help: {
      fr: "En signant, tu affirmes que cette déclaration est sincère et complète, et tu t'engages à signaler immédiatement à ton organisme de paiement tout changement de situation. ⚠ La case « signature du partenaire », à côté, reste volontairement VIDE : ton partenaire doit la signer à la main sur le document imprimé — c'est sa déclaration autant que la tienne.",
    },
    section: SECTION_SIGNATURE,
    order: 1000,
  },
  // ------------------------------------------------------------------
  // PAS DE CHAMP POUR « Signature du partenaire » — et c'est délibéré.
  // ------------------------------------------------------------------
  //
  // Le champ existait, en `type: "signature"`. Or `resolveSignerName`
  // (signature.ts) résout UN nom pour tout le formulaire — celui du déclarant,
  // lu ici sur `nom_ch_meur` — et le filler appose le bloc « Signé
  // numériquement par … » sur CHAQUE champ de ce type. Relu sur un PDF généré
  // le 2026-07-30 : les deux cases portaient le même bloc, au nom du chômeur.
  // La case du partenaire — un TIERS, qui n'a pas de compte, n'a rien signé et
  // n'était même pas devant l'écran — portait donc une signature fabriquée, sur
  // une déclaration officielle qui l'engage (« Le chômeur précité ET le
  // partenaire déclarent … »).
  //
  // Le formulaire est « À COMPLÉTER PAR LE CHÔMEUR ET LE PARTENAIRE EN 3
  // EXEMPLAIRES » : la case du partenaire se signe à la main sur le papier. La
  // laisser vide est la seule sortie honnête tant que l'application ne sait pas
  // faire signer un second signataire. Le widget est donc un orphelin ASSUMÉ
  // (cf. `seeds-vs-pdf.test.ts`), et l'aide de la signature du chômeur le dit
  // au citoyen plutôt que de le laisser croire que tout est signé.
];

/// Champs d'une version antérieure à purger de la base. Sans cette liste ils
/// survivraient (le merge ne compare que les `id`) et continueraient d'être
/// stampés.
const LEGACY_C1_PARTENAIRE_FIELD_IDS = new Set<string>([
  // Supprimé le 2026-07-31 : ce champ `signature` faisait apposer le bloc
  // « Signé numériquement par … » du CHÔMEUR dans la case du PARTENAIRE.
  // Cf. le commentaire à la fin de C1_PARTENAIRE_FIELDS.
  "signature_du_partenaire",
]);

// ===========================================================================
// PARCOURS À L'ÉCRAN — une question = une étape (patron du C1A / C1C / C47)
// ===========================================================================
//
// Le repli par défaut découpait par SECTION : quatre étapes, dont une
// « Le partenaire » de dix champs — la page interminable que PDF_FORMS_RULES
// déconseille, alors que le papier pose six questions bien distinctes. Une
// question par étape rend aussi les branches gratuites : `visibleIf` non
// satisfait ⟹ aucun champ visible ⟹ aucune étape.

/// Étape de l'en-tête d'identité — la seule qui ne soit pas une question. Elle
/// porte les DEUX identités (chômeur et partenaire) : le papier les imprime
/// d'un bloc, et celle du chômeur disparaît seule dans un dossier
/// (`inheritedFromDossier`), sans laisser d'étape à moitié vide.
export const C1_PARTENAIRE_GROUPE_IDENTITE = "identite";

/// Les six questions imprimées, DANS L'ORDRE du document. Chacune devient une
/// étape et porte l'identifiant du champ qui la pose : ce champ est alors
/// l'ANCRE de son étape (cf. `stepAnchorField`) et sa question titre l'étape —
/// aucune clé i18n à écrire.
///
/// `signature_du_ch_meur` ferme la liste sans jamais produire d'étape : la
/// date et la signature sont posées par le serveur (`applyServerAutoFields`),
/// donc `buildMacroSteps` n'y voit aucun champ visible. Le groupe existe pour
/// que ces champs en aient un, plutôt que de tomber dans « Autres informations ».
export const C1_PARTENAIRE_QUESTIONS: readonly string[] = [
  "partenaireRevenuProfessionnel",
  "partenaireRevenuRemplacement",
  "partenaireRevenuIntegration",
  "partenaireDejaDeclareAutreChomeur",
  "partenaireApparente3eDegre",
  "partenaireAllocationsFamiliales",
  "signature_du_ch_meur",
];

/// Champs RATTACHÉS à une question : les précisions conditionnelles « si oui ».
/// Elles suivent leur question et ne fabriquent pas d'étape à elles seules.
const RATTACHEMENTS: Readonly<Record<string, readonly string[]>> = {
  partenaireRevenuProfessionnel: ["m_tier", "montant_mensuel_brut"],
  partenaireRevenuRemplacement: ["revenu_de_remplacement", "montantMensuelBrutRemplacement"],
  signature_du_ch_meur: ["aujourd_hui"],
};

/// Pose `stepGroup` sur chaque champ. Les champs d'identité (et la date
/// d'en-tête, qui vit dans la même section) tombent dans le groupe d'en-tête ;
/// un champ inconnu des deux tables reste sans groupe et atterrit dans
/// « Autres informations » de la dernière étape — repli visible, jamais une
/// perte.
function appliquerGroupes(fields: PdfFormField[]): PdfFormField[] {
  const parChamp = new Map<string, string>();
  for (const question of C1_PARTENAIRE_QUESTIONS) parChamp.set(question, question);
  for (const [question, rattaches] of Object.entries(RATTACHEMENTS)) {
    for (const id of rattaches) parChamp.set(id, question);
  }
  return fields.map((f) => {
    const groupe =
      parChamp.get(f.id) ??
      (f.section === SECTION_IDENTITE ? C1_PARTENAIRE_GROUPE_IDENTITE : undefined);
    return groupe ? { ...f, stepGroup: groupe } : f;
  });
}

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import).
///
/// Comportement :
/// 1. Retire tous les champs inférés correspondant aux 6 paires oui_N/non_N
///    (les champs `radio` les couvrent).
/// 2. Retire aussi un éventuel ancien champ portant un id qu'on redéfinit, et
///    ceux de `LEGACY_C1_PARTENAIRE_FIELD_IDS`.
/// 3. Append les champs enrichis, puis pose leur étape.
///
/// Idempotent : ré-exécutable sans dupliquer (compare les `id` et les
/// `pdfFieldName` couverts).
export function applyC1PartenaireImprovements(fields: PdfFormField[]): PdfFormField[] {
  return appliquerGroupes(
    mergeEnrichedFields(fields, C1_PARTENAIRE_FIELDS, LEGACY_C1_PARTENAIRE_FIELD_IDS)
  );
}
