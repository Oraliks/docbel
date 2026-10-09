// SITUATION FAMILIALE — extrait de `c1-fields-improvements.ts` (2026-07-26).
//
// Situation familiale : isolé/cohabitant, pension alimentaire, grille des cohabitants.
//
// Découpage PUREMENT structurel : les définitions sont déplacées telles
// quelles. Le tableau complet est réassemblé dans `./index.ts`, dans l'ordre
// des modules — c'est cet ordre qui détermine l'ordre d'affichage.

import type { PdfFormField } from "../../types";
import {
  SECTION_SITUATION_FAMILIALE,
  YN,
  dejaDeclare,
} from "./helpers";

export const C1_FAMILLE: PdfFormField[] = [
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
    label: { fr: "Ma situation familiale" },
    help: { fr: "Choix unique : vous vivez seul ou vous cohabitez avec au moins une personne." },
    options: [
      { value: "isole", label: { fr: "Je vis seul (isolé)" } },
      { value: "cohabite", label: { fr: "Je cohabite avec au moins une personne" } },
    ],
    canonicalKey: "famille.statut",
    section: SECTION_SITUATION_FAMILIALE,
    order: 100,
  },
  {
    id: "pensionAlimentaire",
    pdfFieldName:
      "je paie une pension alimentaire en exécution dune décision judiciaire ou dun acte notarié 10|",
    type: "radio",
    // Obligatoire quand isolé (Oraliks 2026-07-18) : `required` sur un champ
    // `visibleIf` ne s'applique que lorsqu'il est visible → exigé uniquement
    // pour l'isolé (à qui la question est posée), jamais autrement.
    required: true,
    label: { fr: "Je paie une pension alimentaire (jugement, acte notarié, garde alternée)" },
    help: {
      fr: "⚠ Si oui, joindre obligatoirement une copie du JUGEMENT ou de l'ACTE NOTARIÉ. Les preuves de paiement (virements, reçus) ne suffisent pas. Vaut aussi pour la garde alternée.",
    },
    options: YN,
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "isole" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101,
  },
  {
    id: "pensionAlimentaireBaseJuridique",
    pdfFieldName: "",
    type: "select",
    required: false,
    label: { fr: "Base juridique de la pension alimentaire" },
    help: { fr: "Indiquez le document qui fonde le paiement. L'ONEM vérifie la situation et la pièce." },
    options: [
      { value: "decision-judiciaire", label: { fr: "Décision judiciaire" } },
      { value: "acte-notarie-divorce", label: { fr: "Acte notarié de divorce" } },
      { value: "acte-notarie-enfant", label: { fr: "Acte notarié relatif à un enfant" } },
      { value: "autre", label: { fr: "Autre document — à faire vérifier" } },
    ],
    visibleIf: { fieldId: "pensionAlimentaire", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.1,
  },
  {
    id: "pensionAlimentairePaiementEffectif",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Le paiement est-il actuellement effectué ?" },
    options: YN,
    visibleIf: { fieldId: "pensionAlimentaire", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.2,
  },
  {
    id: "pensionAlimentaireBeneficiaire",
    pdfFieldName: "",
    type: "select",
    required: false,
    label: { fr: "Bénéficiaire de la pension alimentaire" },
    options: [
      { value: "conjoint", label: { fr: "Conjoint ou ex-conjoint" } },
      { value: "enfant-mineur", label: { fr: "Enfant mineur" } },
      { value: "enfant-majeur", label: { fr: "Enfant majeur" } },
      { value: "autre", label: { fr: "Autre — à faire vérifier" } },
    ],
    visibleIf: { fieldId: "pensionAlimentaire", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.3,
  },
  {
    id: "pensionAlimentaireEnfantMajeurBesoin",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "L'enfant majeur est-il encore dans une situation pertinente pour cette obligation ?" },
    help: { fr: "En cas de doute, transmettez la pièce à votre organisme de paiement pour examen." },
    options: YN,
    visibleIf: { fieldId: "pensionAlimentaireBeneficiaire", op: "equals", value: "enfant-majeur" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.4,
  },
  {
    // Troisième voie d'accès au taux « charge de famille » quand on habite
    // seul, à côté de la pension alimentaire (C1-Info) : « vous êtes séparé de
    // fait et un jugement autorise votre conjoint à percevoir une partie de vos
    // revenus en vertu d'une délégation de revenu (art. 221 du Code civil) ».
    //
    // C'est la case imprimée JUSTE SOUS la pension alimentaire, et elle
    // n'existait nulle part dans le schéma : son widget était orphelin et le
    // citoyen concerné n'avait aucun moyen de la déclarer (2026-07-26). Cas
    // rare de l'aveu d'Oraliks — « jamais vu en plusieurs années » — mais il
    // ouvre un droit, donc il ne se néglige pas.
    id: "separeDeFaitDelegationRevenu",
    pdfFieldName:
      "je suis séparée de fait et mon conjoint perçoit une partie de mes revenus en exécution dune décision judiciaire 10",
    type: "checkbox",
    required: false,
    label: {
      fr: "Je suis séparé(e) de fait et un jugement autorise mon conjoint à percevoir une partie de mes revenus",
    },
    help: {
      fr: "Délégation de revenu (art. 221 du Code civil). ⚠ Joindre une copie du jugement. Comme la pension alimentaire, cette situation peut ouvrir le taux « charge de famille » alors que vous habitez seul.",
    },
    // Même condition que la pension alimentaire : la question ne se pose qu'à
    // l'isolé (c'est une voie d'accès au taux « charge de famille »).
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "isole" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.8,
  },
  {
    // Statut du jugement / acte notarié (Oraliks 2026-07-07, FUSIONNÉ le
    // 2026-07-26). Une seule question couvre désormais les DEUX cases
    // officielles du C1 — « je joins une copie » et « j'ai déjà introduit une
    // copie » — plus le cas « pas encore en ma possession », absent du PDF.
    // Avant, « déjà introduit » vivait dans un second champ
    // (`pensionAlimentaireDejaDeclare`) qui n'apparaissait qu'après avoir
    // répondu « oui, en main » : l'option officielle était donc invisible au
    // moment du choix. Et « jugement en cours » / « pas encore reçu »
    // disaient la même chose → fusionnés en une seule option.
    id: "statutJugementPensionAlimentaire",
    // Convention pipe : 1 widget PDF par option, dans l'ORDRE des options
    // (cf. filler.ts#stampPipeRadio). La 3ᵉ entrée est volontairement VIDE —
    // « pas encore reçu » ne coche rien et part en remarque via
    // `buildRemarqueFragments`.
    pdfFieldName: "je joins une copie|jai déjà introduit une copie|",
    type: "radio",
    // Obligatoire (Oraliks 2026-07-26). `required` sur un champ `visibleIf`
    // ne s'applique que lorsqu'il est visible → exigé uniquement quand une
    // pension alimentaire est déclarée.
    required: true,
    label: { fr: "Avez-vous le jugement (ou l'acte notarié) en main ?" },
    help: {
      fr: "« Déjà introduit » = vous l'avez transmis à votre organisme de paiement lors d'un dossier précédent : inutile de le joindre à nouveau.",
    },
    options: [
      { value: "en-main", label: { fr: "Oui, je joins une copie" } },
      { value: "deja-introduit", label: { fr: "Oui, et je l'ai déjà introduit précédemment" } },
      { value: "en-cours", label: { fr: "Non, le jugement est en cours / pas encore reçu" } },
    ],
    // Pas de defaultValue (Oraliks 2026-07-07) : on force un choix explicite
    // plutôt que de cocher une case officielle à la place du citoyen.
    visibleIf: { fieldId: "pensionAlimentaire", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.5,
  },
  {
    id: "dateArretPensionAlimentaire",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Date de fin effective du paiement, si le paiement a cessé" },
    visibleIf: { fieldId: "pensionAlimentairePaiementEffectif", op: "equals", value: "non" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.6,
  },
  {
    id: "dateDemandePensionAlimentaire",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Date de votre demande liée à la pension, si utile pour un examen rétroactif" },
    visibleIf: { fieldId: "pensionAlimentaire", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.61,
  },
  {
    id: "dateActePensionAlimentaire",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Date du jugement ou de l'acte" },
    visibleIf: { fieldId: "pensionAlimentaire", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.62,
  },
  {
    id: "dateReceptionPensionAlimentaire",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Date de réception de la copie, si elle est arrivée après votre demande" },
    visibleIf: { fieldId: "statutJugementPensionAlimentaire", op: "notEquals", value: "en-cours" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.63,
  },
  {
    id: "dateEffetRevendiquePensionAlimentaire",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Date d'effet que vous demandez à faire examiner" },
    visibleIf: { fieldId: "pensionAlimentaire", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.64,
  },
  {
    id: "hebergementAlterneEnfant",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Un enfant est-il hébergé en garde alternée chez vous ?" },
    options: YN,
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "isole" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.7,
  },
  {
    id: "hebergementAlterneRegulier",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Cet hébergement est-il réel et régulier ?" },
    options: YN,
    visibleIf: { fieldId: "hebergementAlterneEnfant", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.71,
  },
  {
    id: "hebergementAlternePieceStatut",
    pdfFieldName: "",
    type: "select",
    required: false,
    label: { fr: "Pièce relative à l'hébergement alterné" },
    help: { fr: "Indiquez si vous disposez du jugement ou de l'acte. S'il est attendu, la demande reste à faire examiner." },
    options: [
      { value: "jugement", label: { fr: "Jugement disponible" } },
      { value: "acte-notarie", label: { fr: "Acte notarié disponible" } },
      { value: "en-cours", label: { fr: "Jugement ou acte en attente" } },
    ],
    visibleIf: { fieldId: "hebergementAlterneEnfant", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.715,
  },
  {
    id: "dateDemandeHebergementAlterne",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Date de votre demande, si utile pour un examen rétroactif" },
    visibleIf: { fieldId: "hebergementAlterneEnfant", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.716,
  },
  {
    id: "datePieceHebergementAlterne",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Date du jugement ou de l'acte" },
    visibleIf: { fieldId: "hebergementAlterneEnfant", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.717,
  },
  {
    id: "dateReceptionHebergementAlterne",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Date de réception de la pièce" },
    visibleIf: { fieldId: "hebergementAlternePieceStatut", op: "notEquals", value: "en-cours" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.718,
  },
  {
    id: "dateEffetRevendiqueHebergementAlterne",
    pdfFieldName: "",
    type: "date",
    required: false,
    label: { fr: "Date d'effet que vous demandez à faire examiner" },
    visibleIf: { fieldId: "hebergementAlterneEnfant", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.719,
  },
  {
    id: "hebergementAlterneAllocationsFamiliales",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Percevez-vous des allocations familiales pour cet enfant ?" },
    options: YN,
    visibleIf: { fieldId: "hebergementAlterneEnfant", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.72,
  },
  {
    id: "hebergementAlterneEnfantRevenuPertinent",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Cet enfant a-t-il un revenu à signaler pour cette situation ?" },
    options: YN,
    visibleIf: { fieldId: "hebergementAlterneEnfant", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.73,
  },
  {
    id: "cohousingVieAutonomeRevendiquee",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Demandez-vous l'examen d'une vie autonome en co-housing ?" },
    help: { fr: "Cette déclaration ne fixe pas votre catégorie. L'ONEM examine les faits et les pièces, notamment l'Annexe REGIS si elle est requise." },
    options: YN,
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "isole" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.75,
  },
  {
    id: "cohousingBailDisponible",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Un bail ou une convention d'occupation est-il disponible ?" },
    options: YN,
    visibleIf: { fieldId: "cohousingVieAutonomeRevendiquee", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.76,
  },
  {
    id: "cohousingEspacePrivatif",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Disposez-vous d'un espace privatif pertinent à déclarer ?" },
    options: YN,
    visibleIf: { fieldId: "cohousingVieAutonomeRevendiquee", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.77,
  },
  {
    id: "cohousingAttestationHonneur",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Pouvez-vous fournir une attestation sur l'honneur ?" },
    options: YN,
    visibleIf: { fieldId: "cohousingVieAutonomeRevendiquee", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.78,
  },
  {
    id: "cohousingGestionMenageSeparee",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Les affaires domestiques sont-elles gérées séparément ?" },
    options: YN,
    visibleIf: { fieldId: "cohousingVieAutonomeRevendiquee", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.79,
  },
  {
    id: "cohousingExplicationVieAutonome",
    pdfFieldName: "",
    type: "textarea",
    required: false,
    label: { fr: "Expliquez brièvement votre organisation de vie autonome" },
    visibleIf: { fieldId: "cohousingVieAutonomeRevendiquee", op: "equals", value: "oui" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 101.8,
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
    // La règle serveur `remarque-fam` construit et stamp ce texte. Le champ
    // reste dans le payload, sans doubler l'écriture du filler générique.
    pdfFieldName: "",
    type: "textarea",
    required: false,
    label: { fr: "Remarque (situation familiale)" },
    autoAnswered: true,
    section: SECTION_SITUATION_FAMILIALE,
    order: 103,
  },
  {
    // Router de cohabitation (Oraliks 2026-07-09) : quand l'utilisateur
    // déclare cohabiter, on lève l'ambiguïté colocation vs ménage commun
    // AVANT de poser les questions détaillées. Cette réponse est factuelle :
    // elle ne qualifie jamais à elle seule une catégorie familiale et ne
    // ajoute pas automatiquement une Annexe REGIS.
    id: "cohabiteType",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "Avec cette ou ces personnes, formez-vous un ménage commun ?" },
    labelShort: { fr: "Ménage commun ?" },
    help: {
      fr: "Décrivez votre situation réelle. Cette réponse ne détermine pas à elle seule votre catégorie familiale : votre organisme de paiement doit la confirmer selon l'ensemble de votre situation.",
    },
    options: [
      { value: "menage-commun", label: { fr: "Oui — nous formons un ménage (dépenses partagées au moins en partie)" } },
      { value: "colocation", label: { fr: "Non — c'est une colocation (chacun sa vie, aucun budget commun)" } },
    ],
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "cohabite" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 103.5,
  },
  {
    id: "situationCohabitationAmbigue",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Les informations du C1 diffèrent-elles de celles du Registre national ou de la Banque-Carrefour ?" },
    labelShort: { fr: "Différence avec les registres ?" },
    help: {
      fr: "Par exemple : une adresse, une personne du ménage ou une situation déclarée sur ce C1 est différente des informations reprises dans les registres. Si vous ne le savez pas, vérifiez avec votre organisme de paiement.",
    },
    options: YN,
    defaultValue: "non",
    // Ne concerne que le ménage commun (Oraliks 2026-07-09) : une colocation
    // déclenche déjà l'Annexe REGIS via la bascule ci-dessus, et un isolé
    // n'a pas de cohabitation à préciser — la question n'a de sens que pour
    // une vraie cohabitation.
    visibleIf: { fieldId: "cohabiteType", op: "equals", value: "menage-commun" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 104,
  },
  dejaDeclare({
    id: "situationCohabitationAmbigueDejaDeclare",
    parentId: "situationCohabitationAmbigue",
    helpText: "Si non, vous devrez compléter l'ANNEXE REGIS — elle sera ajoutée à votre parcours.",
    section: SECTION_SITUATION_FAMILIALE,
    order: 105,
  }),
  {
    id: "habiteEnColocation",
    pdfFieldName: "",
    type: "radio",
    // Obligatoire quand isolé (Oraliks 2026-07-18) : même logique que
    // `pensionAlimentaire` — `required` + `visibleIf` = exigé seulement pour
    // l'isolé, à qui seul la question est posée.
    required: true,
    label: { fr: "Habitez-vous en colocation ?" },
    help: {
      fr: "Décrivez votre situation réelle, même si vous partagez une adresse avec d'autres personnes. Cette information ne détermine pas à elle seule votre catégorie familiale.",
    },
    options: YN,
    // Visible uniquement pour l'ISOLÉ (Oraliks 2026-07-09) : la colocation
    // coexiste avec un statut « isolé » officiel (cas cohousing, reporté en
    // remarque via la règle « cohousing »). Pour la branche « cohabite », la
    // colocation est captée en amont par `cohabiteType` (qui rebascule vers
    // isolé) — inutile de reposer la question ici.
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "isole" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 106,
  },
  {
    id: "previousStatutFamilial",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Avant ce changement, quelle situation aviez-vous déclarée ?" },
    help: { fr: "Si vous ne connaissez pas votre situation précédente, laissez cette réponse vide : DocBel ne tirera aucune conclusion à votre place." },
    options: [
      { value: "isole", label: { fr: "Isolé" } },
      { value: "cohabite", label: { fr: "Cohabitant" } },
    ],
    visibleIf: { fieldId: "modificationSituationFamiliale", op: "equals", value: true },
    section: SECTION_SITUATION_FAMILIALE,
    order: 106.5,
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
    label: { fr: "Personnes avec qui je cohabite" },
    help: {
      fr: "Ajoutez toutes les personnes qui font partie de votre ménage, même si elles sont domiciliées ailleurs. Une personne emprisonnée ou en institution psychiatrique compte toujours.",
    },
    addRowLabel: { fr: "Ajouter un cohabitant" },
    // Ménage commun uniquement (Oraliks 2026-07-09) : une colocation rebascule
    // vers isolé (cf. cohabiteType), on ne liste donc les membres du ménage
    // que pour une vraie cohabitation.
    visibleIf: { fieldId: "cohabiteType", op: "equals", value: "menage-commun" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 110,
    // La grille PDF a 5 slots positionnels — au-delà, on tronque silencieusement
    // au stamping (la logique applicative voit toujours toutes les lignes).
    maxRows: 5,
    firstMatchMapping: {
      where: { fieldId: "lien", value: "FAC" },
      fields: {
        // Le prénom du FAC est aussi reporté dans le widget résumé « Identité
        // du partenaire… ». Tout le RESTE de la grille (nom, lien, date,
        // allocations, activité type+montant, revenu type+montant) a un widget
        // PAR LIGNE (Personne{N}_* — nouvel AcroForm Oraliks 2026-07-10) →
        // stampé via pdfFieldNameTemplate sur les sous-champs, plus de
        // first-match sur des widgets uniques.
        prenom: "Identité du partenaire ou de la personne à charge",
        // Statut C1-PARTENAIRE : pipe (1ʳᵉ option "premiere-fois" → case « Je le
        // déclare pour la première fois… », 2ᵉ "deja-declare" → « Ma déclaration
        // précédente reste inchangée »).
        c1PartenaireStatus: "C1P_FirstTime|C1P_DejaDéclaré",
      },
    },
    itemFields: [
      {
        id: "prenom",
        pdfFieldName: "",
        type: "text",
        required: true,
        label: { fr: "Prénom" },
        pdfFieldNameTemplate: "Personne{index}_Prenom",
        order: 1,
      },
      {
        id: "nom",
        pdfFieldName: "",
        type: "text",
        required: true,
        label: { fr: "Nom" },
        pdfFieldNameTemplate: "Personne{index}_Nom",
        order: 2,
      },
      {
        id: "lien",
        pdfFieldName: "",
        type: "select",
        required: true,
        label: { fr: "Lien familial" },
        // Colonne « lien de parenté » (widget texte ligne 1 par personne). On
        // y stampe la VALEUR (ex. « FAC », « enfant ») ; la ligne 2 reste libre.
        pdfFieldNameTemplate: "Personne{index}_LienParente_Ligne1",
        help: { fr: "FAC = financièrement à charge. NFAC = non financièrement à charge." },
        // En mode colocation (Annexe REGIS), on ne demande que prénom + nom
        // (Oraliks 2026-07-07). Les autres sous-champs se cachent via
        // `visibleIfParent` évalué contre le payload du formulaire.
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        options: [
          { value: "epoux", label: { fr: "Époux/se" } },
          { value: "partenaire", label: { fr: "Partenaire" } },
          { value: "FAC", label: { fr: "Financièrement à charge (FAC)" } },
          { value: "NFAC", label: { fr: "Non financièrement à charge (NFAC)" } },
          { value: "enfant", label: { fr: "Enfant" } },
          { value: "pere", label: { fr: "Père" } },
          { value: "mere", label: { fr: "Mère" } },
          { value: "frere", label: { fr: "Frère" } },
          { value: "soeur", label: { fr: "Sœur" } },
          { value: "neveu", label: { fr: "Neveu" } },
          { value: "niece", label: { fr: "Nièce" } },
          { value: "oncle", label: { fr: "Oncle" } },
          { value: "tante", label: { fr: "Tante" } },
          { value: "cousin", label: { fr: "Cousin" } },
          { value: "cousine", label: { fr: "Cousine" } },
          { value: "aucun-lien", label: { fr: "Aucun lien de parenté" } },
        ],
        // Widget TEXTE : on imprime le libellé pour les liens familiaux (Père,
        // Mère, Enfant…) mais on GARDE les codes officiels FAC/NFAC tels quels
        // (absents de la table → stampés bruts). Oraliks 2026-07-10.
        stampMap: {
          epoux: "Époux/se",
          partenaire: "Partenaire",
          enfant: "Enfant",
          pere: "Père",
          mere: "Mère",
          frere: "Frère",
          soeur: "Sœur",
          neveu: "Neveu",
          niece: "Nièce",
          oncle: "Oncle",
          tante: "Tante",
          cousin: "Cousin",
          cousine: "Cousine",
          "aucun-lien": "Aucun lien",
        },
        order: 3,
      },
      {
        id: "dateNaissance",
        pdfFieldName: "",
        type: "date",
        required: true,
        label: { fr: "Date de naissance" },
        // Colonne « date de naissance » PAR LIGNE (widget par personne).
        pdfFieldNameTemplate: "Personne{index}_DateNaissance",
        // Peigne JJ MM AAAA, comme la date de naissance de la page 1 : les
        // barres obliques sont deja imprimees dans la grille. Calage a
        // ajuster a l oeil — les colonnes de la grille sont plus etroites
        // encore que la case de la page 1.
        printAsComb: {
          groups: [2, 2, 4],
          slotWidth: 7,
          groupExtra: 3,
          startX: 1,
          baselineY: 3,
        },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 4,
      },
      {
        id: "partenaireConditionsEtablies",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Les conditions pour reconnaître ce partenaire non marié sont-elles confirmées ?" },
        help: { fr: "Répondez oui seulement si vous avez vérifié la cohabitation réelle, l'absence de lien familial exclu et les autres conditions demandées par l'ONEM. En cas de doute, laissez cette réponse vide et vérifiez avec votre organisme de paiement." },
        options: YN,
        visibleIf: { fieldId: "lien", op: "equals", value: "partenaire" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 5.5,
      },
      {
        id: "allocationsFamiliales",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Je perçois des allocations familiales pour cette personne" },
        help: {
          fr: "Au-delà de 35 ans, la réponse est automatiquement « non ». Vous pouvez la rectifier si besoin.",
        },
        options: YN,
        // Colonne PAR LIGNE (dropdown « Personne{N}_AllocationsFamiliales »,
        // créé sans options → le filler ajoute « oui »/« non » à la volée).
        pdfFieldNameTemplate: "Personne{index}_AllocationsFamiliales",
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 5,
      },
      {
        id: "typeRevenuPro",
        pdfFieldName: "",
        type: "select",
        required: false,
        label: { fr: "Type de revenu professionnel" },
        options: [
          { value: "aucun", label: { fr: "Aucun" } },
          { value: "salarie-employe", label: { fr: "Employé" } },
          { value: "salarie-ouvrier", label: { fr: "Ouvrier" } },
          { value: "independant", label: { fr: "Indépendant" } },
        ],
        defaultValue: "aucun",
        // Seul « Indépendant » a besoin d'une version courte à l'impression
        // (Oraliks 2026-07-27) : à 10 pt il demande 63 pt dans une colonne qui
        // en offre 43, et l'ajustement automatique le descendait à 6,5 pt —
        // lisible, mais deux fois plus petit que ses voisins. « Indép. » le
        // ramène à taille pleine et rend la colonne homogène. Les trois autres
        // valeurs tiennent déjà : elles ne sont donc pas dans la table et
        // gardent le libellé de l'écran.
        stampMap: { independant: "Indép." },
        // Colonne PAR LIGNE (dropdown « Personne{N}_ActiviteProfessionnelle_Type »).
        pdfFieldNameTemplate: "Personne{index}_ActiviteProfessionnelle_Type",
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 6,
      },
      {
        id: "montantRevenuPro",
        pdfFieldName: "",
        pdfFieldNameTemplate: "Personne{index}_ActiviteProfessionnelle_Montant",
        type: "number",
        required: false,
        label: { fr: "Montant brut mensuel (€)" },
        help: {
          fr: "Pour un indépendant, valeur par défaut 999999,99 € — le statut indépendant rend la personne « cohabitante » sans plafond de revenu pour conjoint/partenaire.",
        },
        visibleIf: { fieldId: "typeRevenuPro", op: "notEquals", value: "aucun" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 7,
      },
      {
        id: "typeContratRevenuPro",
        pdfFieldName: "",
        type: "select",
        required: false,
        label: { fr: "Type de contrat pour ce revenu" },
        help: { fr: "Cette information aide votre organisme de paiement à examiner le revenu. Elle ne détermine pas seule votre catégorie familiale." },
        options: [
          { value: "cdi", label: { fr: "CDI" } },
          { value: "cdd", label: { fr: "CDD ou contrat à durée limitée" } },
          { value: "other", label: { fr: "Autre situation professionnelle" } },
        ],
        visibleIf: { fieldId: "typeRevenuPro", op: "notEquals", value: "aucun" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 7.01,
      },
      {
        id: "revenuProfessionnelVariable",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Le montant de ce revenu varie-t-il d'un mois à l'autre ?" },
        help: { fr: "Répondez oui si le salaire dépend notamment d'heures, commissions, primes ou missions variables." },
        options: YN,
        visibleIf: { fieldId: "typeRevenuPro", op: "notEquals", value: "aucun" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 7.02,
      },
      {
        id: "c110aStatut",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Avez-vous le formulaire C110A officiel pour ce mois ?" },
        help: { fr: "Ce document ONEM externe sert à déclarer le revenu variable du mois. DocBel ne le remplace pas." },
        options: [
          { value: "recu", label: { fr: "Oui, le C110A est disponible" } },
          { value: "non-recu", label: { fr: "Non, il doit encore être obtenu ou complété" } },
        ],
        visibleIf: { fieldId: "revenuProfessionnelVariable", op: "equals", value: "oui" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 7.03,
      },
      {
        id: "montantMensuelC110a",
        pdfFieldName: "",
        type: "number",
        required: false,
        label: { fr: "Revenu brut mensuel déclaré sur le C110A (€)" },
        help: { fr: "Indiquez le montant du mois concerné tel qu'il figure sur le C110A." },
        visibleIf: { fieldId: "c110aStatut", op: "equals", value: "recu" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 7.04,
      },
      {
        id: "premierRevenuProfessionnel",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Est-ce la première activité professionnelle de cet enfant ?" },
        help: {
          fr: "Répondez oui même si cette activité a commencé pendant les études. Cette information ne détermine pas à elle seule votre catégorie familiale.",
        },
        options: YN,
        visibleIf: { fieldId: "lien", op: "equals", value: "enfant" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 7.1,
      },
      {
        id: "dateDebutPremiereActivite",
        pdfFieldName: "",
        type: "date",
        required: false,
        label: { fr: "Date de début de cette première activité" },
        visibleIf: { fieldId: "premierRevenuProfessionnel", op: "equals", value: "oui" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 7.2,
      },
      {
        id: "dateFinEtudes",
        pdfFieldName: "",
        type: "date",
        required: false,
        label: { fr: "Date de fin ou d'arrêt des études" },
        help: { fr: "Indiquez la date déclarée pour la fin ou l'arrêt des études de cet enfant." },
        visibleIf: { fieldId: "premierRevenuProfessionnel", op: "equals", value: "oui" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 7.3,
      },
      {
        id: "demandeNeutralisationPremierRevenu",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Demandez-vous l'examen d'une neutralisation temporaire de ce revenu ?" },
        help: {
          fr: "Cette demande sera à confirmer par votre organisme de paiement ; DocBel ne décide pas de votre catégorie familiale.",
        },
        options: YN,
        visibleIf: { fieldId: "premierRevenuProfessionnel", op: "equals", value: "oui" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 7.4,
      },
      {
        id: "revenuRemplacement",
        pdfFieldName: "",
        pdfFieldNameTemplate: "Personne{index}_RevenuRemplacement_Type",
        type: "select",
        required: false,
        label: { fr: "Revenu de remplacement" },
        help: { fr: "Mutuelle (maladie-invalidité), CPAS, pension, allocations chômage, etc." },
        options: [
          { value: "aucun", label: { fr: "Aucun" } },
          { value: "mutuelle", label: { fr: "Mutuelle (maladie-invalidité)" } },
          { value: "cpas", label: { fr: "CPAS (revenu d'intégration)" } },
          { value: "pension", label: { fr: "Pension" } },
          { value: "chomage", label: { fr: "Allocations de chômage" } },
          { value: "allocation-handicap", label: { fr: "Allocation SPF Handicap" } },
          { value: "autre", label: { fr: "Autre" } },
        ],
        defaultValue: "aucun",
        // Libellés COURTS à l'impression (Oraliks 2026-07-27). La colonne du
        // PDF offre 46 pt : « Mutuelle (maladie-invalidité) » en demande 172,
        // et même réduite au plancher de 5 pt elle en demanderait encore 72.
        // Aucun ajustement de police ne pouvait sauver ce libellé — seul un
        // texte plus court le peut. L'écran garde la version explicite, qui
        // aide le citoyen à se reconnaître ; le papier reçoit le mot-clé.
        stampMap: {
          mutuelle: "Mutuelle",
          cpas: "CPAS",
          pension: "Pension",
          chomage: "Chômage",
          autre: "Autre",
        },
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
        pdfFieldNameTemplate: "Personne{index}_RevenuRemplacement_Montant",
        type: "number",
        required: false,
        label: { fr: "Montant brut mensuel du revenu de remplacement (€)" },
        visibleIf: { fieldId: "revenuRemplacement", op: "notEquals", value: "aucun" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 9,
      },
      {
        id: "montantPensionNature",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Le montant de pension indiqué est-il brut ?" },
        help: { fr: "Le montant brut est nécessaire pour l'examen de la situation familiale." },
        options: [
          { value: "brut", label: { fr: "Oui, montant brut" } },
          { value: "net", label: { fr: "Non, montant net ou non vérifié" } },
        ],
        visibleIf: { fieldId: "revenuRemplacement", op: "equals", value: "pension" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 9.05,
      },
      {
        id: "preuvePension",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Preuve SPF Pensions du mois pertinent disponible ?" },
        help: { fr: "Joignez ou conservez le document SPF Pensions demandé par votre organisme de paiement." },
        options: [
          { value: "recu", label: { fr: "Oui, preuve disponible" } },
          { value: "manquante", label: { fr: "Non, preuve à fournir" } },
        ],
        visibleIf: { fieldId: "revenuRemplacement", op: "equals", value: "pension" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 9.06,
      },
      {
        id: "handicapReconnu",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Cette personne est-elle reconnue en situation de handicap pour cette règle ?" },
        help: { fr: "Cette déclaration ne suffit pas pour appliquer un plafond spécial de pension : la preuve officielle reste nécessaire." },
        options: YN,
        visibleIf: { fieldId: "revenuRemplacement", op: "equals", value: "pension" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 9.1,
      },
      {
        id: "preuveHandicap",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Disposez-vous de l'attestation SPF Sécurité sociale requise ?" },
        help: { fr: "Sans attestation, votre organisme de paiement doit vérifier le plafond applicable." },
        options: YN,
        visibleIf: { fieldId: "handicapReconnu", op: "equals", value: "oui" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 9.2,
      },
      {
        id: "remarque",
        pdfFieldName: "",
        type: "textarea",
        required: false,
        label: { fr: "Remarque" },
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
        label: { fr: "Déclaration C1-PARTENAIRE" },
        help: {
          fr: "Auto-pré-sélectionné sur « 1ʳᵉ fois / modification » dès que le lien devient FAC — vous pouvez changer si la situation a déjà été déclarée.",
        },
        options: [
          {
            value: "premiere-fois",
            label: { fr: "Première fois (ou modification) — joindre un FORMULAIRE C1-PARTENAIRE" },
          },
          {
            value: "deja-declare",
            label: { fr: "Ma déclaration C1-PARTENAIRE précédente reste inchangée" },
          },
        ],
        visibleIf: { fieldId: "lien", op: "equals", value: "FAC" },
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 11,
      },
    ],
  },
];
