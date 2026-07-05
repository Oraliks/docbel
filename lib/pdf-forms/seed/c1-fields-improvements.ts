// Schéma enrichi du formulaire C1 — couvre l'ensemble du PDF officiel ONEM.
//
// Patterns de mapping pdfFieldName utilisés ici :
//   - "widget"               → champ texte, date, checkbox simple
//   - "oui_N|non_N"          → radio à 2 options sur paire de checkboxes ONEM
//   - "wA|wB|wC|wD"          → radio à N options sur N checkboxes distincts
//                              (ex. motifIntroduction : 4 cases mutuellement
//                              exclusives sur le PDF, cf. filler.ts pour la
//                              généralisation à N).
//   - "widget|"              → option « oui » seule a une case sur le PDF
//                              (l'option « non » ne coche rien).
//   - ""                     → champ virtuel : capturé dans le payload mais
//                              pas stampé sur le PDF (ex. follow-ups
//                              pédagogiques, ou champs sans widget officiel).
//
// Mapping AcroForm vérifié sur private/pdfs/C1_FR.pdf via scripts/dump-c1.ts.
// Référence métier : feuille d'information C1 (version 01.01.2024/831.10.000).

import type { PdfFormField, PdfFormTrigger } from "../types";

const SECTION_IDENTITE = "identite";
const SECTION_DEMANDE = "demande";
const SECTION_SITUATION_FAMILIALE = "situation-familiale";
const SECTION_ACTIVITES = "mes-activites";
const SECTION_REVENUS = "mes-revenus";
const SECTION_PAIEMENT = "mode-paiement";
const SECTION_COTISATION = "cotisation-syndicale";
const SECTION_NON_EEE = "non-eee";
const SECTION_DIVERS = "divers";
const SECTION_AFFIRMATIONS = "affirmations";
const SECTION_ANNEXES = "annexes";
const SECTION_SIGNATURE = "signature";

/// Options communes oui/non. Premier élément = mappé à la case "oui_N",
/// second élément = mappé à la case "non_N".
const YN = [
  { value: "oui", label: { fr: "Oui", nl: "Ja", de: "Ja" } },
  { value: "non", label: { fr: "Non", nl: "Nee", de: "Nein" } },
];

/// Options du follow-up "déjà déclaré à l'organisme de paiement ?".
const YN_DECLARE = [
  { value: "oui", label: { fr: "Oui, déjà déclaré à l'organisme de paiement", nl: "", de: "" } },
  { value: "non", label: { fr: "Non, à compléter maintenant", nl: "", de: "" } },
];

/// Construit un champ radio "déjà déclaré ?" virtuel par défaut (pas de widget
/// PDF correspondant). Si `pdfFieldName` est fourni (paire dejaDeclareWidget|
/// declareWidget), on stamp les deux cases : "oui = déjà déclaré" coche la 1ʳᵉ,
/// "non = à compléter" coche la 2ᵉ.
function dejaDeclare(opts: {
  id: string;
  parentId: string;
  helpText: string;
  section: string;
  order: number;
  pdfFieldName?: string;
}): PdfFormField {
  return {
    id: opts.id,
    pdfFieldName: opts.pdfFieldName ?? "",
    type: "radio",
    required: false,
    label: { fr: "Avais-tu déjà déclaré cette situation à ton organisme de paiement ?", nl: "", de: "" },
    help: { fr: opts.helpText, nl: "", de: "" },
    options: YN_DECLARE,
    visibleIf: { fieldId: opts.parentId, op: "equals", value: "oui" },
    section: opts.section,
    order: opts.order,
  };
}

/// Schéma enrichi pour les 15 questions oui/non + 5 follow-ups
/// "déjà déclaré ?". Chaque question est typée `radio` avec options [oui, non]
/// et pointe vers la paire de checkboxes correspondante sur le PDF.
///
/// Note : seules ces questions sont définies ici. Les autres champs du C1
/// (identité, adresse, mode de paiement, situation familiale…) conservent
/// leur définition existante — voir applyC1Improvements() pour l'overlay.
export const C1_QUESTIONS: PdfFormField[] = [
  // ====================================================================
  // SECTION 0 — IDENTITÉ & ADRESSE (page 1, en haut du PDF)
  // Ces champs étaient auparavant inférés automatiquement à l'import :
  // libellés laids ("nationalité 3", "numéro de boîte"…) et tous typés
  // "text" sans validation. On les enrichit ici avec libellés FR propres,
  // types sémantiques (niss, postal_be, phone_be, email, date) et prefill
  // depuis le profil utilisateur quand c'est pertinent.
  //
  // Les `id` reprennent ceux que `field-inference.ts#makeId` produit à
  // partir du `pdfFieldName` officiel — ainsi `applyC1Improvements()`
  // remplace l'entrée inférée par cette version enrichie (et n'en duplique
  // pas une seconde).
  // ====================================================================
  {
    id: "nom",
    pdfFieldName: "Nom",
    type: "text",
    required: true,
    label: { fr: "Nom", nl: "", de: "" },
    prefillFrom: "profile.lastName",
    section: SECTION_IDENTITE,
    order: -100,
  },
  {
    id: "pr_nom",
    pdfFieldName: "Prénom",
    type: "text",
    required: true,
    label: { fr: "Prénom", nl: "", de: "" },
    prefillFrom: "profile.firstName",
    section: SECTION_IDENTITE,
    order: -99,
  },
  {
    id: "niss",
    pdfFieldName: "NISS",
    type: "niss",
    required: true,
    label: { fr: "Numéro NISS (registre national)", nl: "", de: "" },
    help: {
      fr: "11 chiffres au dos de ta carte d'identité (eID), au-dessus du code-barres.",
      nl: "", de: "",
    },
    placeholder: { fr: "00.00.00-000.00", nl: "", de: "" },
    prefillFrom: "profile.niss",
    section: SECTION_IDENTITE,
    order: -98,
  },
  {
    id: "date_de_naissance",
    pdfFieldName: "Date de naissance",
    type: "date",
    required: true,
    label: { fr: "Date de naissance", nl: "", de: "" },
    prefillFrom: "itsme.birthDate",
    section: SECTION_IDENTITE,
    order: -97,
  },
  {
    id: "nationalit_3",
    pdfFieldName: "nationalité 3",
    type: "text",
    required: true,
    label: { fr: "Nationalité", nl: "", de: "" },
    help: {
      fr: "Indique ta nationalité (ex. « Belge »). Si tu es hors EEE/Suisse, complète aussi la rubrique dédiée plus bas.",
      nl: "", de: "",
    },
    section: SECTION_IDENTITE,
    order: -96,
  },
  {
    id: "adresse_rue",
    pdfFieldName: "Adresse - Rue",
    type: "text",
    required: true,
    label: { fr: "Rue", nl: "", de: "" },
    prefillFrom: "profile.street",
    section: SECTION_IDENTITE,
    order: -90,
  },
  {
    id: "num_ro",
    pdfFieldName: "numéro",
    type: "text",
    required: true,
    label: { fr: "Numéro", nl: "", de: "" },
    section: SECTION_IDENTITE,
    order: -89,
  },
  {
    id: "num_ro_de_bo_te",
    pdfFieldName: "numéro de boîte",
    type: "text",
    required: false,
    label: { fr: "Boîte", nl: "", de: "" },
    help: { fr: "Numéro de boîte si applicable (laisser vide sinon).", nl: "", de: "" },
    section: SECTION_IDENTITE,
    order: -88,
  },
  {
    id: "code_postal",
    pdfFieldName: "code postal",
    type: "postal_be",
    required: true,
    label: { fr: "Code postal", nl: "", de: "" },
    placeholder: { fr: "1000", nl: "", de: "" },
    prefillFrom: "profile.postalCode",
    section: SECTION_IDENTITE,
    order: -87,
  },
  {
    id: "pays",
    pdfFieldName: "pays",
    type: "text",
    required: true,
    label: { fr: "Pays", nl: "", de: "" },
    defaultValue: "Belgique",
    section: SECTION_IDENTITE,
    order: -86,
  },
  // Remarque : la ville n'a pas de widget dédié sur le C1 (le code postal
  // suffit côté ONEM). On la prefill quand même via profile.city si l'admin
  // ajoute un champ « ville » manuellement plus tard.
  {
    id: "adresse_email_facultatif",
    pdfFieldName: "adresse email  facultatif",
    type: "email",
    required: false,
    label: { fr: "Adresse e-mail (facultatif)", nl: "", de: "" },
    placeholder: { fr: "nom@exemple.be", nl: "", de: "" },
    prefillFrom: "profile.email",
    section: SECTION_IDENTITE,
    order: -85,
  },
  {
    id: "num_ro_de_t_l_phone_facultatif",
    pdfFieldName: "numéro de téléphone facultatif",
    type: "phone_be",
    required: false,
    label: { fr: "Numéro de téléphone (facultatif)", nl: "", de: "" },
    placeholder: { fr: "0470 12 34 56", nl: "", de: "" },
    prefillFrom: "profile.phone",
    section: SECTION_IDENTITE,
    order: -84,
  },

  // ====================================================================
  // SECTION 1 — DEMANDE (motifs d'introduction)
  // ====================================================================
  {
    id: "dateDemande",
    pdfFieldName: "Date9_af_date",
    type: "date",
    required: true,
    label: { fr: "Je demande des allocations à partir du", nl: "", de: "" },
    help: { fr: "Date du premier jour pour lequel tu demandes des allocations.", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_DEMANDE,
    order: 1,
  },
  {
    id: "chomeurTemporaireAlternance",
    pdfFieldName: "oui|non",
    type: "radio",
    required: true,
    label: {
      fr: "… comme chômeur temporaire suivant une formation en alternance",
      nl: "", de: "",
    },
    help: {
      fr: "Cas rare — coche « non » sauf si tu suis une formation en alternance et que tu es en chômage temporaire pendant cette formation.",
      nl: "", de: "",
    },
    options: YN,
    defaultValue: "non",
    section: SECTION_DEMANDE,
    order: 2,
  },
  {
    id: "motifIntroduction",
    pdfFieldName:
      "pour la première fois 5|après une interruption de mes allocations 5|je déclare une modification concernant|je change dorganisme de paiement à partir du 5",
    type: "radio",
    required: true,
    label: { fr: "Motif d'introduction de cette demande", nl: "", de: "" },
    help: {
      fr: "« Première fois » = premier dossier de ce type, nouvelle admissibilité (souvent quand il n'y a pas eu d'allocation depuis plus d'un an), ou tout premier dossier. « Interruption » = reprise après une période de non-versement.",
      nl: "", de: "",
    },
    options: [
      { value: "premiere", label: { fr: "Pour la première fois", nl: "", de: "" } },
      { value: "interruption", label: { fr: "Après une interruption de mes allocations", nl: "", de: "" } },
      { value: "modification", label: { fr: "Je déclare une modification", nl: "", de: "" } },
      { value: "changement-op", label: { fr: "Je change d'organisme de paiement", nl: "", de: "" } },
    ],
    section: SECTION_DEMANDE,
    order: 3,
    renderAs: "chip",
  },
  {
    id: "dateChangementOrganisme",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    help: {
      fr: "Le transfert prend effet le mois suivant, sous certaines conditions de délai qui dépendent de ton type d'allocation actuel. Ton nouvel organisme de paiement te confirmera la date exacte.",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "changement-op" },
    section: SECTION_DEMANDE,
    order: 4,
  },
  // Si « modification », l'utilisateur peut cocher plusieurs natures.
  {
    id: "modificationAdresse",
    pdfFieldName: "mon adresse à partir du",
    type: "checkbox",
    required: false,
    label: { fr: "Modification d'adresse", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 5,
    renderAs: "chip",
  },
  {
    id: "modificationCompte",
    pdfFieldName: "le mode de paiement de mes allocations ou mon numéro de compte6",
    type: "checkbox",
    required: false,
    label: { fr: "Modification du compte bancaire", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 6,
    renderAs: "chip",
  },
  {
    id: "modificationSituationFamiliale",
    pdfFieldName: "ma situation personnelle ou celle des membres de mon ménage 7",
    type: "checkbox",
    required: false,
    label: { fr: "Modification de situation familiale", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 7,
    renderAs: "chip",
  },
  {
    id: "modificationPermisSejour",
    pdfFieldName: "mon permis de séjour ou mon permis de travail",
    type: "checkbox",
    required: false,
    label: { fr: "Modification du permis de séjour", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 8,
    renderAs: "chip",
  },
  {
    id: "modificationCotisationSyndicale",
    pdfFieldName: "la retenue des cotisations syndicales",
    type: "checkbox",
    required: false,
    label: { fr: "Modification de la cotisation syndicale", nl: "", de: "" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 9,
    renderAs: "chip",
  },
  {
    id: "dateModificationEffective",
    pdfFieldName: "", // À stamper sur les 3 cases date réelles (adresse / situation familiale / compte) — noms AcroForm à identifier via scripts/dump-c1.ts (suivi séparé, cf. NEXT_ACTIONS).
    type: "date",
    required: false,
    label: { fr: "Date d'effet de la ou des modification(s) cochée(s) ci-dessus", nl: "", de: "" },
    help: {
      fr: "Une seule date pour l'adresse, la situation personnelle/du ménage et le compte bancaire. Si tes changements n'ont pas tous la même date d'effet, fais une déclaration séparée pour chaque date différente. Ne concerne pas la cotisation syndicale ni le permis de séjour (pas de date sur le formulaire officiel).",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 9.5,
  },

  // ====================================================================
  // SECTION 2 — SITUATION FAMILIALE (simplifié pour cette 1ʳᵉ passe)
  // La grille cohabitants structurée + upload de jugement (pension
  // alimentaire) sont reportés à un commit dédié (nouveau type `array`
  // nécessaire). Ici on capture l'essentiel : isolé vs cohabite, et la
  // déclaration de pension alimentaire avec rappel des pièces requises.
  // ====================================================================
  {
    id: "statutFamilial",
    pdfFieldName: "jhabite seul 9|je cohabite avec 11",
    type: "radio",
    required: true,
    label: { fr: "Ma situation familiale", nl: "", de: "" },
    help: { fr: "Choix unique : tu vis seul ou tu cohabites avec au moins une personne.", nl: "", de: "" },
    options: [
      { value: "isole", label: { fr: "Je vis seul (isolé)", nl: "", de: "" } },
      { value: "cohabite", label: { fr: "Je cohabite avec au moins une personne", nl: "", de: "" } },
    ],
    section: SECTION_SITUATION_FAMILIALE,
    order: 100,
  },
  {
    id: "pensionAlimentaire",
    pdfFieldName:
      "je paie une pension alimentaire en exécution dune décision judiciaire ou dun acte notarié 10|",
    type: "radio",
    required: false,
    label: { fr: "Je paie une pension alimentaire (jugement, acte notarié, garde alternée)", nl: "", de: "" },
    help: {
      fr: "⚠ Si oui, joindre obligatoirement une copie du JUGEMENT ou de l'ACTE NOTARIÉ. Les preuves de paiement (virements, reçus) ne suffisent pas. Vaut aussi pour la garde alternée.",
      nl: "", de: "",
    },
    options: YN,
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "isole" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101,
  },
  {
    id: "pensionAlimentaireDejaDeclare",
    pdfFieldName: "jai déjà introduit une copie|je joins une copie",
    type: "radio",
    required: false,
    label: { fr: "Le jugement / acte notarié a-t-il déjà été transmis dans un dossier précédent ?", nl: "", de: "" },
    help: {
      fr: "S'il s'agit du premier dossier, réponds « non » — le document doit être joint maintenant.",
      nl: "", de: "",
    },
    options: YN_DECLARE,
    visibleIf: { fieldId: "pensionAlimentaire", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 102,
  },
  {
    id: "remarqueSituationFamiliale",
    pdfFieldName: "Remarques 1",
    type: "textarea",
    required: false,
    label: { fr: "Remarque (situation familiale)", nl: "", de: "" },
    help: { fr: "Précisions utiles : emprisonnement, internement, situation ambiguë, etc.", nl: "", de: "" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 103,
  },
  {
    id: "situationCohabitationAmbigue",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Ta situation de cohabitation est ambiguë (registre national / réalité de ménage divergents) ?", nl: "", de: "" },
    help: {
      fr: "Exemples : domiciliation à une adresse mais résidence à une autre, hébergement temporaire chez un tiers, garde alternée d'enfant non encore enregistrée… → l'Annexe REGIS sera ajoutée à ton parcours pour préciser la composition réelle du ménage.",
      nl: "", de: "",
    },
    options: YN,
    defaultValue: "non",
    section: SECTION_SITUATION_FAMILIALE,
    order: 104,
  },
  dejaDeclare({
    id: "situationCohabitationAmbigueDejaDeclare",
    parentId: "situationCohabitationAmbigue",
    helpText: "Si non, tu devras compléter l'ANNEXE REGIS — elle sera ajoutée à ton parcours.",
    section: SECTION_SITUATION_FAMILIALE,
    order: 105,
  }),
  {
    id: "habiteEnColocation",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Habites-tu en colocation ?", nl: "", de: "" },
    help: {
      fr: "Colocation = tu partages un logement avec une ou plusieurs personnes SANS lien de parenté ni de couple (chacun sa vie, pas de ménage commun) — même si le registre national vous montre à la même adresse. Cette précision permet d'ajouter automatiquement l'ANNEXE REGIS à ton parcours.",
      nl: "", de: "",
    },
    options: YN,
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "cohabite" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 106,
  },
  // Grille cohabitants — visible seulement si l'utilisateur a indiqué
  // cohabiter. Pour chaque ligne : identité, lien familial, date naissance,
  // allocations familiales perçues (auto-non si > 35 ans), type & montant
  // de revenu professionnel (Indépendant → 999999.99 par défaut), revenus
  // de remplacement, remarque, et statut C1-PARTENAIRE si FAC.
  //
  // ----- Mapping PDF : stamping positionnel via `pdfFieldNameTemplate` -----
  // Le PDF C1 expose une grille à 5 lignes FIXES (page 1, y≈140-300). Chaque
  // ligne occupe DEUX rangées sur le PDF (un cohabitant = 2 lignes texte) et
  // a deux colonnes (x≈47 et x≈161). Les widgets sont nommés irrégulièrement :
  //   - col gauche, rangée 1 (x≈47) : "1 1", "2 1", "3 1", "4 1", "5 1" — RÉG.
  //   - col gauche, rangée 2 (x≈45) : "1 2", "2 2", "3 2", "4 2", "5 2" — RÉG.
  //   - col droite, rangée 1 (x≈161) : "1", "1_2", "1_3", "1_4", "1_5" — irrég.
  //   - col droite, rangée 2 (x≈161) : "2", "2_2", "2_3", "2_4", "2_5" — irrég.
  // Seules les deux colonnes régulières sont mappables via un template
  // unique `{index}` — on y déverse prenom et dateNaissance par ligne. Les
  // autres sous-champs (nom, lien, allocations, revenus, remarque,
  // c1PartenaireStatus) restent VIRTUELS au niveau ligne — ils servent la
  // logique applicative (triggers, règles métier) sans cible PDF par ligne.
  //
  // ----- Stamping « partenaire » via `firstMatchMapping` (lien==="FAC") -----
  // Les widgets « Allocation familiale », « Activité professionnelle »,
  // « Montant », « Revenus de remplacement », « Identité du partenaire… » et
  // les 2 cases C1-PARTENAIRE n'existent qu'UNE seule fois — ils décrivent
  // LA personne financièrement à charge (FAC). On y déverse les sous-champs
  // de la PREMIÈRE ligne dont `lien === "FAC"`. L'identité affichée est le
  // prénom seul (le widget est unique → pas de place pour Prénom + Nom
  // séparément ; conserver le nom complet exigerait un champ composite).
  {
    id: "cohabitants",
    pdfFieldName: "",
    type: "array",
    required: false,
    label: { fr: "Personnes avec qui je cohabite", nl: "", de: "" },
    help: {
      fr: "Ajoute toutes les personnes qui font partie de ton ménage, même si elles sont domiciliées ailleurs. Une personne emprisonnée ou en institution psychiatrique compte toujours.",
      nl: "", de: "",
    },
    addRowLabel: { fr: "Ajouter un cohabitant", nl: "", de: "" },
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "cohabite" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 110,
    // La grille PDF a 5 slots positionnels — au-delà, on tronque silencieusement
    // au stamping (la logique applicative voit toujours toutes les lignes).
    maxRows: 5,
    firstMatchMapping: {
      where: { fieldId: "lien", value: "FAC" },
      fields: {
        prenom: "Identité du partenaire ou de la personne à charge",
        allocationsFamiliales: "Allocation familiale",
        typeRevenuPro: "Activité professionnelle",
        montantRevenuPro: "Montant",
        revenuRemplacement: "Revenus de remplacement",
        // Pour le statut C1-PARTENAIRE : convention pipe-séparateur sur un
        // sous-champ `radio` à 2 options — la 1ʳᵉ option ("premiere-fois")
        // coche la case « Je le déclare pour la première fois… », la 2ᵉ
        // ("deja-declare") coche la case « Ma déclaration précédente reste
        // inchangée ». Cf. filler.ts#stampPipeRadio pour la convention.
        c1PartenaireStatus:
          "Je le déclare pour la première fois ou je déclare une modification et je joins un FORMULAIRE C1PARTENAIRE|Ma déclaration précédente sur le FORMULAIRE C1PARTENAIRE reste inchangée",
      },
    },
    itemFields: [
      {
        id: "prenom",
        pdfFieldName: "",
        type: "text",
        required: true,
        label: { fr: "Prénom", nl: "", de: "" },
        // Stampé en colonne 1 rangée 1 du slot N (widgets "1 1", "2 1", …).
        pdfFieldNameTemplate: "{index} 1",
        order: 1,
      },
      {
        id: "nom",
        pdfFieldName: "",
        type: "text",
        required: true,
        label: { fr: "Nom", nl: "", de: "" },
        // La colonne 2 du PDF (widgets "1", "1_2", …) a un naming irrégulier
        // qui ne se laisse pas capter par un template unique — sous-champ
        // gardé virtuel pour cette passe.
        order: 2,
      },
      {
        id: "lien",
        pdfFieldName: "",
        type: "select",
        required: true,
        label: { fr: "Lien familial", nl: "", de: "" },
        help: { fr: "FAC = financièrement à charge. NFAC = non financièrement à charge.", nl: "", de: "" },
        options: [
          { value: "epoux", label: { fr: "Époux/se", nl: "", de: "" } },
          { value: "partenaire", label: { fr: "Partenaire", nl: "", de: "" } },
          { value: "FAC", label: { fr: "Financièrement à charge (FAC)", nl: "", de: "" } },
          { value: "NFAC", label: { fr: "Non financièrement à charge (NFAC)", nl: "", de: "" } },
          { value: "enfant", label: { fr: "Enfant", nl: "", de: "" } },
          { value: "pere", label: { fr: "Père", nl: "", de: "" } },
          { value: "mere", label: { fr: "Mère", nl: "", de: "" } },
          { value: "frere", label: { fr: "Frère", nl: "", de: "" } },
          { value: "soeur", label: { fr: "Sœur", nl: "", de: "" } },
          { value: "neveu", label: { fr: "Neveu", nl: "", de: "" } },
          { value: "niece", label: { fr: "Nièce", nl: "", de: "" } },
          { value: "oncle", label: { fr: "Oncle", nl: "", de: "" } },
          { value: "tante", label: { fr: "Tante", nl: "", de: "" } },
          { value: "cousin", label: { fr: "Cousin", nl: "", de: "" } },
          { value: "cousine", label: { fr: "Cousine", nl: "", de: "" } },
          { value: "aucun-lien", label: { fr: "Aucun lien de parenté", nl: "", de: "" } },
        ],
        order: 3,
      },
      {
        id: "dateNaissance",
        pdfFieldName: "",
        type: "date",
        required: true,
        label: { fr: "Date de naissance", nl: "", de: "" },
        // Stampé en colonne 1 rangée 2 du slot N (widgets "1 2", "2 2", …).
        pdfFieldNameTemplate: "{index} 2",
        order: 4,
      },
      {
        id: "allocationsFamiliales",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Je perçois des allocations familiales pour cette personne", nl: "", de: "" },
        help: {
          fr: "Au-delà de 35 ans, la réponse est automatiquement « non ». Tu peux la rectifier si besoin.",
          nl: "", de: "",
        },
        options: YN,
        order: 5,
      },
      {
        id: "typeRevenuPro",
        pdfFieldName: "",
        type: "select",
        required: false,
        label: { fr: "Type de revenu professionnel", nl: "", de: "" },
        options: [
          { value: "aucun", label: { fr: "Aucun", nl: "", de: "" } },
          { value: "salarie-employe", label: { fr: "Employé", nl: "", de: "" } },
          { value: "salarie-ouvrier", label: { fr: "Ouvrier", nl: "", de: "" } },
          { value: "independant", label: { fr: "Indépendant", nl: "", de: "" } },
        ],
        order: 6,
      },
      {
        id: "montantRevenuPro",
        pdfFieldName: "",
        type: "number",
        required: false,
        label: { fr: "Montant brut mensuel (€)", nl: "", de: "" },
        help: {
          fr: "Pour un indépendant, valeur par défaut 999999,99 € — le statut indépendant rend la personne « cohabitante » sans plafond de revenu pour conjoint/partenaire.",
          nl: "", de: "",
        },
        visibleIf: { fieldId: "typeRevenuPro", op: "notEquals", value: "aucun" },
        order: 7,
      },
      {
        id: "revenuRemplacement",
        pdfFieldName: "",
        type: "select",
        required: false,
        label: { fr: "Revenu de remplacement", nl: "", de: "" },
        help: { fr: "Mutuelle (maladie-invalidité), CPAS, pension, allocations chômage, etc.", nl: "", de: "" },
        options: [
          { value: "aucun", label: { fr: "Aucun", nl: "", de: "" } },
          { value: "mutuelle", label: { fr: "Mutuelle (maladie-invalidité)", nl: "", de: "" } },
          { value: "cpas", label: { fr: "CPAS (revenu d'intégration)", nl: "", de: "" } },
          { value: "pension", label: { fr: "Pension", nl: "", de: "" } },
          { value: "chomage", label: { fr: "Allocations de chômage", nl: "", de: "" } },
          { value: "autre", label: { fr: "Autre", nl: "", de: "" } },
        ],
        order: 8,
      },
      {
        id: "montantRevenuRemplacement",
        pdfFieldName: "",
        type: "number",
        required: false,
        label: { fr: "Montant brut mensuel du revenu de remplacement (€)", nl: "", de: "" },
        visibleIf: { fieldId: "revenuRemplacement", op: "notEquals", value: "aucun" },
        order: 9,
      },
      {
        id: "remarque",
        pdfFieldName: "",
        type: "textarea",
        required: false,
        label: { fr: "Remarque", nl: "", de: "" },
        order: 10,
      },
      // Statut C1-PARTENAIRE : visible uniquement si lien = FAC. Choix
      // mutuellement exclusif entre « 1ʳᵉ fois / modification » et
      // « déjà déclaré ». La logique de trigger pour ajouter le formulaire
      // C1-PARTENAIRE lit la valeur « premiere-fois » sur n'importe quelle
      // ligne FAC. Stampé sur le PDF via `firstMatchMapping` du parent.
      {
        id: "c1PartenaireStatus",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Déclaration C1-PARTENAIRE", nl: "", de: "" },
        help: {
          fr: "Auto-pré-sélectionné sur « 1ʳᵉ fois / modification » dès que le lien devient FAC — tu peux changer si la situation a déjà été déclarée.",
          nl: "", de: "",
        },
        options: [
          {
            value: "premiere-fois",
            label: { fr: "Première fois (ou modification) — joindre un FORMULAIRE C1-PARTENAIRE", nl: "", de: "" },
          },
          {
            value: "deja-declare",
            label: { fr: "Ma déclaration C1-PARTENAIRE précédente reste inchangée", nl: "", de: "" },
          },
        ],
        visibleIf: { fieldId: "lien", op: "equals", value: "FAC" },
        order: 11,
      },
    ],
  },

  // ---------- MES ACTIVITÉS (10 questions, page 2) ----------
  {
    id: "etudesPleinExercice",
    pdfFieldName: "oui_2|non_2",
    type: "radio",
    required: true,
    label: { fr: "Je suis des études de plein exercice (cours du jour)", nl: "", de: "" },
    help: {
      fr: "⚠ Si oui, perte du droit aux allocations sauf dispense FOREM / ACTIRIS / VDAB / ARBEITSAMT DG.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 200,
    stepPriority: "optional",
  },
  {
    id: "etudesPleinExerciceDate",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    visibleIf: { fieldId: "etudesPleinExercice", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 201,
    stepPriority: "optional",
  },
  {
    id: "apprentissageAlternance",
    pdfFieldName: "oui_3|non_3",
    type: "radio",
    required: true,
    label: { fr: "Je suis un apprentissage ou une formation en alternance", nl: "", de: "" },
    help: {
      fr: "⚠ Idem études — perte du droit sauf dispense. Si chômage temporaire pendant la formation, complète aussi la section « Situation familiale ».",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 210,
    stepPriority: "optional",
  },
  {
    id: "apprentissageAlternanceDate",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    visibleIf: { fieldId: "apprentissageAlternance", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 211,
    stepPriority: "optional",
  },
  {
    id: "formationStageSyntra",
    pdfFieldName: "oui_4|non_4",
    type: "radio",
    required: true,
    label: { fr: "Je suis une formation avec convention de stage (SYNTRA / IFAPME / EFEPME / IAWM)", nl: "", de: "" },
    help: { fr: "⚠ Idem études — perte du droit sauf dispense.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 220,
    stepPriority: "optional",
  },
  {
    id: "formationStageSyntraDate",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    visibleIf: { fieldId: "formationStageSyntra", op: "equals", value: "oui" },
    section: SECTION_ACTIVITES,
    order: 221,
    stepPriority: "optional",
  },
  {
    id: "mandatArtistique",
    pdfFieldName: "oui_5|non_5",
    type: "radio",
    required: true,
    label: {
      fr: "J'exerce un mandat rémunéré dans un organe consultatif du secteur culturel ou de la Commission du travail des arts",
      nl: "", de: "",
    },
    help: { fr: "→ Joindre un FORMULAIRE C46 si pas encore déclaré.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 230,
    stepPriority: "optional",
  },
  {
    ...dejaDeclare({
      id: "mandatArtistiqueDejaDeclare",
      parentId: "mandatArtistique",
      helpText: "Si non, tu devras compléter le FORMULAIRE C46 — il sera ajouté à ton parcours.",
      section: SECTION_ACTIVITES,
      order: 231,
      pdfFieldName:
        "ma déclaration précédente sur le FORMULAIRE C46 reste inchangée|je le déclare pour la première fois ou je déclare une modification et je joins",
    }),
    stepPriority: "optional",
  },
  {
    id: "mandatPolitique",
    pdfFieldName: "oui_6|non_6",
    type: "radio",
    required: true,
    label: { fr: "J'exerce un mandat politique", nl: "", de: "" },
    help: {
      fr: "→ Joindre un FORMULAIRE C1A. Exception : si tu es conseiller communal ou membre du Conseil de l'action sociale, réponds « non » (pas de C1A à joindre).",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 240,
    stepPriority: "optional",
  },
  {
    id: "chapitreXIIArts",
    pdfFieldName: "oui_7|non_7",
    type: "radio",
    required: true,
    label: {
      fr: "Je bénéficie (ou souhaite bénéficier) du Chapitre XII sur la base de l'attestation du travail des arts",
      nl: "", de: "",
    },
    help: { fr: "Demande des explications à ton organisme de paiement.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 250,
    stepPriority: "optional",
  },
  {
    id: "tremplinIndependants",
    pdfFieldName: "oui_8|non_8",
    type: "radio",
    required: true,
    label: {
      fr: "J'exerce une activité accessoire comme indépendant et je bénéficie (ou souhaite bénéficier) de la mesure « Tremplin-indépendants »",
      nl: "", de: "",
    },
    help: { fr: "→ Joindre un FORMULAIRE C1C si pas encore déclaré.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 270,
    stepPriority: "optional",
  },
  {
    ...dejaDeclare({
      id: "tremplinIndependantsDejaDeclare",
      parentId: "tremplinIndependants",
      helpText:
        "Si non, tu devras compléter le FORMULAIRE C1C — il sera ajouté à ton parcours.",
      section: SECTION_ACTIVITES,
      order: 271,
      pdfFieldName:
        "ma déclaration précédente sur le FORMULAIRE C1C reste inchangée|je sollicite pour la première fois le bénéfice de lavantage  Tremplin",
    }),
    stepPriority: "optional",
  },
  {
    id: "activiteAccessoireOuAide",
    pdfFieldName: "oui_9|non_9",
    type: "radio",
    required: true,
    label: { fr: "J'exerce une activité accessoire ou j'aide un travailleur indépendant", nl: "", de: "" },
    help: { fr: "→ Joindre un FORMULAIRE C1A si pas encore déclaré.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 280,
    stepPriority: "optional",
  },
  {
    ...dejaDeclare({
      id: "activiteAccessoireDejaDeclare",
      parentId: "activiteAccessoireOuAide",
      helpText: "Si non, tu devras compléter le FORMULAIRE C1A — il sera ajouté à ton parcours.",
      section: SECTION_ACTIVITES,
      order: 281,
      pdfFieldName:
        "ma déclaration précédente sur le FORMULAIRE C1A reste inchangée_2|je le déclare pour la première fois ou je déclare une modification et je joins_3",
    }),
    stepPriority: "optional",
  },
  {
    id: "administrateurSociete",
    pdfFieldName: "oui_10|non_10",
    type: "radio",
    required: true,
    label: { fr: "Je suis administrateur de société", nl: "", de: "" },
    help: { fr: "→ Joindre un FORMULAIRE C1A si pas encore déclaré.", nl: "", de: "" },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 290,
    stepPriority: "optional",
  },
  {
    ...dejaDeclare({
      id: "administrateurSocieteDejaDeclare",
      parentId: "administrateurSociete",
      helpText: "Si non, tu devras compléter le FORMULAIRE C1A — il sera ajouté à ton parcours.",
      section: SECTION_ACTIVITES,
      order: 291,
      // Le PDF officiel mutualise une seule paire C1A pour les questions 9-11
      // (accessoire / administrateur / indép. accessoire-principal). On pointe
      // donc sur la même paire que les autres follow-ups C1A — le dernier
      // remplissage gagne.
      pdfFieldName:
        "ma déclaration précédente sur le FORMULAIRE C1A reste inchangée_2|je le déclare pour la première fois ou je déclare une modification et je joins_3",
    }),
    stepPriority: "optional",
  },
  {
    id: "independantAccessoireOuPrincipal",
    pdfFieldName: "oui_11|non_11",
    type: "radio",
    required: true,
    label: { fr: "Je suis inscrit comme indépendant à titre accessoire ou principal", nl: "", de: "" },
    help: {
      fr: "⚠ Si à titre principal, pas de droit aux allocations de chômage. Si accessoire, joindre un FORMULAIRE C1A si pas encore déclaré.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_ACTIVITES,
    order: 500,
    stepPriority: "optional",
  },
  {
    ...dejaDeclare({
      id: "independantAccessoireDejaDeclare",
      parentId: "independantAccessoireOuPrincipal",
      helpText:
        "Pour une activité accessoire : si non déclarée, tu devras compléter le FORMULAIRE C1A.",
      section: SECTION_ACTIVITES,
      order: 501,
      pdfFieldName:
        "ma déclaration précédente sur le FORMULAIRE C1A reste inchangée_2|je le déclare pour la première fois ou je déclare une modification et je joins_3",
    }),
    stepPriority: "optional",
  },

  // ---------- MES REVENUS (5 questions, page 2) ----------
  {
    id: "pensionCategorieParticuliere",
    pdfFieldName: "oui_12|non_12",
    type: "radio",
    required: true,
    label: {
      fr: "J'appartiens à une catégorie professionnelle particulière (mineur, pilote, marin…) et j'ai droit à une pension complète",
      nl: "", de: "",
    },
    help: {
      fr: "⚠ Si tu remplis les conditions d'âge et d'ancienneté pour la pension spécifique, pas de droit aux allocations.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_REVENUS,
    order: 510,
    stepPriority: "optional",
  },
  {
    id: "pensionRetraiteSurvie",
    pdfFieldName: "oui_13|non_13",
    type: "radio",
    required: true,
    label: { fr: "Je perçois une pension de retraite ou de survie", nl: "", de: "" },
    help: {
      fr: "→ Joindre un FORMULAIRE C1B si pas encore déclaré. Exception : une « allocation de transition » (limitée dans le temps) se déclare « non » — cumulable sans limite.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_REVENUS,
    order: 520,
    stepPriority: "optional",
  },
  {
    ...dejaDeclare({
      id: "pensionRetraiteDejaDeclare",
      parentId: "pensionRetraiteSurvie",
      helpText: "Si non, tu devras compléter le FORMULAIRE C1B — il sera ajouté à ton parcours.",
      section: SECTION_REVENUS,
      order: 521,
      pdfFieldName:
        "ma déclaration précédente sur le FORMULAIRE C1B reste inchangée|je le déclare pour la première fois ou je déclare une modification et je",
    }),
    stepPriority: "optional",
  },
  {
    id: "indemniteMaladieInvalidite",
    pdfFieldName: "oui_14|non_14",
    type: "radio",
    required: true,
    label: { fr: "Je perçois une indemnité de maladie ou d'invalidité", nl: "", de: "" },
    help: { fr: "À déclarer. Demande des explications à ton organisme de paiement.", nl: "", de: "" },
    options: YN,
    section: SECTION_REVENUS,
    order: 530,
    stepPriority: "optional",
  },
  {
    id: "indemniteAccidentTravail",
    pdfFieldName: "oui_15|non_15",
    type: "radio",
    required: true,
    label: { fr: "Je perçois une indemnité pour accident du travail ou maladie professionnelle", nl: "", de: "" },
    help: { fr: "À déclarer.", nl: "", de: "" },
    options: YN,
    section: SECTION_REVENUS,
    order: 540,
    stepPriority: "optional",
  },
  {
    id: "avantageFinancierFormation",
    pdfFieldName: "oui_16|non_16",
    type: "radio",
    required: true,
    label: {
      fr: "Je perçois un avantage financier dans le cadre ou à la suite d'une formation, d'études, d'un apprentissage, d'un stage ou d'une activité dans une coopérative d'activités",
      nl: "", de: "",
    },
    help: {
      fr: "⚠ Entraîne la perte du droit aux allocations sauf dispense ou autorisation du service régional de l'emploi.",
      nl: "", de: "",
    },
    options: YN,
    section: SECTION_REVENUS,
    order: 550,
    stepPriority: "optional",
  },

  // ====================================================================
  // SECTION — MODE DE PAIEMENT
  // ====================================================================
  {
    id: "modePaiement",
    pdfFieldName: "dun virement bancaire Ce compte est à mon nom|dun chèque circulaire envoyé à ladresse mentionnée à la rubrique  MON IDENTITÉ  voir p 1",
    type: "radio",
    required: true,
    label: { fr: "Comment souhaites-tu recevoir tes allocations ?", nl: "", de: "" },
    help: { fr: "Le virement bancaire est le mode standard. Le chèque circulaire est exceptionnel.", nl: "", de: "" },
    options: [
      { value: "virement", label: { fr: "Par virement bancaire", nl: "", de: "" } },
      { value: "cheque", label: { fr: "Par chèque circulaire envoyé à mon adresse", nl: "", de: "" } },
    ],
    defaultValue: "virement",
    section: SECTION_PAIEMENT,
    order: 600,
  },
  {
    id: "modePaiementChequeWarning",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: {
      fr: "Je confirme avoir compris : le chèque circulaire est rare, plus lent et envoyé à l'adresse de la rubrique « MON IDENTITÉ ».",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "cheque" },
    section: SECTION_PAIEMENT,
    order: 601,
  },
  {
    id: "titulaireCompte",
    pdfFieldName: "oui_17|non au nom de",
    type: "radio",
    required: false,
    label: { fr: "Le compte est…", nl: "", de: "" },
    options: [
      { value: "mon-nom", label: { fr: "À mon nom", nl: "", de: "" } },
      { value: "autre-nom", label: { fr: "Au nom d'une autre personne", nl: "", de: "" } },
    ],
    defaultValue: "mon-nom",
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "virement" },
    section: SECTION_PAIEMENT,
    order: 602,
  },
  {
    id: "iban",
    pdfFieldName: "IBAN",
    type: "iban",
    required: false,
    label: { fr: "IBAN (compte belge SEPA)", nl: "", de: "" },
    placeholder: { fr: "BE00 0000 0000 0000", nl: "", de: "" },
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "virement" },
    section: SECTION_PAIEMENT,
    order: 603,
  },
  {
    id: "titulaireCompteNom",
    pdfFieldName: "Nom du titulaire",
    type: "text",
    required: false,
    label: { fr: "Nom du titulaire du compte", nl: "", de: "" },
    placeholder: { fr: "Nom et prénom de la personne", nl: "", de: "" },
    visibleIf: { fieldId: "titulaireCompte", op: "equals", value: "autre-nom" },
    section: SECTION_PAIEMENT,
    order: 604,
  },
  // Compte SEPA étranger : alternative au compte belge (BE…). Si renseigné,
  // l'utilisateur doit aussi fournir le BIC de sa banque (obligatoire hors
  // BE). On garde les deux champs facultatifs côté schéma — la cohérence
  // « IBAN belge OU IBAN étranger + BIC » sera vérifiée par la logique
  // applicative en aval.
  {
    id: "sepa_tranger_iban_bic",
    pdfFieldName: "SEPA étranger IBAN  BIC",
    type: "iban",
    required: false,
    label: { fr: "IBAN étranger (SEPA hors Belgique)", nl: "", de: "" },
    help: {
      fr: "À remplir uniquement si ton compte n'est pas un compte belge (BE…). Indique aussi le BIC ci-dessous.",
      nl: "", de: "",
    },
    placeholder: { fr: "FR76 0000 0000 0000 0000 0000 000", nl: "", de: "" },
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "virement" },
    section: SECTION_PAIEMENT,
    order: 605,
  },
  {
    id: "bic",
    pdfFieldName: "BIC",
    type: "text",
    required: false,
    label: { fr: "BIC (code SWIFT de la banque)", nl: "", de: "" },
    help: {
      fr: "Obligatoire si tu utilises un IBAN étranger. Le BIC se trouve sur tes extraits de compte (8 ou 11 caractères, ex. BNPAFRPP).",
      nl: "", de: "",
    },
    placeholder: { fr: "BNPAFRPP", nl: "", de: "" },
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "virement" },
    section: SECTION_PAIEMENT,
    order: 606,
  },

  // ====================================================================
  // SECTION — COTISATION SYNDICALE
  // Les deux cases doivent rester DÉCOCHÉES par défaut et ne pas être
  // cochables côté UX standard — la gestion est externe (organisme de
  // paiement). readOnly empêche la saisie utilisateur.
  // ====================================================================
  {
    id: "autoriseCotisationSyndicale",
    pdfFieldName: "Jautorise la retenue de la cotisation syndicale sur mes allocations à partir du mois de chômage de",
    type: "checkbox",
    required: false,
    label: { fr: "J'autorise la retenue de la cotisation syndicale sur mes allocations", nl: "", de: "" },
    help: {
      fr: "Cette case est gérée directement par ton organisme de paiement — ne la coche pas ici.",
      nl: "", de: "",
    },
    readOnly: true,
    section: SECTION_COTISATION,
    order: 700,
    stepPriority: "optional",
  },
  {
    id: "retireCotisationSyndicale",
    pdfFieldName: "Je nautorise plus la retenue de la cotisation syndicale sur mes allocations à partir du mois de chômage de",
    type: "checkbox",
    required: false,
    label: { fr: "Je n'autorise plus la retenue de la cotisation syndicale", nl: "", de: "" },
    help: { fr: "Gérée par l'organisme de paiement — ne pas cocher ici.", nl: "", de: "" },
    readOnly: true,
    section: SECTION_COTISATION,
    order: 701,
    stepPriority: "optional",
  },

  // ====================================================================
  // SECTION — TRAVAILLEUR NON-EEE / SUISSE
  // À masquer automatiquement si la nationalité saisie est belge ou
  // appartient à l'EEE / Suisse. Pour l'instant : 1 question d'orientation
  // qui rend les sous-questions conditionnelles.
  // ====================================================================
  {
    id: "nationaliteHorsEEE",
    pdfFieldName: "oui_18|non_19",
    type: "radio",
    required: true,
    label: {
      fr: "Es-tu ressortissant d'un pays HORS EEE et HORS Suisse ?",
      nl: "", de: "",
    },
    help: {
      fr: "L'EEE = UE + Islande + Liechtenstein + Norvège. Si tu es belge, français, néerlandais, etc., réponds « non ». Cette section devient inutile pour les chômeurs temporaires.",
      nl: "", de: "",
    },
    options: YN,
    defaultValue: "non",
    section: SECTION_NON_EEE,
    order: 800,
    stepPriority: "optional",
  },
  {
    id: "accesMarcheTravail",
    pdfFieldName: "je dispose dun accès illimité au marché de lemploi|je dispose dun accès limité au marché de lemploi et jajoute une copie de mon document|Je ne dispose pas dun accès au marché de lemploi",
    type: "radio",
    required: false,
    label: { fr: "Mention au verso de mon permis de séjour quant à l'accès au marché du travail", nl: "", de: "" },
    help: {
      fr: "« Illimité » : tu peux travailler pour tout employeur. « Limité » : restrictions précisées sur l'autorisation régionale. « Non » : aucun emploi possible (pas de droit aux allocations).",
      nl: "", de: "",
    },
    options: [
      { value: "illimite", label: { fr: "Illimité", nl: "", de: "" } },
      { value: "limite", label: { fr: "Limité", nl: "", de: "" } },
      { value: "non", label: { fr: "Non", nl: "", de: "" } },
    ],
    visibleIf: { fieldId: "nationaliteHorsEEE", op: "equals", value: "oui" },
    section: SECTION_NON_EEE,
    order: 801,
    stepPriority: "optional",
  },

  // ====================================================================
  // SECTION — DIVERS
  // ====================================================================
  {
    id: "congeSansSolde",
    pdfFieldName: "oui du|non_20",
    type: "radio",
    required: true,
    label: { fr: "Je suis actuellement dans une période de congé sans solde", nl: "", de: "" },
    options: YN,
    defaultValue: "non",
    section: SECTION_DIVERS,
    order: 900,
    stepPriority: "optional",
  },
  {
    id: "congeSansSoldeDate",
    pdfFieldName: "Date11_af_date",
    type: "date",
    required: false,
    label: { fr: "À partir du", nl: "", de: "" },
    visibleIf: { fieldId: "congeSansSolde", op: "equals", value: "oui" },
    section: SECTION_DIVERS,
    order: 901,
    stepPriority: "optional",
  },
  {
    id: "incapacite33",
    pdfFieldName: "oui_19|non_21",
    type: "radio",
    required: true,
    label: {
      fr: "Je présente une incapacité de travail permanente d'au moins 33 %",
      nl: "", de: "",
    },
    help: {
      fr: "→ Si oui, joindre un FORMULAIRE C47-DEMANDE pour fixer le montant des allocations (pas de dégressivité).",
      nl: "", de: "",
    },
    options: YN,
    defaultValue: "non",
    section: SECTION_DIVERS,
    order: 910,
    stepPriority: "optional",
  },
  {
    ...dejaDeclare({
      id: "incapacite33DejaDeclare",
      parentId: "incapacite33",
      helpText: "Si non, tu devras compléter le FORMULAIRE C47 — il sera ajouté à ton parcours.",
      section: SECTION_DIVERS,
      order: 911,
    }),
    stepPriority: "optional",
  },

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
      nl: "", de: "",
    },
    section: SECTION_AFFIRMATIONS,
    order: 1000,
  },
  {
    id: "affirmationLectureNotice",
    pdfFieldName: "Jai lu la feuille dinformations",
    type: "checkbox",
    required: true,
    label: { fr: "J'ai lu la feuille d'informations C1", nl: "", de: "" },
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
      nl: "", de: "",
    },
    section: SECTION_AFFIRMATIONS,
    order: 1002,
  },

  // ====================================================================
  // SECTION — ANNEXES (optionnelles)
  // ====================================================================
  {
    id: "annexeHandicap",
    pdfFieldName: "une attestation de la DG Personnes handicapées du SPF Sécurité sociale",
    type: "checkbox",
    required: false,
    label: { fr: "J'ai joint une attestation de la DG Personnes handicapées du SPF Sécurité sociale", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 1100,
    stepPriority: "optional",
  },
  {
    id: "annexeExtraitPension",
    pdfFieldName: "une copie de l'extrait de la pension",
    type: "checkbox",
    required: false,
    label: { fr: "J'ai joint une copie de l'extrait de la pension", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 1101,
    stepPriority: "optional",
  },
  {
    id: "annexeC1Regis",
    pdfFieldName: "un FORMULAIRE C1 ANNEXE REGIS",
    type: "checkbox",
    required: false,
    label: { fr: "J'ai joint un FORMULAIRE C1 ANNEXE REGIS", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 1102,
    stepPriority: "optional",
  },
  {
    id: "annexePermisSejour",
    pdfFieldName: "une copie du permis de séjour et/ou du permis de travail",
    type: "checkbox",
    required: false,
    label: { fr: "J'ai joint une copie du permis de séjour et/ou du permis de travail", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 1103,
    stepPriority: "optional",
  },
  {
    id: "annexeAutre",
    pdfFieldName: "autre",
    type: "checkbox",
    required: false,
    label: { fr: "J'ai joint un autre document (préciser ci-dessous)", nl: "", de: "" },
    section: SECTION_ANNEXES,
    order: 1104,
    stepPriority: "optional",
  },
  {
    id: "annexeAutreDescription",
    pdfFieldName: "Texte18",
    type: "text",
    required: false,
    label: { fr: "Description du document joint", nl: "", de: "" },
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
    required: true,
    label: { fr: "Date de signature", nl: "", de: "" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour.", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 1200,
  },
  {
    id: "signature",
    // Widget texte « Signature » ajouté au PDF par
    // scripts/add-c1-signature-widget.ts (page 2, rect x=350,y=40,w=200,h=50).
    // Le filler localise le rectangle via `technicalSchema` puis y dessine un
    // bloc « façon Adobe » (nom + mention « Signé par » + horodatage ISO).
    pdfFieldName: "Signature",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique", nl: "", de: "" },
    help: { fr: "Signature « façon Adobe » : ton nom + prénom + horodatage seront appliqués à la position de la signature.", nl: "", de: "" },
    section: SECTION_SIGNATURE,
    order: 1201,
  },
];

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
    reason: { fr: "Personne financièrement à charge à déclarer", nl: "", de: "" },
  },
  {
    // Incapacité de travail permanente d'au moins 33 % → joindre un C47
    // pour fixer le montant des allocations (annule la dégressivité).
    whenFieldId: "incapacite33",
    whenValue: "oui",
    unlessFieldId: "incapacite33DejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c47",
    reason: { fr: "Incapacité 33 % — demande de fixation des allocations", nl: "", de: "" },
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
    reason: { fr: "Situation de cohabitation à préciser via Annexe REGIS", nl: "", de: "" },
  },
  {
    // Nouvelle question concrète (2026-07) : la colocation (aucun lien de
    // parenté, pas de ménage commun) est exactement le cas couvert par le
    // code FN4 de l'Annexe Regis. Pas de suivi "déjà déclaré" pour cette
    // question — non demandé, cf. spec.
    whenFieldId: "habiteEnColocation",
    whenValue: "oui",
    requiresFormSlug: "c1-regis",
    reason: { fr: "Colocation à préciser via l'Annexe Regis (code FN4)", nl: "", de: "" },
  },
  {
    whenFieldId: "mandatArtistique",
    whenValue: "oui",
    unlessFieldId: "mandatArtistiqueDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c46",
    reason: { fr: "Mandat dans un organe consultatif culturel à déclarer", nl: "", de: "" },
  },
  {
    whenFieldId: "tremplinIndependants",
    whenValue: "oui",
    unlessFieldId: "tremplinIndependantsDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1c",
    reason: { fr: "Tremplin-indépendants à déclarer", nl: "", de: "" },
  },
  {
    whenFieldId: "activiteAccessoireOuAide",
    whenValue: "oui",
    unlessFieldId: "activiteAccessoireDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1a",
    reason: { fr: "Activité accessoire ou aide à un indépendant à déclarer", nl: "", de: "" },
  },
  {
    whenFieldId: "administrateurSociete",
    whenValue: "oui",
    unlessFieldId: "administrateurSocieteDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1a",
    reason: { fr: "Mandat d'administrateur de société à déclarer", nl: "", de: "" },
  },
  {
    whenFieldId: "independantAccessoireOuPrincipal",
    whenValue: "oui",
    unlessFieldId: "independantAccessoireDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1a",
    reason: { fr: "Inscription indépendant à déclarer", nl: "", de: "" },
  },
  {
    whenFieldId: "pensionRetraiteSurvie",
    whenValue: "oui",
    unlessFieldId: "pensionRetraiteDejaDeclare",
    unlessValue: "oui",
    requiresFormSlug: "c1b",
    reason: { fr: "Pension de retraite ou de survie à déclarer", nl: "", de: "" },
  },
];

/// Set des `pdfFieldName` (côté positif ET côté négatif) couverts par les
/// nouveaux champs radio. Sert à supprimer les anciens champs checkboxes
/// individuels (oui_2, non_2, …) que le parser AcroForm avait inférés.
function coveredCheckboxNames(): Set<string> {
  const set = new Set<string>();
  for (const q of C1_QUESTIONS) {
    if (!q.pdfFieldName.includes("|")) continue;
    for (const name of q.pdfFieldName.split("|")) set.add(name.trim());
  }
  return set;
}

/// Applique les améliorations du schéma C1 sur la liste de champs existante
/// (typiquement issue de l'inférence automatique au moment de l'import).
///
/// Comportement :
/// 1. Retire tous les champs inférés correspondant aux 15 paires oui_N/non_N
///    (les nouveaux champs `radio` les couvrent).
export interface ApplyC1ImprovementsOptions {
  /// Valeur par défaut à appliquer sur `motifIntroduction` pour CETTE cible
  /// uniquement (ne mute jamais le tableau partagé `C1_QUESTIONS`). Utilisé
  /// par les dossiers dont le motif d'entrée est implicite (ex.
  /// "changement-situation-personnelle" → "modification").
  defaultMotif?: string;
}

/// 2. Append les 15 questions enrichies + 5 follow-ups virtuels.
/// 3. Tous les autres champs (identité, adresse, mode de paiement, situation
///    familiale…) sont préservés tels quels.
///
/// Idempotent : ré-exécutable sans dupliquer (compare les `id`).
///
/// Regroupe aussi les 12 sections en 5 macro-étapes (cf. spec
/// 2026-07-06-form-runner-5-macro-steps) via `stepGroup`, consommé par
/// `buildMacroSteps`. Sections inférées non enrichies (`adresse`, `banque`)
/// → identité ; champs sans section → pas de groupe → accordéon « Autres
/// informations » en fin d'étape 5.
const SECTION_TO_STEP_GROUP: Record<string, string> = {
  [SECTION_DEMANDE]: "motif",
  [SECTION_IDENTITE]: "identite",
  adresse: "identite",
  banque: "identite",
  [SECTION_PAIEMENT]: "identite",
  [SECTION_ACTIVITES]: "activites-revenus",
  [SECTION_REVENUS]: "activites-revenus",
  [SECTION_SITUATION_FAMILIALE]: "famille",
  [SECTION_COTISATION]: "final",
  [SECTION_NON_EEE]: "final",
  [SECTION_DIVERS]: "final",
  [SECTION_AFFIRMATIONS]: "final",
  [SECTION_ANNEXES]: "final",
};

function withStepGroup(f: PdfFormField): PdfFormField {
  const group = f.section ? SECTION_TO_STEP_GROUP[f.section] : undefined;
  return group ? { ...f, stepGroup: group } : f;
}

export function applyC1Improvements(
  fields: PdfFormField[],
  opts?: ApplyC1ImprovementsOptions
): PdfFormField[] {
  const covered = coveredCheckboxNames();
  const newIds = new Set(C1_QUESTIONS.map((q) => q.id));

  const preserved = fields.filter((f) => {
    // Retire les anciens checkboxes individuels désormais couverts par radio.
    if (covered.has(f.pdfFieldName)) return false;
    // Retire aussi un éventuel ancien champ portant un id qu'on redéfinit.
    if (newIds.has(f.id)) return false;
    return true;
  });

  const questions = opts?.defaultMotif
    ? C1_QUESTIONS.map((q) =>
        q.id === "motifIntroduction" ? { ...q, defaultValue: opts.defaultMotif } : q
      )
    : C1_QUESTIONS;

  // Pose `stepGroup` sur tout champ dont la section est mappée (préservés
  // inférés inclus) ; les champs sans section restent sans groupe → catch.
  return [...preserved, ...questions].map(withStepGroup);
}
