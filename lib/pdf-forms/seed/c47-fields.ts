// Schéma enrichi du formulaire "C47 - DEMANDE DE FIXATION DES ALLOCATIONS"
// (incapacité permanente au travail de 33 % au moins).
//
// Petit formulaire compagnon (1 page, 11 widgets AcroForm), déclenché depuis
// le C1 quand le citoyen répond "oui" à la question "incapacité de travail
// permanente d'au moins 33 %" (cf. C1_TRIGGERS dans c1-fields-improvements.ts,
// requiresFormSlug: "c47").
//
// Base légale imprimée sur le PDF officiel :
//   - art. 114 AR 25.11.1991 : fixation du montant de l'allocation en dehors
//     du contrôle de la disponibilité active.
//   - art. 36/3, § 2 AR 25.11.1991 : jeune travailleur en stage d'insertion
//     professionnelle, dans le cadre du contrôle de la disponibilité active.
//   - art. 58, § 1er et art. 58/3, § 4 AR 25.11.1991 : chômeur complet
//     indemnisé, dans le cadre du contrôle de la disponibilité active.
//   - art. 63, § 2, al. 4, 4° AR 25.11.1991 : renvoi depuis le C1.
//
// Mapping AcroForm : 11 champs, pdfFieldName vérifié tel quel — aucune
// modification de casse/espaces (`pnpm tsx scripts/dump-pdf-widgets.ts C47_FR`).
// Version imprimée : 01.10.2020/833.10.047.
//
// Repris le 2026-07-30 (cf. docs/superpowers/plans/2026-07-30-formulaires-onem-restants.md) :
// case « art. 114 » rendue cochable (elle partageait son champ AcroForm avec
// « jeune travailleur »), peignes imprimés, héritage du dossier, parcours en
// deux étapes. Les quatre « A VALIDER Oraliks » du seed d'origine sont tranchés
// et documentés à l'endroit de la décision.

import type { PdfFormField } from "../types";
import { mergeEnrichedFields } from "./_merge";

const SECTION_IDENTITE = "identite";
const SECTION_ADRESSE = "adresse";
const SECTION_DEMANDE = "demande";
const SECTION_SIGNATURE = "signature";

// ===========================================================================
// PEIGNES IMPRIMÉS
// ===========================================================================
//
// Le C47 imprime TROIS guides en peigne (« __ __ / __ __ … »), là où le C1C
// n'en avait aucun : y écrire une chaîne entière doublerait les séparateurs
// déjà dessinés (« 85.07.14-231.05 » par-dessus « __ / __ - __ »), défaut
// signalé par Oraliks sur le C1 le 2026-07-27. Un chiffre par case, donc.
//
// Toutes les valeurs ci-dessous sont MESURÉES à pdfplumber sur
// `private/pdfs/C47_FR.pdf` (abscisse de chaque tiret, ligne de base du guide),
// jamais approchées à l'œil. `baselineY` tient compte du fait que pdfplumber
// rapporte le BAS de la boîte du caractère, soit la ligne de base moins le
// jambage de la police (ArialMT : 0,212 em).

/// « N° registre national (NISS) __ __ __ __ __ __ / __ __ __ - __ __ »
/// (page 1, y=540,8). Pas relevé : 11,26 pt ; les « / » et « - » imprimés
/// ajoutent 4,80 pt. Case du widget : bas à y=539,6, d'où baselineY=1,2.
const NISS_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [6, 3, 2],
  slotWidth: 11.26,
  groupExtra: 4.8,
  startX: 2.23,
  baselineY: 1.2,
};

/// « Date : __ __ / __ __ / __ __ __ __ » du pied de page (y=61,2). Huit
/// cases, pas de 12,64 pt, séparateurs à 5,15 pt. Case : bas à y=58,8.
const DATE_SIGNATURE_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [2, 2, 4],
  slotWidth: 12.64,
  groupExtra: 5.15,
  startX: 3.39,
  baselineY: 2.42,
};

/// « à partir du __ __ / __ __ / __ __ __. » (y=378,4) — le guide de l'ONEM
/// n'imprime que TROIS cases pour l'année, là où il en faut quatre. Au pas
/// réellement mesuré (12,51 pt, séparateurs 5,00) le quatrième chiffre de
/// l'année tomberait à x=386,9, c'est-à-dire SUR le « (art. 114 AR 25.11.1991) »
/// imprimé qui commence à x=387,1. Le peigne est donc légèrement resserré
/// (12,0 / 4,3) : le jour tombe pile sur ses tirets, le mois et l'année
/// dérivent d'au plus 4,5 pt vers la gauche, et « 2026 » tient en entier avant
/// la parenthèse. Compresser est le seul arbitrage possible ici — le guide
/// imprimé est faux, et une année tronquée ou chevauchée serait pire.
///
/// `startX` recule d'1,5 pt sur le centrage théorique (2,66) : relu sur un PDF
/// généré, le « 6 » de 2026 mordait encore de 0,6 pt sur la parenthèse. À 1,16
/// il s'arrête 0,9 pt avant, et le premier chiffre reste sur son tiret.
const DATE_DEMANDE_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [2, 2, 4],
  slotWidth: 12.0,
  groupExtra: 4.3,
  startX: 1.16,
  baselineY: 1.73,
};

export const C47_FIELDS: PdfFormField[] = [
  // ==========================================================================
  // Votre identité
  // ==========================================================================
  {
    // `prefillFrom` retiré le 2026-07-26 : sur un champ `fullname` il ne
    // transportait que le NOM, et le runner relisant une chaîne comme un nom,
    // le prénom se perdait. Le type suffit — cf. `canonicalToPrefill` et
    // `buildProfilePrefill`, qui remplissent tous deux les composites.
    id: "pr_nom_et_nom",
    pdfFieldName: "Prénom et nom",
    type: "fullname",
    required: true,
    label: { fr: "Prénom et nom" },
    // Le bas de la case coïncide avec la ligne pointillée imprimée (mesuré :
    // écart de 0,03 pt sur les cinq guides de la page), exactement comme sur
    // le C1C — le texte se pose donc sur le trait au lieu de flotter au-dessus.
    alignTextToGuide: true,
    // Dans un dossier, le C1 a déjà donné le nom : `applyDossierInheritance`
    // rend le champ `autoAnswered` à l'ouverture et l'étape d'identité perd un
    // champ visible. Sur l'URL publique `/document/onem/c47`, où il n'y a aucun
    // C1 dont hériter, il reste à l'écran et obligatoire.
    inheritedFromDossier: true,
    section: SECTION_IDENTITE,
    order: 0,
  },
  // ADRESSE — les deux widgets du PDF fusionnent chacun DEUX informations. On
  // saisit donc les quatre valeurs séparément, chacune canonisée pour hériter
  // du C1, et deux règles serveur recomposent les lignes imprimées
  // (`bindings/per-form/c47.ts`). Même pattern que le C1A.
  //
  // Ordre d'assemblage : rue puis numéro, code postal puis commune (confirmé
  // par Oraliks le 2026-07-26). Les noms de widgets du C47 disent l'inverse
  // (« Commune et code postal ») et son libellé d'origine disait « Numéro et
  // rue » : c'est SANS IMPORTANCE. Les formulaires ONEM alternent librement
  // « nom, prénom » et « prénom, nom », idem pour l'adresse — ces libellés ne
  // dictent pas l'ordre attendu dans la case.
  {
    id: "rue",
    pdfFieldName: "",
    // Le widget est nommé EXPLICITEMENT : la valeur y est écrite par la règle
    // serveur « adresse-rue-numero », ce champ n'a donc pas de `pdfFieldName`
    // dont déduire la cible à abaisser.
    alignTextToGuide: ["Rue"],
    type: "text",
    required: true,
    label: { fr: "Rue" },
    prefillFrom: "profile.street",
    canonicalKey: "adresse.rue",
    inheritedFromDossier: true,
    section: SECTION_ADRESSE,
    order: 1,
  },
  {
    id: "numero",
    pdfFieldName: "",
    type: "text",
    required: true,
    label: { fr: "Numéro" },
    canonicalKey: "adresse.numero",
    inheritedFromDossier: true,
    section: SECTION_ADRESSE,
    order: 1.5,
  },
  {
    id: "codePostal",
    pdfFieldName: "",
    // Idem : la ligne imprimée est écrite par « code-postal-commune ».
    alignTextToGuide: ["Commune et code postal"],
    type: "postal_be",
    required: true,
    label: { fr: "Code postal" },
    prefillFrom: "profile.postalCode",
    canonicalKey: "adresse.codePostal",
    inheritedFromDossier: true,
    section: SECTION_ADRESSE,
    order: 2,
  },
  {
    id: "commune",
    pdfFieldName: "",
    type: "text",
    required: true,
    label: { fr: "Commune" },
    prefillFrom: "profile.city",
    canonicalKey: "adresse.commune",
    inheritedFromDossier: true,
    section: SECTION_ADRESSE,
    order: 2.5,
  },
  {
    id: "niss",
    pdfFieldName: "NISS",
    type: "niss",
    required: true,
    label: { fr: "Numéro NISS (registre national)" },
    help: {
      fr: "11 chiffres au dos de ta carte d'identité (eID), au-dessus du code-barres.",
    },
    placeholder: { fr: "00.00.00-000.00" },
    prefillFrom: "profile.niss",
    canonicalKey: "identity.niss",
    inheritedFromDossier: true,
    // Guide imprimé en peigne : un chiffre par case, points et tirets du NISS
    // retirés au dessin (ils sont DÉJÀ imprimés sur le guide).
    fontSize: 9,
    printAsComb: NISS_COMB,
    section: SECTION_IDENTITE,
    order: 3,
  },
  // TÉLÉPHONE ET E-MAIL — muets à l'écran, comme sur le C1 (Oraliks
  // 2026-07-31). Le formulaire imprime lui-même « Les données "téléphone" et
  // "e-mail" sont facultatives » : deux cases de plus à remplir pour rien.
  //
  // `autoAnswered`, et non `hidden` comme sur le C1. Les deux retirent le champ
  // de l'écran ; `hidden` le retire EN PLUS du PDF, et la case part alors
  // blanche même quand la valeur est connue — c'est le défaut relevé sur le C1
  // dans PDF_FORMS_RULES.md, pas un modèle à recopier. Avec `autoAnswered`, la
  // valeur venue du dossier ou du profil s'imprime, et le citoyen n'a rien à
  // saisir. `inheritedFromDossier` devient inutile : le champ est masqué dans
  // tous les cas, plus seulement quand le dossier le pourvoit.
  {
    id: "t_l_phone",
    pdfFieldName: "Téléphone",
    alignTextToGuide: true,
    type: "phone_be",
    required: false,
    label: { fr: "Téléphone" },
    help: { fr: "Facultatif." },
    prefillFrom: "profile.phone",
    canonicalKey: "contact.telephone",
    autoAnswered: true,
    section: SECTION_IDENTITE,
    order: 4,
  },
  {
    id: "email",
    pdfFieldName: "Email",
    alignTextToGuide: true,
    type: "email",
    required: false,
    label: { fr: "E-mail" },
    help: { fr: "Facultatif." },
    prefillFrom: "profile.email",
    canonicalKey: "contact.email",
    autoAnswered: true,
    section: SECTION_IDENTITE,
    order: 5,
  },
  // NOTE canonique : `pr_nom_et_nom` (fullname composite) et `rue` +
  // `commune_et_code_postal` (widgets combinés « rue+numéro » et
  // « commune+CP ») ne sont pas tagués canonicalKey — leur structure n'est
  // pas 1-clé/1-valeur.

  // ==========================================================================
  // Votre demande — UNE question, TROIS cases exclusives
  // ==========================================================================
  //
  // Le papier ouvre deux cadres, et la parenthèse de leurs titres dit qu'ils
  // s'excluent : « Votre demande (si elle NE s'inscrit PAS dans le cadre du
  // contrôle de la disponibilité active…) » puis « Votre demande (si elle
  // s'inscrit dans le cadre…) ». Trois cases à cocher au total, une par
  // situation — d'où un unique choix à l'écran plutôt que trois cases que rien
  // n'empêcherait de cocher ensemble.
  //
  // ⚠ AUCUNE de ces trois cases n'est écrite par son champ AcroForm, et c'est
  // le défaut que ce lot répare. Le champ
  // « Je suis un jeune travailleur…(art. 36/3, § 2, AR 25.11.1991) » porte DEUX
  // widgets (`/Kids`, vérifié à pypdf) :
  //
  //   • page 1, y=394,6 — la case « Je demande que le montant de mon
  //     allocation de chômage soit fixé à partir du … » (art. 114), qui est
  //     dans l'AUTRE cadre ;
  //   • page 1, y=274,9 — la case « jeune travailleur en stage d'insertion ».
  //
  // Deux widgets d'un même champ partagent une seule valeur : cocher « jeune
  // travailleur » cochait donc AUSSI la demande de fixation du montant, deux
  // déclarations contradictoires sur une même déclaration officielle — et la
  // case art. 114, la plus courante (c'est elle que vise le déclencheur du C1),
  // était impossible à cocher seule. Le seed précédent avait relevé le doute
  // (« aucun widget checkbox distinct ne semble exister pour le cas 1 ») sans
  // voir qu'il s'agissait du second widget d'un champ déjà mappé.
  //
  // Sortie : ÉCRITURE POSITIONNELLE des trois cases, comme pour `TVA` /
  // `Montant` / `1_3` du C1A (cf. PDF_FORMS_RULES.md). Coordonnées mesurées et
  // dessin dans `bindings/per-form/c47.ts` + `POSITIONAL_EXTRA_STAMPS`
  // (filler.ts). Les trois cases sont traitées pareil — y compris « chômeur
  // complet indemnisé », dont le champ AcroForm est pourtant sain — pour que
  // les trois croix aient exactement la même forme sur le papier.
  {
    id: "cadreDemande",
    // Aucune case revendiquée ici : les trois croix sont dessinées par les
    // règles serveur. Revendiquer en plus le champ AcroForm serait un conflit
    // de mapping (deux sources pour la même case), à juste titre.
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "Que demandez-vous ?" },
    // Les trois libellés sont recopiés du formulaire imprimé, articles
    // compris — aucun texte réglementaire n'est reformulé.
    options: [
      {
        value: "art114",
        label: {
          fr: "Je demande que le montant de mon allocation de chômage soit fixé à partir d'une date précise (art. 114)",
        },
      },
      {
        value: "jeune-travailleur",
        label: {
          fr: "Je suis un jeune travailleur en stage d'insertion professionnelle et j'invoque une inaptitude permanente au travail de 33 % au moins (art. 36/3, § 2)",
        },
      },
      {
        value: "chomeur-indemnise",
        label: {
          fr: "Je suis chômeur complet indemnisé et j'invoque une inaptitude permanente au travail de 33 % au moins (art. 58, § 1er, et 58/3, § 4)",
        },
      },
    ],
    help: {
      fr: "Les deux dernières réponses ne valent que si votre demande s'inscrit dans le cadre du contrôle de la disponibilité active par le service régional de l'emploi compétent ; la première, si elle ne s'y inscrit pas. Une seule case est cochée sur le formulaire.",
    },
    // Le formulaire imprime « Document à joindre » sous les deux cadres : la
    // pièce est due QUEL QUE SOIT le cadre choisi, d'où un encart posé sur la
    // question elle-même et non sur telle ou telle réponse. Les deux phrases
    // sont recopiées du PDF (titre + sa phrase), rien n'est reformulé.
    notice: {
      text: {
        fr: "Document à joindre : certificat médical qui atteste de votre inaptitude permanente au travail (l'indication du taux d'inaptitude n'est pas obligatoire).",
      },
      tone: "info",
    },
    section: SECTION_DEMANDE,
    order: 100,
  },
  {
    // La date n'est imprimée que dans le PREMIER cadre (« à partir du __ __ /
    // __ __ / __ __ __ », art. 114) : le second n'en ouvre aucune. Elle ne se
    // demande donc que sur cette branche — `buildValidator` saute les champs
    // invisibles, `required` reste donc propre au chemin emprunté.
    id: "dateDA",
    pdfFieldName: "Date de DA",
    type: "date",
    required: true,
    label: { fr: "Date de début de l'inaptitude permanente de 33 %" },
    help: {
      fr: "La consigne imprimée en marge du formulaire dit : « Indiquez ici la date de début de l'inaptitude permanente de 33 % ». C'est aussi la date à partir de laquelle vous demandez que le montant de votre allocation soit fixé (art. 114).",
    },
    visibleIf: { fieldId: "cadreDemande", op: "equals", value: "art114" },
    fontSize: 9,
    printAsComb: DATE_DEMANDE_COMB,
    section: SECTION_DEMANDE,
    order: 101,
  },

  // ==========================================================================
  // Document à joindre (rappel imprimé sur le PDF — pas de widget dédié)
  // ==========================================================================
  // Aucun widget AcroForm ne correspond au certificat médical : il n'y a donc
  // aucun champ à créer ici. Le rappel est devenu le `notice` de `cadreDemande`
  // (Oraliks 2026-07-31) — un citoyen qui remplit ce formulaire hors dossier ne
  // voyait nulle part qu'une pièce lui serait réclamée.

  // ==========================================================================
  // Signature
  // ==========================================================================
  {
    id: "aujourd_hui",
    pdfFieldName: "AUJOURD'HUI",
    type: "date",
    required: true,
    label: { fr: "Date" },
    help: { fr: "Date à laquelle vous signez cette déclaration." },
    prefillFrom: "system.today",
    // « Date : __ __ / __ __ / __ __ __ __ » — guide en peigne, huit cases.
    fontSize: 9,
    printAsComb: DATE_SIGNATURE_COMB,
    section: SECTION_SIGNATURE,
    order: 200,
  },
  {
    id: "signature",
    pdfFieldName: "Signature",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique" },
    help: {
      fr: "En signant, tu affirmes sur l'honneur que ta déclaration est sincère et complète.",
    },
    section: SECTION_SIGNATURE,
    order: 201,
  },
];

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id`).
/// Champs d'une version antérieure dont le widget est désormais écrit par une
/// RÈGLE serveur. Sans cette liste ils survivraient en base — ce filtre ne
/// compare que les `id`, pas les `pdfFieldName` — et se battraient avec la
/// règle pour le même widget.
const LEGACY_C47_FIELD_IDS = new Set<string>([
  // Scindé en `codePostal` + `commune` (2026-07-26) ; le widget fusionné est
  // recomposé par `bindings/per-form/c47.ts`.
  "commune_et_code_postal",
  // Les deux cases « inaptitude 33 % » (2026-07-30), remplacées par le choix
  // unique `cadreDemande`. Elles DOIVENT disparaître de la base : la première
  // revendiquait un champ AcroForm à deux widgets et cochait au passage la case
  // « art. 114 » de l'autre cadre (cf. le commentaire de `cadreDemande`), et la
  // laisser vivre la ferait se battre avec la règle serveur pour la même case.
  "jeuneTravailleurStageInsertion",
  "chomeurCompletIndemniseInaptitude",
]);

// ===========================================================================
// PARCOURS À L'ÉCRAN — une question = une étape (patron du C1A / C1C)
// ===========================================================================
//
// Le repli par défaut découpait par SECTION : quatre étapes, dont une
// « Votre identité » et une « Adresse » que le C1 vient de renseigner. Avec
// l'héritage de dossier posé plus haut, l'en-tête d'identité ne produit plus
// aucune étape dans un dossier, et il reste deux écrans : ce qu'on demande,
// puis la signature.

/// Étape de l'en-tête d'identité — la seule qui ne soit pas une question.
/// Déclarée ici pour que ce fichier (qui la pose) et `form-presentation.ts`
/// (qui la place en tête) désignent la même chose.
export const C47_GROUPE_IDENTITE = "identite";

/// Les questions du document, DANS L'ORDRE IMPRIMÉ. Chacune devient une étape
/// et porte l'identifiant du champ qui la pose : ce champ est alors l'ANCRE de
/// son étape (cf. `stepAnchorField`), et c'est sa question qui titre l'étape.
///
/// Le C47 n'en pose qu'UNE. Le groupe `signature` ne produit d'étape sur aucun
/// chemin — la date du jour et la signature sont posées par le serveur
/// (`applyServerAutoFields`), donc `buildMacroSteps` ne les voit jamais comme
/// des champs visibles. Il existe pour que ces deux champs aient un groupe
/// nommé plutôt que de tomber dans « Autres informations », et il ne coûte
/// rien tant qu'il reste vide. Le papier n'imprime d'ailleurs aucune case pour
/// son « J'affirme sur l'honneur… » : il n'y a rien à cocher là.
export const C47_QUESTIONS: readonly string[] = ["cadreDemande", "signature"];

/// Champs RATTACHÉS à une question : ils la suivent sur son étape et ne
/// fabriquent pas d'étape à eux seuls.
const RATTACHEMENTS: Readonly<Record<string, readonly string[]>> = {
  // La date n'existe que sur la branche « art. 114 » : elle appartient à la
  // question, pas à une étape séparée.
  cadreDemande: ["dateDA"],
  // Le bas du formulaire papier, d'un seul tenant : on date et on signe.
  signature: ["aujourd_hui"],
};

/// Pose `stepGroup` sur chaque champ. L'identité ET l'adresse tombent dans le
/// groupe d'en-tête (elles se lisent d'un bloc sur le papier) ; un champ
/// inconnu des deux tables reste sans groupe et atterrit dans « Autres
/// informations » de la dernière étape — repli visible, jamais une perte.
function appliquerGroupes(fields: PdfFormField[]): PdfFormField[] {
  const parChamp = new Map<string, string>();
  for (const question of C47_QUESTIONS) parChamp.set(question, question);
  for (const [question, rattaches] of Object.entries(RATTACHEMENTS)) {
    for (const id of rattaches) parChamp.set(id, question);
  }
  return fields.map((f) => {
    const groupe =
      parChamp.get(f.id) ??
      (f.section === SECTION_IDENTITE || f.section === SECTION_ADRESSE
        ? C47_GROUPE_IDENTITE
        : undefined);
    return groupe ? { ...f, stepGroup: groupe } : f;
  });
}

export function applyC47Improvements(fields: PdfFormField[]): PdfFormField[] {
  return appliquerGroupes(mergeEnrichedFields(fields, C47_FIELDS, LEGACY_C47_FIELD_IDS));
}
