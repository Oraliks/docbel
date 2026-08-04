// FIN DE FORMULAIRE — extrait de `c1-fields-improvements.ts` (2026-07-26).
//
// Travailleur hors EEE, divers, affirmations, annexes, date et signature.
//
// Découpage PUREMENT structurel : les définitions sont déplacées telles
// quelles. Le tableau complet est réassemblé dans `./index.ts`, dans l'ordre
// des modules — c'est cet ordre qui détermine l'ordre d'affichage.

import type { PdfFormField } from "../../types";
import {
  SECTION_NON_EEE,
  SECTION_DIVERS,
  SECTION_AFFIRMATIONS,
  SECTION_ANNEXES,
  SECTION_SIGNATURE,
  YN,
  ouiNon,
  dejaDeclare,
  dateAPartirDu,
  COMB_DATE_C1,
  annexeJointe,
} from "./helpers";

export const C1_FINAL: PdfFormField[] = [
  // ====================================================================
  // SECTION — TRAVAILLEUR NON-EEE / SUISSE
  // ====================================================================
  // La rubrique du PDF pose TROIS questions successives (réfugié / apatride /
  // hors EEE), chacune avec sa paire oui-non. Pour un citoyen EEE les trois
  // réponses valent « non » : la règle serveur `hors-eee-non` les coche d'un
  // geste dès que `nationaliteHorsEEE === "non"`, et les deux premières
  // questions ne sont même pas posées à l'écran.
  //
  // Pour un ressortissant HORS EEE, en revanche, elles doivent être posées :
  // sans elles, un réfugié reconnu voyait son formulaire partir avec « non »
  // coché (2026-07-26, arbitrage Oraliks). Les widgets « oui » de ces deux
  // lignes étaient orphelins — c'était le symptôme.
  //
  // Les checkbox tolèrent plusieurs sources sur un même widget (cf.
  // mapping-report.ts#statusOf) : la règle et ces champs ne peuvent donc pas
  // se déclarer en conflit, et ils ne cochent jamais en même temps (la règle
  // ne se déclenche que sur « non », ces champs ne s'affichent que sur « oui »).
  // 2026-07-08 (Oraliks) : dérivé de `nationalit_3` (texte libre) via
  // `derivedFrom` — PAS `autoAnswered`, pour ne pas casser le `visibleIf` de
  // `accesMarcheTravail` (cf. field-derivations.ts#nationalite-hors-eee et le
  // piège documenté sur `motifIntroduction` plus haut dans ce fichier).
  // Verrouillé dès qu'une nationalité est saisie ; nationalité non reconnue
  // = traitée comme hors EEE (choix assumé malgré le texte libre, cf.
  // nationalite-eee.ts).
  {
    id: "nationaliteHorsEEE",
    pdfFieldName: "oui_18|non_19",
    type: "radio",
    required: true,
    label: {
      fr: "Êtes-vous ressortissant d'un pays HORS EEE et HORS Suisse ?",
    },
    help: {
      fr: "Déduit automatiquement de votre nationalité (ci-dessus) dès qu'elle est renseignée. L'EEE = UE + Islande + Liechtenstein + Norvège : belge, français, néerlandais, etc. → « non » coché automatiquement.",
    },
    options: YN,
    defaultValue: "non",
    derivedFrom: { fieldId: "nationalit_3", via: "nationalite-hors-eee" },
    section: SECTION_NON_EEE,
    order: 800,
    stepPriority: "optional",
  },
  {
    // Widget « oui » : le libellé imprimé est « oui → allez à la rubrique
    // suivante » (c'est le nom AcroForm, à reproduire au caractère près).
    id: "statutRefugie",
    pdfFieldName: "oui  allez à la rubrique suivante|non_17",
    type: "radio",
    required: false,
    label: { fr: "Êtes-vous reconnu réfugié ?" },
    options: YN,
    defaultValue: "non",
    visibleIf: { fieldId: "nationaliteHorsEEE", op: "equals", value: "oui" },
    section: SECTION_NON_EEE,
    order: 800.5,
    stepPriority: "optional",
  },
  {
    id: "apatrideReconnu",
    pdfFieldName: "oui  allez à la rubrique suivante_2|non_18",
    type: "radio",
    required: false,
    label: { fr: "Êtes-vous apatride reconnu ?" },
    options: YN,
    defaultValue: "non",
    visibleIf: { fieldId: "nationaliteHorsEEE", op: "equals", value: "oui" },
    section: SECTION_NON_EEE,
    order: 800.6,
    stepPriority: "optional",
  },
  {
    id: "accesMarcheTravail",
    pdfFieldName: "je dispose dun accès illimité au marché de lemploi|je dispose dun accès limité au marché de lemploi et jajoute une copie de mon document|Je ne dispose pas dun accès au marché de lemploi",
    type: "radio",
    required: false,
    label: { fr: "Mention au verso de mon permis de séjour quant à l'accès au marché du travail" },
    help: {
      fr: "« Illimité » : vous pouvez travailler pour tout employeur. « Limité » : restrictions précisées sur l'autorisation régionale. « Non » : aucun emploi possible (pas de droit aux allocations).",
    },
    options: [
      { value: "illimite", label: { fr: "Illimité" } },
      { value: "limite", label: { fr: "Limité" } },
      { value: "non", label: { fr: "Non" } },
    ],
    visibleIf: { fieldId: "nationaliteHorsEEE", op: "equals", value: "oui" },
    section: SECTION_NON_EEE,
    order: 801,
    stepPriority: "optional",
  },
  {
    // « Limité » = le citoyen ne peut travailler que dans le cadre défini par
    // la Région (un seul employeur, une durée, une rémunération…). La C1-Info
    // impose alors d'indiquer le motif OU de joindre l'autorisation régionale.
    // Sans ce champ, la ligne imprimée restait vide et le motif se perdait.
    id: "raisonLimitationAccesMarche",
    pdfFieldName: "Décrivez ciaprès la raison de la limitation ou ajoutez une copie de lautorisation",
    type: "text",
    required: false,
    label: { fr: "Raison de la limitation d'accès au marché du travail" },
    help: {
      fr: "La raison figure sur votre autorisation d'occupation régionale (études, employeur unique, durée limitée…). Vous pouvez aussi joindre une copie de l'autorisation plutôt que de la recopier ici.",
    },
    visibleIf: { fieldId: "accesMarcheTravail", op: "equals", value: "limite" },
    section: SECTION_NON_EEE,
    order: 801.5,
    stepPriority: "optional",
  },

  // ====================================================================
  // SECTION — DIVERS
  // ====================================================================
  ouiNon({
    id: "congeSansSolde",
    pdfFieldName: "oui du|non_20",
    label: "Je suis actuellement dans une période de congé sans solde",
    // Pas de `help` : le label EST déjà la question complète imprimée.
    section: SECTION_DIVERS,
    order: 900,
  }),
  {
    // Cohérent avec son jumeau `congeSansSoldeDateFin` (« Jusqu'au »,
    // help déjà présente juste en dessous) — celui-ci précise le début.
    ...dateAPartirDu({
      id: "congeSansSoldeDate",
      pdfFieldName: "Date11_af_date",
      parentId: "congeSansSolde",
      section: SECTION_DIVERS,
      order: 901,
    }),
    help: { fr: "Date de début du congé sans solde." },
  },
  {
    // La ligne imprimée est « oui, du … au … » : seule la borne de DÉBUT était
    // branchée, la case de fin (`Date12_af_date`) restait orpheline et la
    // période partait sans terme (2026-07-26).
    id: "congeSansSoldeDateFin",
    pdfFieldName: "Date12_af_date",
    type: "date",
    required: false,
    label: { fr: "Jusqu'au" },
    help: { fr: "Laissez vide si la période n'a pas encore de date de fin connue." },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    // Même guide en cases que la borne de début, juste à sa gauche sur la même
    // ligne imprimée : sans peigne, la date s'écrasait sur les tirets.
    fontSize: 9,
    printAsComb: COMB_DATE_C1,
    section: SECTION_DIVERS,
    order: 902,
    stepPriority: "optional",
  },
  {
    // Boîte de remarque libre en bas de la page 1 (deux lignes imprimées) :
    // c'est là qu'on écrit ce qu'aucune case ne permet de dire, par exemple
    // « Application de l'article 60B », pour que l'ONEM le reprenne dans sa
    // décision. Ouverte au citoyen mais jamais obligatoire (Oraliks
    // 2026-07-26) — en pratique c'est surtout l'expert qui l'accompagne qui
    // l'utilisera.
    //
    // Pas de `pdfFieldName` : la répartition sur les DEUX lignes est faite par
    // la règle serveur `remarque-libre` (cf. bindings/per-form/c1-changement).
    id: "remarqueLibreOnem",
    pdfFieldName: "",
    type: "textarea",
    required: false,
    label: { fr: "Remarque à l'attention de l'ONEM" },
    help: {
      fr: "Facultatif. À utiliser seulement s'il reste quelque chose d'important à signaler que le formulaire ne permet pas d'exprimer. Deux lignes disponibles sur le document.",
    },
    section: SECTION_DIVERS,
    order: 950,
    stepPriority: "optional",
  },
  ouiNon({
    id: "incapacite33",
    pdfFieldName: "oui_19|non_21",
    label: "Je présente une incapacité de travail permanente d'au moins 33 %",
    help: "→ Si oui, joindre un FORMULAIRE C47-DEMANDE pour fixer le montant des allocations (pas de dégressivité).",
    section: SECTION_DIVERS,
    order: 910,
  }),
  dejaDeclare({
      id: "incapacite33DejaDeclare",
      parentId: "incapacite33",
      helpText: "Si non, vous devrez compléter le FORMULAIRE C47 — il sera ajouté à votre parcours.",
      section: SECTION_DIVERS,
      order: 911,
      stepPriority: "optional",
    }),

  // ====================================================================
  // SECTION — AFFIRMATIONS OBLIGATOIRES
  // Les 3 cases doivent être cochées pour valider la déclaration —
  // required=true + helper qui explique la portée.
  // ====================================================================
  {
    id: "affirmationSincerite",
    pdfFieldName: "Jaffirme sur lhonneur que la présente déclaration est sincère et complète",
    type: "checkbox",
    required: true,
    label: {
      fr: "J'affirme sur l'honneur que la présente déclaration est sincère et complète",
    },
    // Pas de `help` : le label EST la déclaration légale complète imprimée
    // — rien à ajouter sans la répéter.
    // labelShort mobile (Phase 4 du plan bindings-canonical-ux). Le sens
    // légal est préservé — c'est bien la même déclaration sur l'honneur,
    // formulée plus terse pour tenir sur mobile.
    labelShort: { fr: "Je déclare sur l'honneur que tout est exact" },
    section: SECTION_AFFIRMATIONS,
    order: 1000,
  },
  {
    id: "affirmationLectureNotice",
    pdfFieldName: "Jai lu la feuille dinformations",
    type: "checkbox",
    required: true,
    label: { fr: "J'ai lu la feuille d'informations C1" },
    // Pas de `help` : le label EST la déclaration légale complète imprimée.
    labelShort: { fr: "J'ai lu la feuille d'info C1" },
    section: SECTION_AFFIRMATIONS,
    order: 1001,
  },
  {
    id: "affirmationModifications",
    pdfFieldName: "Je sais que je dois communiquer toute modification à mon organisme de paiement et si je ne le fais pas je peux être sanctionnée",
    type: "checkbox",
    required: true,
    label: {
      fr: "Je sais que je dois communiquer toute modification à mon organisme de paiement et que je peux être sanctionné(e) si je ne le fais pas",
    },
    // Pas de `help` : le label EST la déclaration légale complète imprimée.
    labelShort: { fr: "Je signalerai tout changement" },
    section: SECTION_AFFIRMATIONS,
    order: 1002,
  },

  // ====================================================================
  // SECTION — ANNEXES (optionnelles)
  // ====================================================================
  {
    ...annexeJointe({
      id: "annexeHandicap",
      pdfFieldName: "une attestation de la DG Personnes handicapées du SPF Sécurité sociale",
      order: 1100,
    }),
    // Pas de `help` : le libellé nomme déjà exactement le document attendu.
  },
  {
    ...annexeJointe({
      id: "annexeExtraitPension",
      pdfFieldName: "une copie de l'extrait de la pension",
      order: 1101,
    }),
    // Pas de `help` : le libellé nomme déjà exactement le document attendu.
  },
  {
    ...annexeJointe({
      id: "annexeC1Regis",
      pdfFieldName: "un FORMULAIRE C1 ANNEXE REGIS",
      order: 1102,
    }),
    // Pas de `help` : le libellé nomme déjà exactement le document attendu.
  },
  {
    ...annexeJointe({
      id: "annexePermisSejour",
      pdfFieldName: "une copie du permis de séjour et/ou du permis de travail",
      order: 1103,
    }),
    // Pas de `help` : le libellé nomme déjà exactement le document attendu.
  },
  {
    ...annexeJointe({
      id: "annexeAutre",
      pdfFieldName: "autre",
      label: "J'ai joint un autre document (préciser ci-dessous)",
      order: 1104,
    }),
    // Pas de `help` : le libellé nomme déjà exactement le document attendu.
  },
  {
    id: "annexeAutreDescription",
    pdfFieldName: "Texte18",
    type: "text",
    required: false,
    label: { fr: "Description du document joint" },
    // Pas de `help` : aucun texte imprimé propre à ce champ.
    visibleIf: { fieldId: "annexeAutre", op: "equals", value: true },
    section: SECTION_ANNEXES,
    order: 1105,
    stepPriority: "optional",
  },

  // ====================================================================
  // SECTION — DATE + SIGNATURE
  // ====================================================================
  {
    id: "dateSignature",
    pdfFieldName: "",
    type: "date",
    // Volontairement non-required cote Zod (Oraliks 2026-07-07 : "Date et
    // signatue sont generer en auto"). Auto-rempli au mount + refill submit +
    // reinjecte serveur — Zod required ne peut que bloquer sur un champ que
    // l'utilisateur ne voit meme pas.
    required: false,
    label: { fr: "Date de signature" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour." },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 1200,
  },
  {
    id: "signature",
    // Widget signature « SignatureDuChômeur » d'Oraliks (page 2, bas, rect
    // ~x257 y48 w150 h32). Le filler localise le rectangle via `technicalSchema`
    // puis y dessine la signature manuscrite « façon Adobe » (nom en police
    // cursive Dancing Script) + mention « Signé par » + horodatage. L'ancien
    // widget « Signature » (ajouté jadis par scripts/add-c1-signature-widget.ts)
    // n'existe plus dans l'AcroForm remanié par Oraliks.
    pdfFieldName: "SignatureDuChômeur",
    type: "signature",
    // Non-required cote Zod : auto-confirmee via signerName (nom+prenom
    // resolus depuis l'identite du citoyen), bloc « facon Adobe » applique
    // par le serveur. Le required Zod est redondant et cassait le submit
    // quand le signerName resolution ratait au premier submit.
    required: false,
    label: { fr: "Signature électronique" },
    help: { fr: "Signature « façon Adobe » : votre nom + prénom + horodatage seront appliqués à la position de la signature." },
    section: SECTION_SIGNATURE,
    order: 1201,
  },
];
