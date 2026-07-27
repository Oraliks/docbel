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
    help: { fr: "Choix unique : tu vis seul ou tu cohabites avec au moins une personne." },
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
      fr: "Délégation de revenu (art. 221 du Code civil). ⚠ Joindre une copie du jugement. Comme la pension alimentaire, cette situation peut ouvrir le taux « charge de famille » alors que tu habites seul.",
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
    label: { fr: "As-tu le jugement (ou l'acte notarié) en main ?" },
    help: {
      fr: "« Déjà introduit » = tu l'as transmis à ton organisme de paiement lors d'un dossier précédent : inutile de le joindre à nouveau.",
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
    // AVANT de poser les questions détaillées. Une colocation (colocataires
    // sans budget commun) est traitée comme ISOLÉ + Annexe REGIS côté ONEM —
    // d'où la bascule automatique `onSelectSet` : choisir « colocation » remet
    // statutFamilial=isolé et coche habiteEnColocation=oui (réutilise la
    // remarque « cohousing » + le trigger REGIS existants, aucune règle en
    // double). Seul « ménage commun » ouvre la grille cohabitants + la
    // question d'ambiguïté ci-dessous.
    id: "cohabiteType",
    pdfFieldName: "",
    type: "radio",
    required: true,
    label: { fr: "Avec cette ou ces personnes, formez-vous un ménage commun ?" },
    labelShort: { fr: "Ménage commun ?" },
    help: {
      fr: "Important : une COLOCATION (colocataires qui partagent un logement mais chacun gère sa vie, sans budget commun) n'est PAS une cohabitation au sens du chômage — tu es alors considéré comme ISOLÉ, et une Annexe REGIS est ajoutée pour le préciser. Ne choisis « Oui, ménage commun » que si vous partagez réellement, au moins en partie, les dépenses courantes (loyer, courses, factures).",
    },
    options: [
      { value: "menage-commun", label: { fr: "Oui — nous formons un ménage (dépenses partagées au moins en partie)" } },
      { value: "colocation", label: { fr: "Non — c'est une colocation (chacun sa vie, aucun budget commun)" } },
    ],
    onSelectSet: {
      whenValue: "colocation",
      set: [
        { fieldId: "statutFamilial", value: "isole" },
        { fieldId: "habiteEnColocation", value: "oui" },
      ],
    },
    visibleIf: { fieldId: "statutFamilial", op: "equals", value: "cohabite" },
    section: SECTION_SITUATION_FAMILIALE,
    order: 103.5,
  },
  {
    id: "situationCohabitationAmbigue",
    pdfFieldName: "",
    type: "radio",
    required: false,
    label: { fr: "Ta situation de cohabitation est ambiguë (registre national / réalité de ménage divergents) ?" },
    labelShort: { fr: "Cohabitation ambiguë ?" },
    help: {
      fr: "Exemples : domiciliation à une adresse mais résidence à une autre, hébergement temporaire chez un tiers, garde alternée d'enfant non encore enregistrée… → l'Annexe REGIS sera ajoutée à ton parcours pour préciser la composition réelle du ménage.",
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
    helpText: "Si non, tu devras compléter l'ANNEXE REGIS — elle sera ajoutée à ton parcours.",
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
    label: { fr: "Habites-tu en colocation ?" },
    help: {
      fr: "Colocation = tu partages un logement avec une ou plusieurs personnes SANS lien de parenté ni de couple (chacun sa vie, pas de ménage commun) — même si le registre national vous montre à la même adresse. Utile aussi si tu vis officiellement seul mais partages en pratique le logement (cohousing) — la remarque situation familiale sera annotée automatiquement. Cette précision permet d'ajouter automatiquement l'ANNEXE REGIS à ton parcours.",
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
      fr: "Ajoute toutes les personnes qui font partie de ton ménage, même si elles sont domiciliées ailleurs. Une personne emprisonnée ou en institution psychiatrique compte toujours.",
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
        visibleIfParent: { fieldId: "habiteEnColocation", op: "notEquals", value: "oui" },
        order: 4,
      },
      {
        id: "allocationsFamiliales",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "Je perçois des allocations familiales pour cette personne" },
        help: {
          fr: "Au-delà de 35 ans, la réponse est automatiquement « non ». Tu peux la rectifier si besoin.",
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
          fr: "Auto-pré-sélectionné sur « 1ʳᵉ fois / modification » dès que le lien devient FAC — tu peux changer si la situation a déjà été déclarée.",
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
