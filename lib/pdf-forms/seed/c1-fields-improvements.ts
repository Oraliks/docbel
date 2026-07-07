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
    help: {
      fr: "Déduite automatiquement de ton NISS dès qu'il est complet et valide — sinon, renseigne-la toi-même.",
      nl: "", de: "",
    },
    prefillFrom: "itsme.birthDate",
    // Se recalcule en direct depuis le NISS (checksum T.I. 000, cf.
    // lib/pdf-forms/niss-birthdate.ts) et se verrouille (lecture seule)
    // TANT QUE le NISS produit une date valide ; redevient éditable si le
    // NISS est vide/incomplet (jamais de champ requis inaccessible).
    derivedFrom: { fieldId: "niss", via: "niss-birth-date" },
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
  // Code postal EN PREMIER (Oraliks, 2026-07-06) : une fois connu, il
  // priorise les suggestions de rue correspondantes (sans jamais masquer les
  // autres — cf. lib/pdf-forms/street-suggestions.ts) et affiche un indice
  // de commune (via /api/postal-lookup, données Commune/PostalCode en base).
  {
    id: "code_postal",
    pdfFieldName: "code postal",
    type: "postal_be",
    required: true,
    label: { fr: "Code postal", nl: "", de: "" },
    placeholder: { fr: "1000", nl: "", de: "" },
    prefillFrom: "profile.postalCode",
    section: SECTION_IDENTITE,
    order: -90,
  },
  {
    id: "adresse_rue",
    pdfFieldName: "Adresse - Rue",
    type: "text",
    required: true,
    label: { fr: "Rue", nl: "", de: "" },
    help: {
      fr: "Commence à taper : les rues du code postal indiqué ci-dessus apparaissent en premier.",
      nl: "", de: "",
    },
    prefillFrom: "profile.street",
    streetAutocomplete: { postalFieldId: "code_postal" },
    section: SECTION_IDENTITE,
    order: -89,
  },
  {
    id: "num_ro",
    pdfFieldName: "numéro",
    type: "text",
    required: true,
    label: { fr: "Numéro", nl: "", de: "" },
    section: SECTION_IDENTITE,
    order: -88,
  },
  {
    id: "num_ro_de_bo_te",
    pdfFieldName: "numéro de boîte",
    type: "text",
    required: false,
    label: { fr: "Boîte", nl: "", de: "" },
    help: { fr: "Numéro de boîte si applicable (laisser vide sinon).", nl: "", de: "" },
    section: SECTION_IDENTITE,
    order: -87,
  },
  {
    id: "pays",
    pdfFieldName: "pays",
    type: "text",
    required: true,
    label: { fr: "Pays", nl: "", de: "" },
    help: {
      fr: "Rempli automatiquement à partir du code postal (belge à 4 chiffres → Belgique). Modifiable pour une adresse à l'étranger.",
      nl: "",
      de: "",
    },
    // Dérivé du code postal : belge (4 chiffres) → « Belgique » et verrouillé ;
    // sinon éditable (le citoyen tape le pays lui-même — on n'a pas de base
    // postale UE dans le repo pour l'inférer automatiquement, cf.
    // field-derivations.ts#postal-be-country).
    derivedFrom: { fieldId: "code_postal", via: "postal-be-country" },
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
    // Ne se pose que si l'usager a bien un jugement en main (statutJugement =
    // "en-main"). Pour "en-cours" ou "pas-encore-recu", il n'y a rien à
    // transmettre — l'information est reportée automatiquement en remarque
    // via `applyRemarqueSituationFamiliale`.
    visibleIf: { fieldId: "statutJugementPensionAlimentaire", op: "equals", value: "en-main" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 102,
  },
  {
    // Nouveau (Oraliks 2026-07-07) : distingue « j'ai le jugement » /
    // « jugement en cours » / « pas encore reçu ». Les deux derniers statuts
    // n'exigent pas de document à joindre — ils sont reportés en remarque
    // interne au submit (cf. applyRemarqueSituationFamiliale).
    id: "statutJugementPensionAlimentaire",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "As-tu le jugement en main ?", nl: "", de: "" },
    options: [
      { value: "en-main", label: { fr: "Oui, j'ai le jugement (à joindre)", nl: "", de: "" } },
      { value: "en-cours", label: { fr: "Le jugement est en cours", nl: "", de: "" } },
      { value: "pas-encore-recu", label: { fr: "Je n'ai pas encore reçu mon jugement", nl: "", de: "" } },
    ],
    // Pas de defaultValue (Oraliks 2026-07-07) — sinon pensionAlimentaireDejaDeclare
    // (visible si statutJugement === "en-main") apparaît DÈS que l'utilisateur
    // coche pensionAlimentaire = oui, sans qu'il ait explicitement confirmé
    // avoir le jugement. On force le choix explicite pour n'afficher la
    // question « déjà déclaré ? » qu'après un « oui » assumé.
    visibleIf: { fieldId: "pensionAlimentaire", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.5,
  },
  {
    // `Remarque (situation familiale)` : ne s'affiche PLUS comme textarea à
    // l'écran (Oraliks 2026-07-07). Reste sérialisée et stampe le widget
    // « Remarques 1 » du PDF officiel — sa valeur est calculée au submit par
    // `applyRemarqueSituationFamiliale` à partir de la combinaison de choix
    // (isolé + colocation → « cohousing » ; statut jugement en cours / pas
    // encore reçu → phrase correspondante). `autoAnswered` = jamais rendu
    // comme contrôle interactif, mais reste dans le payload validé + soumis.
    id: "remarqueSituationFamiliale",
    pdfFieldName: "Remarques 1",
    type: "textarea",
    required: false,
    label: { fr: "Remarque (situation familiale)", nl: "", de: "" },
    autoAnswered: true,
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
      fr: "Colocation = tu partages un logement avec une ou plusieurs personnes SANS lien de parenté ni de couple (chacun sa vie, pas de ménage commun) — même si le registre national vous montre à la même adresse. Utile aussi si tu vis officiellement seul mais partages en pratique le logement (cohousing) — la remarque situation familiale sera annotée automatiquement. Cette précision permet d'ajouter automatiquement l'ANNEXE REGIS à ton parcours.",
      nl: "", de: "",
    },
    options: YN,
    // Toujours visible (Oraliks 2026-07-07) — la colocation peut coexister
    // avec un statut « isolé » officiel : c'est justement le cas cohousing,
    // reporté ensuite en remarque via `applyRemarqueSituationFamiliale`.
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
        // En mode colocation (Annexe REGIS), on ne demande que prénom + nom
        // (Oraliks 2026-07-07). Les autres sous-champs se cachent via
        // `visibleIfParent` évalué contre le payload du formulaire.
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
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
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
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
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
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
        defaultValue: "aucun",
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
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
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
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
        defaultValue: "aucun",
        // Ne se pose que si aucun revenu professionnel : les deux axes sont
        // exclusifs à l'écran (Oraliks 2026-07-07 — « pas besoin de montrer
        // les deux pour gagner de la place »). L'axe pro reste prioritaire ;
        // un cohabitant qui a les deux devra être documenté en remarque libre.
        visibleIf: { fieldId: "typeRevenuPro", op: "equals", value: "aucun" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 8,
      },
      {
        id: "montantRevenuRemplacement",
        pdfFieldName: "",
        type: "number",
        required: false,
        label: { fr: "Montant brut mensuel du revenu de remplacement (€)", nl: "", de: "" },
        visibleIf: { fieldId: "revenuRemplacement", op: "notEquals", value: "aucun" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 9,
      },
      {
        id: "remarque",
        pdfFieldName: "",
        type: "textarea",
        required: false,
        label: { fr: "Remarque", nl: "", de: "" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
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
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
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
    // Obligatoire (Oraliks 2026-07-07) : la case correspondante existe sur le
    // PDF officiel ONEM — la laisser vide côté citoyen fait remonter un doute
    // sur la propriété du compte à l'organisme de paiement.
    required: true,
    // Posée aussi pour le chèque circulaire : même si le chèque est envoyé à
    // l'adresse de la rubrique Identité, on veut tracer si le compte bancaire
    // du bénéficiaire est bien à son nom (utile en cas de dépôt ultérieur).
    label: { fr: "Le compte bancaire est à mon nom ?", nl: "", de: "" },
    options: [
      { value: "mon-nom", label: { fr: "Oui, à mon nom", nl: "", de: "" } },
      { value: "autre-nom", label: { fr: "Non, au nom d'une autre personne", nl: "", de: "" } },
    ],
    defaultValue: "mon-nom",
    visibleIf: { fieldId: "modePaiement", op: "in", value: ["virement", "cheque"] },
    section: SECTION_PAIEMENT,
    order: 602,
  },
  // Champ IBAN UNIQUE (Oraliks 2026-07-07) : un seul input à l'écran, accepte
  // IBAN belge (BE…) ET étranger (FR…, DE…, NL…, LT…, LU…, ES…, IT…, AL…,
  // etc. — 31 pays via `isValidInternationalIBAN`). Au submit, la valeur est
  // routée vers le bon widget PDF selon le préfixe pays (BE → widget "IBAN",
  // autre → widget "SEPA étranger IBAN BIC") via `applyIbanCountryRouting`.
  {
    id: "iban",
    pdfFieldName: "IBAN",
    type: "iban",
    required: true,
    label: { fr: "N° de compte bancaire (IBAN)", nl: "", de: "" },
    help: {
      fr: "IBAN belge (BE…) ou étranger de la zone SEPA (FR…, DE…, NL…, LU…, ES…, IT…, LT… etc.). Le pays est détecté depuis les 2 premières lettres — pour un IBAN étranger, un BIC te sera demandé en plus.",
      nl: "",
      de: "",
    },
    placeholder: { fr: "BE00 0000 0000 0000", nl: "", de: "" },
    internationalIban: true,
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "virement" },
    section: SECTION_PAIEMENT,
    order: 603,
  },
  {
    id: "titulaireCompteNom",
    pdfFieldName: "Nom du titulaire",
    type: "text",
    required: true,
    label: { fr: "Nom et prénom du propriétaire du compte", nl: "", de: "" },
    placeholder: { fr: "Nom et prénom de la personne", nl: "", de: "" },
    visibleIf: { fieldId: "titulaireCompte", op: "equals", value: "autre-nom" },
    section: SECTION_PAIEMENT,
    order: 604,
  },
  // Widget « SEPA étranger IBAN BIC » du PDF : plus proposé à l'écran, mais
  // reste sérialisé et stampé par `applyIbanCountryRouting` au submit. Marqué
  // `autoAnswered` — jamais rendu comme contrôle interactif (cf. `isAutoField`).
  {
    id: "sepa_tranger_iban_bic",
    pdfFieldName: "SEPA étranger IBAN  BIC",
    type: "iban",
    required: false,
    label: { fr: "IBAN étranger (compte SEPA hors Belgique)", nl: "", de: "" },
    internationalIban: true,
    autoAnswered: true,
    section: SECTION_PAIEMENT,
    order: 605,
  },
  {
    id: "bic",
    pdfFieldName: "BIC",
    type: "text",
    // Obligatoire dès qu'il est visible (donc dès qu'un IBAN non-BE est
    // saisi) — la validation Zod n'exige un champ requis que s'il est
    // visible, cf. buildValidator + isFieldVisible dans validation.ts.
    required: true,
    label: { fr: "BIC (code SWIFT de la banque)", nl: "", de: "" },
    help: {
      fr: "Obligatoire pour un IBAN étranger. Le BIC se trouve sur tes extraits de compte (8 ou 11 caractères, ex. BNPAFRPP).",
      nl: "", de: "",
    },
    placeholder: { fr: "BNPAFRPP", nl: "", de: "" },
    // Format ISO 9362 (4 lettres banque + 2 lettres pays + 2 alphanumériques
    // + 3 alphanumériques optionnels) — vérifie juste la FORME, jamais
    // l'exactitude d'un code banque réel (aucune base fiable disponible ici
    // pour ça ; le mauvais code enverrait un paiement au mauvais endroit).
    regex: "^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$",
    // Visible seulement pour un IBAN étranger (préfixe 2 lettres ≠ BE). La
    // regex `^(?![Bb][Ee])[A-Za-z]{2}` ancre 2 lettres au début de l'IBAN,
    // avec un negative-lookahead sur BE — évite d'afficher le BIC tant que
    // l'IBAN est vide ou incomplet (< 2 lettres). Case-insensitive côté
    // regex source pour absorber une saisie en minuscules.
    visibleIf: {
      fieldId: "iban",
      op: "matchesRegex",
      value: "^(?![Bb][Ee])[A-Za-z]{2}",
    },
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
    // Volontairement non-required cote Zod (Oraliks 2026-07-07 : "Date et
    // signatue sont generer en auto"). Auto-rempli au mount + refill submit +
    // reinjecte serveur — Zod required ne peut que bloquer sur un champ que
    // l'utilisateur ne voit meme pas.
    required: false,
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
    // Non-required cote Zod : auto-confirmee via signerName (nom+prenom
    // resolus depuis l'identite du citoyen), bloc « facon Adobe » applique
    // par le serveur. Le required Zod est redondant et cassait le submit
    // quand le signerName resolution ratait au premier submit.
    required: false,
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

/// Set des `pdfFieldName` NON pipe-séparés utilisés par C1_QUESTIONS. Sans
/// cette couverture, les champs enrichis dont l'`id` est friendly (camelCase
/// : `modificationAdresse`, `titulaireCompteNom`…) mais dont le pdfFieldName
/// est la version verbeuse du PDF (« mon adresse à partir du », « Nom du
/// titulaire »…) se dédoublonnent avec leurs jumeaux inférés uniquement par
/// l'ID — or `makeId(pdfFieldName)` produit un slug DIFFÉRENT du camelCase,
/// donc `newIds.has(...)` rate le doublon et l'inféré survit (bug remonté par
/// Oraliks 2026-07-07 : chips `modificationAdresse` / `modificationCompte`
/// réapparaissant hors du step Motif avec leur libellé PDF brut).
function coveredSingleNames(): Set<string> {
  const set = new Set<string>();
  for (const q of C1_QUESTIONS) {
    if (!q.pdfFieldName || q.pdfFieldName.includes("|")) continue;
    set.add(q.pdfFieldName);
  }
  return set;
}

/// Widgets PDF « en-tête de page 2 » qui dupliquent des données déjà saisies
/// en page 1 (Nom + Prénom + date de DA) mais que le parser AcroForm remonte
/// comme des champs indépendants. Aucune case à ajouter en formulaire — juste
/// à masquer visuellement pour ne pas polluer la section Identité.
const HIDDEN_INFERRED_PDF_NAMES = new Set<string>([
  "Nom et prénom",
  "Date de DA",
]);

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
  /// Restreint le motif d'introduction à 5 situations concrètes (Oraliks,
  /// 2026-07-06) pour le dossier "changement de situation personnelle" :
  ///   - masque `modificationCotisationSyndicale` (hors périmètre de ce
  ///     dossier — la retenue syndicale se gère via la section Cotisation) ;
  ///   - relabelle + réordonne les 4 chips de modification restants
  ///     (adresse / situation familiale / permis / compte) selon le phrasé
  ///     dicté par Oraliks ;
  ///   - ajoute un 5e chip virtuel `transfereOrganismePaiement` (case à
  ///     cocher, aucune case PDF propre) qui révèle `dateChangementOrganisme`.
  /// `motifIntroduction` reste défaulté sur "modification" et n'est PLUS
  /// montré comme sélecteur — mais "je transfère vers un autre organisme" est
  /// une case PDF DIFFÉRENTE et mutuellement exclusive de "modification" sur
  /// le formulaire officiel (mêmes 4 cases radio qu'aujourd'hui). Il ne faut
  /// donc JAMAIS soumettre "modification" quand ce 5e chip est coché : la
  /// bascule se fait via `applyMotifTransferOverride`, appelée juste avant
  /// l'envoi du payload (cf. `submit()` dans pdf-form-runner.tsx) — jamais en
  /// mutant le state React live, pour ne pas faire disparaître les 4 chips
  /// (gatés sur motifIntroduction === "modification", qui doit rester stable
  /// pendant toute la saisie).
  restrictMotifTo5Situations?: boolean;
}

/// Clé de groupe partagée par les 5 chips "situation" : aucune n'est
/// individuellement requise, mais il en faut AU MOINS UNE (cf. `requiredGroup`
/// dans types.ts) — sinon l'étape "Motif" pouvait être passée sans rien
/// déclarer du tout (trouvé par Oraliks, 2026-07-07).
const MOTIF_SITUATION_GROUP = "motifSituation";

/// IDs des 15 radios oui/non « Activités & revenus » qui sont required
/// par défaut sur le C1 (déclaration initiale) mais tombent en accordéon
/// replié (`stepPriority: "optional"`) sur les dossiers restreints — ex.
/// « changement de situation personnelle ». Sans defaultValue, l'utilisateur
/// qui ne déplie pas l'accordéon reste bloqué au submit (Zod exige une
/// valeur pour un required visible). En dossier restreint, on les
/// pré-répond « non » par défaut : le citoyen peut toujours ouvrir
/// l'accordéon et basculer un item sur « oui » si applicable, ce qui
/// déclenche alors le sous-formulaire adéquat via les C1_TRIGGERS.
/// Oraliks 2026-07-07 : « on n'a pas le même parallèle entre le document
/// C1 pdf et le form runner » — ces 15 questions font sens pour une
/// première demande, pas pour un simple changement de situation.
const OPTIONAL_ACTIVITE_REVENU_IDS = new Set<string>([
  "etudesPleinExercice",
  "apprentissageAlternance",
  "formationStageSyntra",
  "mandatArtistique",
  "mandatPolitique",
  "chapitreXIIArts",
  "tremplinIndependants",
  "activiteAccessoireOuAide",
  "administrateurSociete",
  "independantAccessoireOuPrincipal",
  "pensionCategorieParticuliere",
  "pensionRetraiteSurvie",
  "indemniteMaladieInvalidite",
  "indemniteAccidentTravail",
  "avantageFinancierFormation",
]);

/// Libellés relabelés (phrasé "je/mon", Oraliks 2026-07-06) + nouvel ordre
/// d'affichage pour les 4 chips de modification existants, appliqués
/// uniquement quand `restrictMotifTo5Situations` est actif.
const RESTRICTED_MOTIF_OVERRIDES: Record<string, { label: string; order: number }> = {
  modificationAdresse: { label: "J'ai changé d'adresse", order: 5 },
  modificationSituationFamiliale: {
    label: "Ma situation personnelle ou celle des membres de mon ménage a changé",
    order: 6,
  },
  modificationPermisSejour: { label: "Mon permis de séjour ou mon permis de travail a changé", order: 7 },
  modificationCompte: { label: "Mon n° de compte bancaire a changé", order: 8 },
};

/// 5e situation : transfert vers un autre organisme de paiement. Virtuel
/// (aucune case PDF propre) — pilote uniquement la visibilité de
/// `dateChangementOrganisme` et, à la soumission, la valeur réelle de
/// `motifIntroduction` (cf. `applyMotifTransferOverride`).
const TRANSFERE_ORGANISME_FIELD: PdfFormField = {
  id: "transfereOrganismePaiement",
  pdfFieldName: "",
  type: "checkbox",
  required: false,
  label: { fr: "Je transfère mon dossier vers un autre organisme de paiement", nl: "", de: "" },
  section: SECTION_DEMANDE,
  order: 8.5,
  renderAs: "chip",
  requiredGroup: MOTIF_SITUATION_GROUP,
};

// La dérivation de soumission (`transfereOrganismePaiement` → override de
// `motifIntroduction`) vit dans lib/pdf-forms/c1-motif-transfer.ts, PAS ici :
// ce fichier seed/ n'est importé que côté serveur (scripts, routes admin) —
// le runner (composant client partagé par tous les dossiers) ne doit jamais
// importer ce module (C1_QUESTIONS + tout le schéma C1) pour éviter de
// gonfler le bundle client de CHAQUE formulaire avec ~150 définitions de
// champs qui ne le concernent pas.

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
  // La section signature (dateSignature + signature) doit vivre dans
  // l'étape finale — sans ça, les 2 champs tombent hors stepper et deviennent
  // invisibles ; leur prefill (system.today, signerName) s'applique mais si
  // pour une raison quelconque le prefill rate, l'utilisateur est bloqué au
  // submit avec un message générique et aucun champ visible à corriger.
  [SECTION_SIGNATURE]: "final",
};

function withStepGroup(f: PdfFormField): PdfFormField {
  const group = f.section ? SECTION_TO_STEP_GROUP[f.section] : undefined;
  return group ? { ...f, stepGroup: group } : f;
}

// ---------------------------------------------------------------------------
// Curation des widgets bruts non sectionnés (le « long-tail » inféré du PDF).
// Principe SÛR : on ne masque un champ que si son `pdfFieldName` est DÉJÀ
// rempli ailleurs (champ enrichi, ou array cohabitants via templates /
// firstMatchMapping), OU s'il s'agit d'un widget auto (date de génération,
// signature) ou cryptique. Jamais un widget unique porteur de donnée → aucune
// case officielle laissée blanche.
// ---------------------------------------------------------------------------

/// Étend un template positionnel "{index} 1" en "1 1","2 1",…,"N 1".
function expandTemplate(tpl: string, maxRows: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= maxRows; i++) out.push(tpl.replace("{index}", String(i)));
  return out;
}

/// Ensemble des pdfFieldName « déjà remplis » par les champs enrichis : nom
/// direct, parts pipe-séparées, templates d'array et cibles firstMatchMapping.
function collectCoveredPdfNames(fields: PdfFormField[]): Set<string> {
  const covered = new Set<string>();
  const add = (name?: string) => {
    if (!name) return;
    for (const part of name.split("|")) if (part) covered.add(part);
  };
  for (const f of fields) {
    add(f.pdfFieldName);
    if (f.type === "array") {
      const maxRows = f.maxRows ?? 5;
      for (const it of f.itemFields ?? []) {
        if (it.pdfFieldNameTemplate) for (const n of expandTemplate(it.pdfFieldNameTemplate, maxRows)) add(n);
        add(it.pdfFieldName);
      }
      if (f.firstMatchMapping) for (const v of Object.values(f.firstMatchMapping.fields)) add(v);
    }
  }
  return covered;
}

/// Widgets cryptiques / sans libellé exploitable (junk PDF).
const JUNK_PDF_RE = /^(undefined_\d+|Texte\d+|B E|Mois \+ Année|Remarques.*|Signature\d*)$/;
/// Cellules positionnelles de la grille cohabitants ("1", "1 1", "1_2"…) :
/// widgets de tableau sans libellé, remplis (colonnes 1/2) par l'array ou
/// laissés virtuels (colonne nom) — jamais saisis directement par l'usager.
const POSITIONAL_PDF_RE = /^\d+( \d+|_\d+)?$/;

/// Masque un champ NON sectionné s'il est un doublon couvert, un widget auto,
/// une cellule de grille positionnelle, ou du junk. Renvoie le champ inchangé
/// sinon (reste dans « Autres informations »). Ne touche jamais un sectionné.
function curatePreserved(f: PdfFormField, covered: Set<string>): PdfFormField {
  const name = f.pdfFieldName || "";
  // Contrairement aux autres règles de curation (limitées aux champs
  // NON sectionnés), la hide-list explicite des en-têtes de page 2
  // (« Nom et prénom », « Date de DA ») doit s'appliquer AUSSI aux champs
  // que field-inference a sectionnés à tort en `identite` — sinon ils
  // réapparaissent en bas de la section Identité (bug remonté par Oraliks
  // 2026-07-07 : « Nom Et PréNom » orphelin en fin d'identité).
  if (HIDDEN_INFERRED_PDF_NAMES.has(name)) return { ...f, hidden: true };
  if (f.section) return f;
  const isDuplicate = covered.has(name);
  const isAutoWidget = f.type === "signature" || /^Date\d+_af_date$/i.test(name);
  const isJunk =
    JUNK_PDF_RE.test(name) || POSITIONAL_PDF_RE.test(name) || (f.label?.fr ?? "") === "undefined";
  return isDuplicate || isAutoWidget || isJunk ? { ...f, hidden: true } : f;
}

export function applyC1Improvements(
  fields: PdfFormField[],
  opts?: ApplyC1ImprovementsOptions
): PdfFormField[] {
  const covered = coveredCheckboxNames();
  const coveredSingle = coveredSingleNames();
  const newIds = new Set(C1_QUESTIONS.map((q) => q.id));

  const preserved = fields.filter((f) => {
    // Retire les anciens checkboxes individuels désormais couverts par radio.
    if (covered.has(f.pdfFieldName)) return false;
    // Retire aussi les champs simples (non pipe-séparés) déjà couverts par un
    // champ enrichi de C1_QUESTIONS — protège contre les inférés qui portent
    // le même pdfFieldName mais un `id` slugifié différent du camelCase (cf.
    // `coveredSingleNames`).
    if (coveredSingle.has(f.pdfFieldName)) return false;
    // Retire aussi un éventuel ancien champ portant un id qu'on redéfinit.
    if (newIds.has(f.id)) return false;
    return true;
  });

  let questions = opts?.defaultMotif
    ? C1_QUESTIONS.map((q) =>
        q.id === "motifIntroduction" ? { ...q, defaultValue: opts.defaultMotif } : q
      )
    : C1_QUESTIONS;

  if (opts?.restrictMotifTo5Situations) {
    questions = questions
      .map((q) => {
        const override = RESTRICTED_MOTIF_OVERRIDES[q.id];
        if (override) {
          return {
            ...q,
            label: { ...q.label, fr: override.label },
            order: override.order,
            requiredGroup: MOTIF_SITUATION_GROUP,
            // Retire l'ancien visibleIf sur motifIntroduction === "modification" :
            // motifIntroduction est autoAnswered, donc ABSENT du schéma Zod
            // scindé par étape (validateStepFields) — son isFieldVisible()
            // y voit toujours `undefined` et exclut ces 4 champs du groupe,
            // laissant SEULE transfereOrganismePaiement pouvoir satisfaire
            // "au moins une situation" → blocage bloquant à tort l'avancée
            // d'étape (bug remonté par Oraliks, 2026-07-07). Dans ce flux
            // restreint motifIntroduction vaut "modification" tout du long
            // (sauf override au submit), donc ce gate était de toute façon
            // toujours vrai : plus rien à conditionner.
            visibleIf: undefined,
            // Message custom sur l'ANCRE (1ʳᵉ des 5, order=5) uniquement —
            // les 4 autres membres du groupe n'ont pas besoin du leur, seul
            // le 1er visible reçoit l'erreur (cf. buildValidator).
            ...(q.id === "modificationAdresse"
              ? {
                  errorMsg: {
                    fr: "Choisis au moins une situation parmi les 5 ci-dessus.",
                    nl: "", de: "",
                  },
                }
              : {}),
          };
        }
        if (q.id === "modificationCotisationSyndicale") return { ...q, hidden: true };
        if (q.id === "dateChangementOrganisme") {
          return {
            ...q,
            label: { ...q.label, fr: "Transférer mon dossier à partir du" },
            visibleIf: { fieldId: "transfereOrganismePaiement", op: "equals" as const, value: true },
          };
        }
        // N'est plus proposée comme motif (ce n'est pas une des 5 situations),
        // mais reste posée en Détails — juste un libellé court à la place du
        // phrasé brut de la C1 (l'aide détaillée reste en tooltip, cf.
        // LabelWithTooltip). Oraliks, 2026-07-07.
        if (q.id === "chomeurTemporaireAlternance") {
          return { ...q, label: { ...q.label, fr: "Chômeur temporaire suivant une formation en alternance" } };
        }
        // Libellé/aide raccourcis pour l'étape Motif (Oraliks, 2026-07-07).
        if (q.id === "dateModificationEffective") {
          return {
            ...q,
            label: { ...q.label, fr: "Date de changement" },
            help: {
              ...q.help,
              fr: "Date de la demande de changement. Une seule date pour l'adresse, la situation personnelle/du ménage et le compte bancaire. Si tes changements n'ont pas tous la même date d'effet, fais une déclaration séparée pour chaque date différente. Ne concerne pas la cotisation syndicale ni le permis de séjour (pas de date sur le formulaire officiel).",
            },
          };
        }
        // Reste réel/requis/soumis (nécessaire au filler + à la validation),
        // mais n'est plus montré comme sélecteur : les 5 chips pilotent sa
        // valeur (defaultValue "modification", ou "changement-op" via
        // applyMotifTransferOverride au submit). Cf. doc de
        // `autoAnswered` dans types.ts.
        if (q.id === "motifIntroduction") return { ...q, autoAnswered: true };
        // Les 15 radios oui/non « Activités & revenus » sont required mais
        // vivent dans un accordéon replié — sans defaultValue, l'utilisateur
        // qui ne l'ouvre pas est bloqué au submit (cf.
        // OPTIONAL_ACTIVITE_REVENU_IDS pour le pourquoi). En dossier
        // restreint, on pré-répond « non » — cliquable en « oui » si
        // applicable (déclenche alors le sous-formulaire C1_TRIGGERS).
        if (OPTIONAL_ACTIVITE_REVENU_IDS.has(q.id) && q.defaultValue === undefined) {
          return { ...q, defaultValue: "non" };
        }
        return q;
      })
      .concat(TRANSFERE_ORGANISME_FIELD);
  }

  // Pose `stepGroup` sur les champs sectionnés, puis cure les widgets bruts
  // non sectionnés (masque doublons / auto / junk — jamais un widget unique).
  const coveredNames = collectCoveredPdfNames(questions);
  const curated = [...preserved, ...questions]
    .map(withStepGroup)
    .map((f) => curatePreserved(f, coveredNames));

  // Dossier restreint (changement-situation-personnelle) : nos questions
  // enrichies couvrent tout ce qui est necessaire pour ce cas d'usage. Les
  // widgets bruts non sectionnes qui subsistent ("je demande des allocations
  // a partir du", "oui allez a la rubrique suivante", cases isolees "non_17"
  // / "non_18", flow markers C1A, etc.) sont des DOUBLONS ou des marqueurs
  // de flux qu'on a deja traites — Oraliks 2026-07-07 : « cette partie n'est
  // pas necessaire en soit puisqu'on y repond deja par le form runner ».
  // On les cache pour retirer l'accordeon « Autres informations » du step
  // final. Ils restent dans le payload et peuvent etre stampes au submit si
  // besoin (mais non-required, non-obligatoires).
  if (opts?.restrictMotifTo5Situations) {
    return curated.map((f) => (f.section || f.hidden ? f : { ...f, hidden: true }));
  }
  return curated;
}
