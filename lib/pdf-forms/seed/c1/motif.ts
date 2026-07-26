// MOTIF — extrait de `c1-fields-improvements.ts` (2026-07-26).
//
// Motif d'introduction et dates d'effet.
//
// Découpage PUREMENT structurel : les définitions sont déplacées telles
// quelles. Le tableau complet est réassemblé dans `./index.ts`, dans l'ordre
// des modules — c'est cet ordre qui détermine l'ordre d'affichage.

import type { PdfFormField } from "../../types";
import {
  SECTION_DEMANDE,
  SECTION_SIGNATURE,
  YN,
} from "./helpers";

export const C1_MOTIF: PdfFormField[] = [
  // ====================================================================
  // SECTION 1 — DEMANDE (motifs d'introduction)
  // ====================================================================
  {
    id: "dateDemande",
    pdfFieldName: "DateAllocation",
    type: "date",
    required: true,
    label: { fr: "Je demande des allocations à partir du" },
    help: { fr: "Date du premier jour pour lequel tu demandes des allocations." },
    prefillFrom: "system.today",
    section: SECTION_DEMANDE,
    order: 1,
  },
  {
    id: "chomeurTemporaireAlternance",
    pdfFieldName: "oui|non",
    type: "radio",
    // Non-required + pas de defaultValue (Oraliks 2026-07-07 : « si j'ai pas
    // coché alors tu dois pas coché non plus »). Sans valeur, le stamping
    // pipe-radio uncheck les 2 cases → PDF neutre.
    required: false,
    label: {
      fr: "… comme chômeur temporaire suivant une formation en alternance",
    },
    help: {
      fr: "Cas rare — coche « non » sauf si tu suis une formation en alternance et que tu es en chômage temporaire pendant cette formation.",
    },
    options: YN,
    section: SECTION_DEMANDE,
    order: 2,
  },
  {
    id: "motifIntroduction",
    pdfFieldName:
      "PremièreFois|après une interruption de mes allocations 5|je déclare une modification concernant|je change dorganisme de paiement à partir du 5",
    type: "radio",
    required: true,
    label: { fr: "Motif d'introduction de cette demande" },
    help: {
      fr: "« Première fois » = premier dossier de ce type, nouvelle admissibilité (souvent quand il n'y a pas eu d'allocation depuis plus d'un an), ou tout premier dossier. « Interruption » = reprise après une période de non-versement.",
    },
    options: [
      { value: "premiere", label: { fr: "Pour la première fois" } },
      { value: "interruption", label: { fr: "Après une interruption de mes allocations" } },
      { value: "modification", label: { fr: "Je déclare une modification" } },
      { value: "changement-op", label: { fr: "Je change d'organisme de paiement" } },
    ],
    section: SECTION_DEMANDE,
    order: 3,
    renderAs: "chip",
  },
  {
    id: "dateChangementOrganisme",
    pdfFieldName: "",
    // Obligatoire (Oraliks 2026-07-18) : quand le transfert d'organisme est
    // choisi, la date de prise d'effet DOIT être renseignée. `required` sur un
    // champ `visibleIf` ne s'applique que lorsqu'il est VISIBLE (cf.
    // buildValidator + validateStepFields) → n'exige la date QUE si le transfert
    // est sélectionné, jamais autrement. Stampée via le binding `date-transfert`
    // (→ DateDeTransfert) + en-tête `DateDeDA`.
    type: "date",
    required: true,
    label: { fr: "À partir du" },
    help: {
      fr: "Le transfert prend effet le mois suivant, sous certaines conditions de délai qui dépendent de ton type d'allocation actuel. Ton nouvel organisme de paiement te confirmera la date exacte.",
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
    label: { fr: "Modification d'adresse" },
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
    label: { fr: "Modification du compte bancaire" },
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
    label: { fr: "Modification de situation familiale" },
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
    label: { fr: "Modification du permis de séjour" },
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
    label: { fr: "Modification de la cotisation syndicale" },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 9,
    renderAs: "chip",
  },
  // NOTE Phase 7 : le widget « Date de DA » (page 2, x=506) est désormais
  // stampé par la règle `date-header-p2` du moteur de bindings serveur
  // (`lib/pdf-forms/bindings/per-form/c1-changement.ts`). Le champ
  // workaround `dateHeaderP2` (autoAnswered) a été supprimé — sans utilité
  // depuis que la règle serveur produit la valeur directement.
  {
    id: "dateModificationEffective",
    pdfFieldName: "", // Stampé par bindings (c1-changement.ts) sur DateAdresse / DatePersonnelleOuMenage / DateBanque — une par chip modif COCHÉ. Le transfert porte sa propre date (dateChangementOrganisme → DateDeTransfert).
    type: "date",
    required: false,
    label: { fr: "Date d'effet de la ou des modification(s) cochée(s) ci-dessus" },
    help: {
      fr: "Une seule date pour l'adresse, la situation personnelle/du ménage et le compte bancaire. Si tes changements n'ont pas tous la même date d'effet, fais une déclaration séparée pour chaque date différente. Ne concerne pas la cotisation syndicale ni le permis de séjour (pas de date sur le formulaire officiel).",
    },
    visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
    section: SECTION_DEMANDE,
    order: 9.5,
  },
  {
    // Date de création du DOCUMENT (Oraliks 2026-07-10 : « date du jour tout en
    // bas de la page 2 »). Stampe le widget `DateDeCréationDocument` (zone
    // signature, bas de page 2). Auto-remplie du jour : `prefillFrom
    // system.today` ⇒ `isCreationDateField` ⇒ non rendue à l'écran + injectée
    // serveur. Distincte de l'en-tête `DateDeDA` (« date DA / modification » =
    // date du changement, via règle binding `date-header-p2`).
    id: "dateCreationDossier",
    pdfFieldName: "DateDeCréationDocument",
    type: "date",
    required: false,
    label: { fr: "Date de création du document" },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
  },
];
