// Dossier "Allocations d'insertion" — module autonome (skeleton fonctionnel).
//
// Les allocations d'insertion s'adressent au JEUNE qui demande pour la
// première fois une indemnisation de chômage sur base de ses ÉTUDES (et non
// sur base d'un travail salarié suffisant). Contrairement au chômage complet
// "classique", il n'y a pas d'historique de travail à prouver : le droit
// s'ouvre après un stage d'insertion professionnelle accompli à la fin des
// études. Le montant est forfaitaire (selon la situation familiale, parfois
// l'âge) et le droit est limité dans le temps (1 an depuis la réforme entrée
// en vigueur le 01/03/2026 ; 3 ans auparavant).
//
// Ce module est un SQUELETTE : il met en place le questionnaire d'orientation
// et le C1 (déclaration de situation personnelle). Les pièces spécifiques
// (attestation d'études, formulaire de stage d'insertion) ne sont pas encore
// disponibles en PDF — elles sont documentées en TODO ci-dessous.
//
// Sources publiques de référence (paraphrasées, jamais citées verbatim) :
// www.onem.be — allocations d'insertion ; règles relatives au stage
// d'insertion professionnelle après les études. Régime en vigueur depuis le
// 01/03/2026 : stage de 156 jours (au lieu de 310), allocations limitées à
// 1 an / 12 mois (au lieu de 3 ans) — cf. Loi-programme du 18/07/2025.

import type { DossierDefinition, DossierTheorySection } from "../types";

// -------------------------------------------------------------------
// TODOs documents — à seeder quand les PDFs officiels seront disponibles.
// -------------------------------------------------------------------
//   - Attestation d'études : délivrée par l'établissement scolaire,
//     confirme la fin des études (et le diplôme/titre pour les < 21 ans).
//     Slug provisoire : "attestation-etudes".
//   - Formulaire de stage d'insertion professionnelle : suivi du stage de
//     156 jours auprès du service régional de l'emploi.
//     Slug provisoire : "stage-insertion".
// -------------------------------------------------------------------

/// Sections de l'espace théorique. Paraphrases internes — pas de copie de
/// source non publique. Audience : admin + partenaires uniquement à ce stade.
const THEORY: DossierTheorySection[] = [
  {
    id: "quest-ce-que-allocation-insertion",
    title: "Qu'est-ce que l'allocation d'insertion ?",
    titleKey: "insertion.theory.questCeQue.title",
    body: `
L'allocation d'insertion est une allocation de chômage destinée au jeune
qui sort des études et qui demande pour la **première fois** une
indemnisation sur base de ces études — et non sur base d'un travail
salarié déjà accompli.

Elle se distingue du chômage complet classique : il n'y a pas de nombre
de jours de travail à prouver. Le droit repose sur le parcours scolaire
et sur l'accomplissement d'un stage d'insertion professionnelle après la
fin des études.

Source publique de référence : www.onem.be.
    `.trim(),
    bodyKey: "insertion.theory.questCeQue.body",
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-10",
  },
  {
    id: "conditions",
    title: "Les conditions (âge, études, stage de 156 jours)",
    titleKey: "insertion.theory.conditions.title",
    body: `
Les principales conditions paraphrasées :

- **Nationalité / séjour** : être belge, ou ressortissant d'un pays qui
  permet l'accès (UE/EEE), ou en règle de séjour et de travail pour les
  autres situations.
- **Obligation scolaire terminée** : ne plus y être soumis (en pratique,
  avoir au moins 18 ans, ou avoir dépassé le 30 juin de l'année des 18 ans).
- **Études donnant droit au chômage en Belgique** : avoir terminé un
  parcours d'études reconnu. Pour les jeunes de **moins de 21 ans**, il
  faut un **diplôme ou titre** (avoir seulement suivi les cours ne suffit
  pas) et la liste des études admises est plus restrictive.
- **Stage d'insertion professionnelle** : accomplir un stage de **156 jours**
  (environ 6 mois) après la fin des activités scolaires, avec inscription
  comme demandeur d'emploi auprès du service régional de l'emploi.
- **Limite d'âge** : la demande doit en principe être introduite **avant
  25 ans** (des exceptions existent, par exemple pour un parcours scolaire
  long).

Source publique de référence : www.onem.be.
    `.trim(),
    bodyKey: "insertion.theory.conditions.body",
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-07-03",
  },
  {
    id: "duree-et-montant",
    title: "Combien de temps / combien ? (forfait, limité à 1 an)",
    titleKey: "insertion.theory.dureeEtMontant.title",
    body: `
Le montant de l'allocation d'insertion est **forfaitaire** : il ne dépend
pas d'un salaire antérieur mais de la situation familiale du jeune (isolé,
cohabitant, chef de ménage) et, dans certains cas, de son âge. Il n'y a
pas d'évolution par périodes d'indemnisation comme dans le chômage
classique.

Le droit est **limité dans le temps** : depuis la réforme entrée en
vigueur le 1ᵉʳ mars 2026, 1 an (12 mois) maximum (avant cette date :
3 ans). Cette durée peut être prolongée d'une durée égale aux périodes de
travail ou événements assimilés (maladie, accident, maternité...)
survenus pendant l'indemnisation.

Source publique de référence : www.onem.be.
    `.trim(),
    bodyKey: "insertion.theory.dureeEtMontant.body",
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-07-03",
  },
];

export const allocationsInsertion: DossierDefinition = {
  slug: "allocations-insertion",
  title: "Allocations d'insertion (jeunes)",
  titleKey: "insertion.title",
  description:
    "Pour les jeunes qui sortent des études et n'ont pas (assez) travaillé pour ouvrir un droit au chômage classique.",
  descriptionKey: "insertion.description",
  category: "emploi",
  icon: "🎓",
  color: "#16A34A",
  vocabularyTags: [
    "allocations insertion",
    "jeune",
    "fin études",
    "stage insertion",
    "SIP",
    "156 jours",
    "premier emploi",
    "diplôme",
  ],

  // Les allocations d'insertion ne se déclinent pas en "motifs" : la demande
  // est binaire (le droit s'ouvre ou non selon âge, études et stage). Les
  // éléments de situation sont consignés dans le questionnaire.
  types: [],

  questions: [
    // ------- Âge (condition clé : demande avant 25 ans) -------
    {
      id: "age",
      label: { fr: "Quel âge as-tu ?" },
      helpText: {
        fr: "La demande doit en principe être faite avant 25 ans.",
      },
      type: "select",
      options: [
        { value: "moins-18", label: { fr: "Moins de 18 ans" } },
        { value: "18-20", label: { fr: "Entre 18 et 20 ans" } },
        { value: "21-24", label: { fr: "Entre 21 et 24 ans" } },
        { value: "25-plus", label: { fr: "25 ans ou plus" } },
      ],
    },

    // ------- Fin des études -------
    {
      id: "aTermineEtudes",
      label: { fr: "As-tu terminé (ou arrêté) tes études ?" },
      helpText: {
        fr: "Réponds « oui » si tu as fini ton année ou si tu as arrêté l'école. Les allocations d'insertion s'ouvrent après la fin des activités scolaires.",
      },
      type: "boolean",
    },

    // ------- Diplôme (obligatoire avant 21 ans) -------
    {
      id: "aDiplome",
      label: { fr: "As-tu obtenu un diplôme ou un titre ?" },
      helpText: {
        fr: "Avant 21 ans, avoir un diplôme est obligatoire — pas juste avoir suivi les cours.",
      },
      type: "boolean",
      // Pertinent surtout pour les jeunes de moins de 21 ans, pour qui le
      // diplôme/titre est une condition d'accès.
      visibleIf: { fieldId: "age", op: "in", value: ["moins-18", "18-20"] },
    },

    // ------- Stage d'insertion professionnelle (156 jours) -------
    {
      id: "stageInsertion",
      label: {
        fr: "Où en es-tu de ton stage d'insertion professionnelle (156 jours = environ 6 mois après la fin des études) ?",
      },
      helpText: {
        fr: "Le stage d'insertion est une période d'environ 6 mois après la fin des études, pendant laquelle tu cherches du travail. Tu ne peux toucher les allocations qu'une fois ce stage terminé (et après 2 évaluations positives du service régional de l'emploi).",
      },
      type: "select",
      options: [
        { value: "pas-commence", label: { fr: "Pas encore commencé" } },
        { value: "en-cours", label: { fr: "En cours" } },
        { value: "termine-156j", label: { fr: "Terminé (156 jours atteints)" } },
      ],
    },

    // ------- Inscription comme demandeur d'emploi -------
    {
      id: "inscritDemandeurEmploi",
      label: { fr: "Es-tu déjà inscrit comme demandeur d'emploi ?" },
      helpText: {
        fr: "Pour faire courir ton stage d'insertion, tu dois être inscrit dans le service de l'emploi de ta région : FOREM en Wallonie, ACTIRIS à Bruxelles, VDAB en Flandre, ADG en Communauté germanophone. Si tu ne sais plus, réponds « non » — on te rappellera comment faire.",
      },
      type: "boolean",
    },

    // ------- Nationalité / séjour -------
    {
      id: "nationalite",
      label: { fr: "Quelle est ta nationalité ?" },
      helpText: {
        fr: "Si tu n'es pas belge ni d'un pays UE/EEE, des conditions de permis de séjour/travail s'ajoutent.",
      },
      type: "select",
      options: [
        { value: "belge", label: { fr: "Belge" } },
        { value: "ue-eee", label: { fr: "D'un pays de l'UE / EEE" } },
        { value: "hors-ue", label: { fr: "D'un autre pays (hors UE/EEE)" } },
      ],
    },

    // ------- Situation familiale (détermine le forfait) -------
    {
      id: "chargeFamille",
      label: { fr: "Avec qui vis-tu ?" },
      helpText: {
        fr: "Isolé = tu vis seul. Cohabitant = tu vis avec d'autres personnes qui ont aussi un revenu. Chef de ménage = tu vis avec ta famille et tu es la seule personne du ménage qui ramène un revenu. Cela détermine le montant forfaitaire de l'allocation.",
      },
      type: "select",
      options: [
        { value: "isole", label: { fr: "Je vis seul (isolé)" } },
        { value: "cohabitant", label: { fr: "Avec d'autres revenus (cohabitant)" } },
        { value: "chef-menage", label: { fr: "Je suis le seul revenu du foyer (chef de ménage)" } },
      ],
    },
  ],

  warnings: [
    {
      title: "Demande avant 25 ans",
      titleKey: "insertion.warning.demandeAvant25.title",
      message:
        "La demande doit en principe être introduite AVANT tes 25 ans. Passé cet âge, le droit aux allocations d'insertion n'est généralement plus ouvert (sauf exceptions).",
      messageKey: "insertion.warning.demandeAvant25.message",
      severity: "critical",
    },
    {
      title: "Stage d'insertion de 156 jours",
      titleKey: "insertion.warning.stageInsertion310j.title",
      message:
        "Tu dois d'abord accomplir un stage d'insertion professionnelle de 156 jours (environ 6 mois) après la fin de tes études avant de pouvoir toucher les allocations.",
      messageKey: "insertion.warning.stageInsertion310j.message",
      severity: "info",
    },
  ],

  documents: [
    {
      // C1 — Déclaration de situation personnelle.
      // Pivot du dossier tant que l'attestation d'études et le formulaire de
      // stage d'insertion ne sont pas encore disponibles côté PDF.
      // NB : slug distinct des autres C1 (chomage-temporaire / -complet) pour
      // éviter un conflit dans la table PdfForm (slug unique global).
      slug: "c1-insertion",
      title: "C1 — Déclaration de situation personnelle",
      titleKey: "insertion.doc.c1.title",
      issuer: "ONEM",
      required: true,
      sourcePdfPath: "private/pdfs/C1_FR.pdf",
      internalRef: "Dossier allocations-insertion, document central (déclaration personnelle).",
      fields: [
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
      ],
    },
    // -----------------------------------------------------------------
    // À AJOUTER ULTÉRIEUREMENT, quand les PDFs officiels seront disponibles :
    //   - Attestation d'études (slug provisoire "attestation-etudes") :
    //     délivrée par l'établissement, confirme la fin des études et, pour
    //     les < 21 ans, le diplôme/titre obtenu.
    //   - Formulaire de stage d'insertion professionnelle (slug provisoire
    //     "stage-insertion") : suivi des 156 jours auprès du service régional
    //     de l'emploi.
    // -----------------------------------------------------------------
  ],

  journeyCtaLabel: "Créer ma demande sur base des études",
  journeyCtaLabelKey: "insertion.journeyCtaLabel",
  journey: [
    {
      order: 1,
      icon: "user-check",
      title: "Après les études",
      titleKey: "insertion.journey.step1.title",
      body: "Inscris-toi comme demandeur d'emploi auprès du service régional compétent : Actiris, Forem, VDAB ou ADG.",
      bodyKey: "insertion.journey.step1.body",
    },
    {
      order: 2,
      icon: "calendar",
      title: "Pendant 156 jours",
      titleKey: "insertion.journey.step2.title",
      body: "Le stage d'insertion démarre : cherche activement du travail et garde tes preuves. Tu es suivi par le service régional de l'emploi.",
      bodyKey: "insertion.journey.step2.body",
    },
    {
      order: 3,
      icon: "file-check",
      title: "À la fin du stage",
      titleKey: "insertion.journey.step3.title",
      body: "Confirme ton inscription comme demandeur d'emploi et introduis ta demande d'allocations d'insertion.",
      bodyKey: "insertion.journey.step3.body",
    },
    {
      order: 4,
      icon: "wallet",
      title: "Après l'acceptation",
      titleKey: "insertion.journey.step4.title",
      body: "Le paiement passe par ton organisme de paiement (CAPAC ou syndicat) et tu remplis chaque mois ta carte de contrôle.",
      bodyKey: "insertion.journey.step4.body",
    },
  ],

  theory: THEORY,
};
