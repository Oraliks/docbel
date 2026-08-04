// Schéma enrichi du formulaire "C1 ANNEXE REGIS" — précisions sur la
// composition de ménage quand une différence existe entre le C1 et les
// registres officiels (registre national).
//
// Mapping AcroForm vérifié sur private/pdfs/Annexe_Regis_FR.pdf via
// lib/pdf-forms/acroform-parser.ts#parsePdf — 2 pages, 42 champs pour
// 43 WIDGETS : le champ « NOM » en porte deux (cf. plus bas).
// Référence métier : légende "Explications relatives à la rubrique I" (page
// 2 du formulaire officiel) — codes N1-N2 (nationalité), A1-A2 + sous-codes
// (adresse), FN1-FN5 / FY1-FY5 (membres du ménage).
//
// ===========================================================================
// RÉALIGNÉ LE 2026-08-02 (lot S14) — il était le dernier document non repris
// ===========================================================================
//
// Quatre écarts par rapport aux sept autres documents, tous corrigés ici :
//
// 1. ORDRE DE LECTURE. Le formulaire imprime un TABLEAU de sept lignes :
//
//      | INDICATION SUR LE C1 | DANS LES REGISTRES |      | différence ? |
//      |  x=140               |  x=307             |      | non/oui x=487|
//
//    ...puis, quatre-vingts points PLUS BAS sur la même page, un second bloc
//    « Explications » d'une case par ligne (x=140, y=258 → 130).
//
//    Le schéma déclarait chaque ligne comme un quatuor
//    « différence → C1 → registres → EXPLICATION », ce qui faisait remonter
//    l'explication de 220 points au milieu du tableau. D'où les 14 écarts
//    géométriques recensés — le pire du parc. Les explications forment
//    désormais leur propre bloc, dans l'ordre où elles sont imprimées.
//
// 2. PARCOURS. Seul document resté au découpage par SECTION : une seule étape
//    « grille des différences » de vingt-huit champs. Il suit maintenant le
//    patron des six autres — une question par étape (`stepGroup`), la question
//    étant « y a-t-il une différence ? » de chaque ligne.
//
// 3. MOULES PARTAGÉS. Sa paire oui/non monolingue et sa signature étaient des
//    copies locales (cf. `_shared/moules.ts`, lot S13).
//
// 4. DATE DE SIGNATURE : il n'y en a PAS, et c'est vérifié, pas oublié. Le bas
//    du formulaire imprime une seule légende, « Date – signature de l'assuré
//    social » (x=324→459, y=77), au-dessus d'une SEULE zone : le widget
//    `Signature6`. Aucun guide de date ne lui est associé. Le bloc de
//    signature « façon Adobe » y appose déjà l'horodatage de Bruxelles
//    (« Signé via Docbel.be · 2026.08.02 14:31:07 »), ce qui remplit la moitié
//    « Date » de la légende. Ajouter un champ de date positionnel écrirait
//    soit par-dessus la signature, soit sur du papier vierge.

import type { PdfFormField } from "../types";
import { mergeEnrichedFields } from "./_merge";
import {
  appliquerGroupes,
  carteDesGroupes,
  champNISS,
  champSignature,
  SECTION_ANNEXES,
  SECTION_GRILLE_DIFFERENCES,
  SECTION_IDENTITE,
  YN,
} from "./_shared/moules";

// ===========================================================================
// EN-TÊTE : DEUX CASES POUR UN SEUL CHAMP ACROFORM
// ===========================================================================
//
// Défaut relevé le 2026-08-02 à la relecture du PDF généré : le champ AcroForm
// « NOM » porte DEUX widgets (`/Kids`, vérifié à pypdf) —
//
//   [71,9 ; 665,9]  la ligne « NOM ····· » ;
//   [289,4 ; 687,7] le guide en peigne « Numéro de registre national (NISS) ».
//
// Deux widgets d'un même champ partagent une seule valeur : le NOM du citoyen
// s'imprimait donc AUSSI dans la case NISS, par-dessus le peigne. Sur une
// déclaration officielle, une donnée d'identification fausse.
//
// Sortie : ÉCRITURE POSITIONNELLE des deux, comme les trois dates du C46. Plus
// personne ne revendique le champ « NOM » — sinon ses deux widgets seraient
// tamponnés. Ces coordonnées sont MESURÉES à pdfplumber (abscisse de chaque
// tiret, ligne de base du guide), jamais approchées à l'œil.

/// Ligne de base des guides de l'en-tête. pdfplumber rapporte le BAS de la
/// boîte du caractère, soit la ligne de base moins le jambage (ArialMT :
/// 0,212 em) — d'où le rattrapage.
/// Ligne de base du NOM : 4 pt AU-DESSUS du bas du widget (665,9), et non
/// dessus. Le guide de cette ligne n'est pas un trait mais un CHAPELET DE
/// POINTS centré à y≈669,3 — soit en plein dans la hauteur d'x. Poser le
/// texte sur 665,9 faisait passer les points au travers des lettres
/// (relecture du 2026-08-02). À 670, ils courent juste sous la ligne
/// d'écriture, comme sur un formulaire rempli à la main.
const BASELINE_NOM = 670.0;
const BASELINE_NISS = 689.4; // mesuré 687,50 + 0,212 × 8,8

/// « __ __ __ __ __ __ / __ __ __ - __ __ » (y≈689). Vingt-deux tirets, donc
/// onze cases groupées 6-3-2 ; pas relevé 12,25 pt, séparateurs +5,1.
/// `startX` centre le chiffre sur sa paire de tirets (encre large de 9,7 pt).
const NISS_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [6, 3, 2],
  slotWidth: 12.25,
  groupExtra: 5.1,
  startX: 2.35,
};

/// « au __ __ / __ __ / __ __ __ __ » (y≈615) — huit cases, pas de 11,97 pt,
/// séparateurs +4,68. Ici le widget EXISTE et n'a qu'une case : le peigne se
/// cale donc sur son rectangle (x=445,2 ; y=613,2), d'où un `startX` et un
/// `baselineY` comptés depuis ce coin et non depuis le premier tiret.
const DATE_DA_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [2, 2, 4],
  slotWidth: 11.97,
  groupExtra: 4.68,
  startX: 5.95,
  baselineY: 2.0,
};

/// Préfixes exacts des 2 colonnes de la Grille 1 sur le PDF officiel — la
/// virgule et les apostrophes du texte affiché sont absentes du nom de champ
/// technique (comportement du PDF source, pas une décision de notre côté).
const GRILLE1_C1_PREFIX =
  "INDICATION SUR LE C1 indiquez la nationalité ladresse le nom et le prénom";
const GRILLE1_REGISTRE_PREFIX =
  "INDICATION DANS LES REGISTRES indiquez la nationalité ladresse le nom et le prénom";

const FN4_HELP =
  "Si cette personne est une ou un colocataire (aucun lien de parenté) qui vit réellement à la même adresse mais avec qui vous ne partagez pas la vie domestique/financière : indiquez le code FN4. Pour les autres cas, référez-vous à la légende page 2 du formulaire officiel (codes FN1-FN5, FY1-FY5).";

/// Les sept lignes du tableau, dans l'ordre imprimé. Chacune donne son nom aux
/// quatre champs qu'elle produit (`<clé>Difference`, `<clé>C1`,
/// `<clé>Registre`, `<clé>Explication`) et porte les deux irrégularités de
/// nommage du PDF officiel :
///
///   • le suffixe des cases à cocher (`oui`/`non` nu pour la 1re ligne, puis
///     `_2` … `_7`) ;
///   • le suffixe des colonnes de texte, où la 5e personne n'a PAS de numéro
///     (« PERSONNE » et non « PERSONNE 5 ») — même limitation déjà documentée
///     pour la grille « cohabitants » du C1 lui-même.
interface Ligne {
  cle: string;
  label: string;
  /// "" pour la 1re ligne (cases `oui`/`non` nues), "_2" pour la 2e…
  suffixeCase: string;
  /// Suffixe des trois widgets de texte de la ligne.
  suffixeTexte: string;
  /// Aide de la case « explication » : la légende des codes diffère selon
  /// qu'il s'agit de vous (codes N/A) ou d'un membre du ménage (codes FN/FY).
  aideExplication: string;
  /// Précision demandée à la colonne « registres ».
  aideRegistre: string;
}

const LIGNES: readonly Ligne[] = [
  {
    cle: "nationalite",
    label: "Ma nationalité",
    suffixeCase: "",
    suffixeTexte: "MA NATIONALITE",
    aideExplication: "voir légende page 2, codes N",
    aideRegistre: "Ce que dit votre registre national — vérifiez sur votre eID.",
  },
  {
    cle: "adresse",
    label: "Mon adresse",
    suffixeCase: "_2",
    suffixeTexte: "MON ADRESSE",
    aideExplication: "voir légende page 2, codes A",
    aideRegistre: "Ce que dit votre registre national — vérifiez sur votre eID.",
  },
  ...([1, 2, 3, 4, 5] as const).map((n) => ({
    cle: `personne${n}`,
    label: n === 5 ? "Personne (5e)" : `Personne ${n}`,
    suffixeCase: `_${n + 2}`,
    suffixeTexte: n === 5 ? "PERSONNE" : `PERSONNE ${n}`,
    aideExplication: "code",
    aideRegistre:
      "Ce que dit votre registre national pour cette personne — vérifiez sur son eID ou demandez-lui.",
  })),
];

/// Les trois champs d'une ligne du TABLEAU (la case « explication », imprimée
/// bien plus bas sur la page, est produite à part par `champsExplication`).
function champsTableau(ligne: Ligne, order: number): PdfFormField[] {
  const diffId = `${ligne.cle}Difference`;
  const cases =
    ligne.suffixeCase === ""
      ? "oui|non"
      : `oui${ligne.suffixeCase}|non${ligne.suffixeCase}`;
  const suiteVisible: PdfFormField["visibleIf"] = {
    fieldId: diffId,
    op: "equals",
    value: "oui",
  };
  return [
    {
      id: diffId,
      pdfFieldName: cases,
      type: "radio",
      required: false,
      label: { fr: `${ligne.label} — y a-t-il une différence avec les registres ?` },
      options: YN,
      section: SECTION_GRILLE_DIFFERENCES,
      order,
    },
    {
      id: `${ligne.cle}C1`,
      pdfFieldName: `${GRILLE1_C1_PREFIX}${ligne.suffixeTexte}`,
      type: "text",
      required: false,
      label: {
        fr:
          ligne.cle.startsWith("personne")
            ? `${ligne.label} — indication sur le C1 (nom, prénom)`
            : `${ligne.label} — indication sur le C1`,
      },
      // Recopie ce que le citoyen a déjà indiqué sur le C1 principal — ce
      // document sert précisément à comparer cette valeur aux registres
      // officiels, pas à recueillir une nouvelle réponse.
      help: {
        fr: "Recopiez ici exactement ce que vous avez indiqué sur le formulaire C1 — c'est cette valeur qui est comparée aux registres officiels.",
      },
      visibleIf: suiteVisible,
      section: SECTION_GRILLE_DIFFERENCES,
      order: order + 1,
    },
    {
      id: `${ligne.cle}Registre`,
      pdfFieldName: `${GRILLE1_REGISTRE_PREFIX}${ligne.suffixeTexte}`,
      type: "text",
      required: false,
      label: { fr: `${ligne.label} — indication dans les registres officiels` },
      help: { fr: ligne.aideRegistre },
      visibleIf: suiteVisible,
      section: SECTION_GRILLE_DIFFERENCES,
      order: order + 2,
    },
  ];
}

/// La case « explication » d'une ligne. Le PDF les imprime toutes ensemble,
/// sous le tableau (x=140, y=258 → 130) : elles forment donc un bloc à elles,
/// APRÈS les sept lignes, et non la queue de chaque ligne.
function champExplication(ligne: Ligne, order: number): PdfFormField {
  return {
    id: `${ligne.cle}Explication`,
    pdfFieldName: ligne.suffixeTexte,
    type: "text",
    required: false,
    label: { fr: `${ligne.label} — explication (${ligne.aideExplication})` },
    ...(ligne.cle.startsWith("personne") ? { help: { fr: FN4_HELP } } : {}),
    visibleIf: { fieldId: `${ligne.cle}Difference`, op: "equals", value: "oui" },
    section: SECTION_GRILLE_DIFFERENCES,
    order,
  };
}

export const C1_REGIS_FIELDS: PdfFormField[] = [
  // ====================================================================
  // EN-TÊTE (page 1, y=666 et 613)
  // ====================================================================
  // Le peigne NISS est le SECOND widget du champ « NOM » : il se remplit donc
  // positionnellement, et le nom aussi (cf. l'en-tête de section ci-dessus).
  champNISS({
    drawAt: { page: 0, x: 289.6, y: BASELINE_NISS },
    printAsComb: NISS_COMB,
    section: SECTION_IDENTITE,
    order: -101,
  }),
  {
    id: "nom",
    // Aucun widget revendiqué : le remplir tamponnerait AUSSI la case NISS.
    pdfFieldName: "",
    // `maxWidth` = jusqu'au bord droit du widget d'origine (x=291) : un nom
    // long est réduit au lieu de courir sur la case « PRENOM ».
    drawAt: { page: 0, x: 74.9, y: BASELINE_NOM, size: 10, maxWidth: 214 },
    type: "text",
    required: true,
    label: { fr: "Nom" },
    prefillFrom: "profile.lastName",
    canonicalKey: "identity.nom",
    // Dans un dossier, le C1 a déjà donné nom et prénom : les deux champs
    // deviennent `autoAnswered` à l'ouverture et l'étape d'identité disparaît.
    // Sur l'URL publique, où il n'y a aucun C1 dont hériter, ils restent à
    // l'écran et obligatoires. Les six autres compagnons font de même.
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: -100,
  },
  {
    id: "prenom",
    pdfFieldName: "PRENOM",
    type: "text",
    required: true,
    label: { fr: "Prénom" },
    prefillFrom: "profile.firstName",
    canonicalKey: "identity.prenom",
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: -99,
  },
  {
    // Widget « Date de DA », aligné le 2026-08-02 sur la lecture qu'Oraliks a
    // arbitrée pour le MÊME widget du C1-Partenaire : une case de cachet dateur
    // réservée à l'organisme de paiement, donc facultative.
    //
    // `prefillFrom: "system.today"` en fait un champ AUTO (cf.
    // `isCreationDateField`) : il n'est jamais rendu à l'écran et le serveur y
    // pose la date du jour à la génération. C'est cohérent avec un cachet
    // dateur — mais pas avec le libellé imprimé, qui dit « date de la demande
    // d'allocations ». Un citoyen qui dépose cette annexe deux semaines après
    // son C1 verra donc la date du jour, sans pouvoir la corriger.
    //
    // Ne PAS justifier ce choix par le C1 principal : sa règle `date-header-p2`
    // ne pose pas `system.today`, elle reprend une date DÉCLARÉE
    // (`dateModificationEffective` / `dateDemande`, cf.
    // `bindings/per-form/c1-changement.ts`). Trois documents donnent aujourd'hui
    // deux sens à ce widget ; l'arbitrage définitif revient à Oraliks.
    id: "dateDA",
    pdfFieldName: "Date de DA",
    type: "date",
    required: false,
    label: { fr: "Date de la demande d'allocations" },
    help: {
      fr: "Case réservée à l'organisme de paiement (cachet dateur) — vous pouvez généralement la laisser vide.",
    },
    prefillFrom: "system.today",
    // Le papier imprime ici un guide en peigne. Sans `printAsComb`, la date
    // partait d'un bloc « 02/08/2026 » écrit PAR-DESSUS les tirets et leurs
    // barres obliques, et débordait du guide — même défaut qu'Oraliks avait
    // signalé sur le C1 le 2026-07-27.
    fontSize: 9,
    printAsComb: DATE_DA_COMB,
    section: SECTION_IDENTITE,
    order: -98,
  },

  // ====================================================================
  // TABLEAU DES DIFFÉRENCES (page 1, y=486 → 342)
  // Sept lignes de trois champs, dans l'ordre imprimé.
  // ====================================================================
  ...LIGNES.flatMap((ligne, i) => champsTableau(ligne, 100 + i * 10)),

  // ====================================================================
  // EXPLICATIONS (page 1, y=258 → 130) — un bloc séparé sur le papier.
  // ====================================================================
  ...LIGNES.map((ligne, i) => champExplication(ligne, 300 + i * 10)),

  // ====================================================================
  // PIED DE PAGE : « Je joins … preuves. » puis « Date – signature »
  // ====================================================================
  {
    id: "nombreAnnexesJointes",
    pdfFieldName: "Nombre d'annexe joint",
    type: "number",
    required: false,
    label: { fr: "Nombre d'annexes jointes" },
    section: SECTION_ANNEXES,
    order: 900,
  },
  champSignature({
    pdfFieldName: "Signature6",
    help: "Signature « façon Adobe » : votre nom + prénom + horodatage seront appliqués à la position de la signature.",
    order: 1000,
  }),

  // Cases administratives (page 2) : utilisées uniquement quand le Registre
  // national lui-même n'a aucune donnée exploitable — décision de
  // l'ONEM/bureau du chômage, pas une déclaration citoyenne. Masquées, donc
  // jamais stampées : ce sont les deux seuls widgets du formulaire qu'aucun
  // scénario de recette ne peut couvrir, et c'est voulu.
  {
    id: "regisRegistreIndisponible1",
    pdfFieldName:
      "La rubrique I ne peut pas être complétée parce que les données du Registre national ou des registres de la",
    type: "checkbox",
    required: false,
    label: { fr: "(cas administratif — registre indisponible)" },
    hidden: true,
    section: SECTION_ANNEXES,
    order: 1100,
  },
  {
    id: "regisRegistreIndisponible2",
    pdfFieldName:
      "La rubrique I nest pas entièrement complétée parce que le chômeur est uniquement connu dans les registres",
    type: "checkbox",
    required: false,
    label: { fr: "(cas administratif — registre partiellement indisponible)" },
    hidden: true,
    section: SECTION_ANNEXES,
    order: 1101,
  },
];

// ===========================================================================
// PARCOURS À L'ÉCRAN — une question = une étape (patron du C1A / C1C / C47)
// ===========================================================================

/// Étape de l'en-tête d'identité — la seule qui ne soit pas une question.
export const C1_REGIS_GROUPE_IDENTITE = "identite";

/// Les questions du document, DANS L'ORDRE IMPRIMÉ : une par ligne du tableau.
/// Chacune devient une étape et porte l'identifiant du champ qui la pose (son
/// ANCRE, cf. `stepAnchorField`), si bien que sa question titre l'étape.
///
/// `signature` ferme la liste sans jamais produire d'étape sur les documents où
/// le serveur pose la signature — ici il en produit une, car « Je joins …
/// preuves » lui est rattaché et reste à saisir.
export const C1_REGIS_QUESTIONS: readonly string[] = [
  ...LIGNES.map((l) => `${l.cle}Difference`),
  "signature",
];

/// Champs RATTACHÉS à une question : les trois précisions d'une ligne suivent
/// sa question « y a-t-il une différence ? » plutôt que de fabriquer trois
/// étapes vides quand la réponse est « non ».
const RATTACHEMENTS: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(
    LIGNES.map((l) => [
      `${l.cle}Difference`,
      [`${l.cle}C1`, `${l.cle}Registre`, `${l.cle}Explication`],
    ]),
  ),
  // Le bas du formulaire papier, d'un seul tenant : on compte ses annexes,
  // on date et on signe.
  signature: ["nombreAnnexesJointes"],
};

const CARTE_DES_GROUPES = carteDesGroupes(C1_REGIS_QUESTIONS, RATTACHEMENTS);

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id`).
///
/// Aucun `legacyIds` n'est passé, et ce n'est pas un oubli : les 42 widgets du
/// PDF sont TOUS revendiqués ci-dessus, donc la règle `pdfFieldName` de
/// `mergeEnrichedFields` évince à elle seule chaque champ auto-inféré resté en
/// base. Un `legacyIds` ne sert qu'aux champs dont le widget est passé à une
/// RÈGLE serveur — ce formulaire n'en a aucun.
export function applyC1RegisImprovements(fields: PdfFormField[]): PdfFormField[] {
  return appliquerGroupes(mergeEnrichedFields(fields, C1_REGIS_FIELDS), {
    parChamp: CARTE_DES_GROUPES,
    groupeEntete: C1_REGIS_GROUPE_IDENTITE,
    sectionsEntete: [SECTION_IDENTITE],
  });
}
