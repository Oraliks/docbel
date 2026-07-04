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
import { getInsertionParams, mensuelBrut } from "@/lib/chomage/params";

// -------------------------------------------------------------------
// Montants — composés depuis la SOURCE UNIQUE lib/chomage/params.ts
// (jamais de chiffres en dur dans le contenu : une indexation = un nouveau
// jeu daté là-bas, ce bloc suit automatiquement).
// Pas de messageKey : le texte contient des montants dynamiques ; le warning
// s'affiche en FR (fallback) dans toutes les langues tant que les warnings
// ne supportent pas l'interpolation ICU. À traiter avec la vague i18n.
// -------------------------------------------------------------------
const INSERTION = getInsertionParams();
const EUR = new Intl.NumberFormat("fr-BE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const [jj, mm, aaaa] = INSERTION.validFrom.split("-").reverse();
const M = INSERTION.values.montantsJour;
const MONTANTS_MESSAGE =
  `Montants bruts au ${jj}/${mm}/${aaaa} (par mois) : avec charge de famille ` +
  `${EUR.format(mensuelBrut(M.chargeFamille))} € · isolé 21 ans ou plus ` +
  `${EUR.format(mensuelBrut(M.isole.aPartirDe21))} € · cohabitant ` +
  `${EUR.format(mensuelBrut(M.cohabitant.aPartirDe18))} € (privilégié ` +
  `${EUR.format(mensuelBrut(M.cohabitantPrivilegie.aPartirDe18))} €). ` +
  `Avant 21 ans, les montants sont réduits. Seul ton organisme de paiement ` +
  `confirme ton montant exact.`;

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

  // Chaîne le wizard d'orientation → pré-qualification : seules les
  // correspondances SÛRES sont mappées (pré-sélection éditable, jamais
  // bloquant). « moins-25 » du wizard n'est PAS mappé : plus grossier que
  // nos tranches d'âge (moins-18 / 18-20 / 21-24).
  prefillFromOrientation: (o) => {
    const out: Record<string, string> = {};
    if (o.situation === "jeune-etudes" && o.subOption === "25-plus") {
      out.age = "25-plus";
    }
    // « Je sors des études, j'ai peu ou pas travaillé » (perte-emploi) :
    // les études sont terminées ou arrêtées.
    if (o.subOption === "sors-etudes") out.aTermineEtudes = "true";
    return out;
  },

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

    // ------- Parcours d'études (branche la preuve d'études à joindre) -------
    {
      id: "parcoursEtudes",
      label: { fr: "Quel est ton parcours d'études ?" },
      helpText: {
        fr: "Cela détermine la preuve d'études à joindre : un formulaire rempli par ton école (secondaire/formation), une copie de ton diplôme (bachelier/master belge), ou un formulaire spécifique si tu as étudié à l'étranger.",
      },
      type: "select",
      options: [
        { value: "secondaire-belge", label: { fr: "Études secondaires ou de formation en Belgique" } },
        { value: "superieur-belge", label: { fr: "Bachelier ou master belge (enseignement supérieur)" } },
        { value: "etranger", label: { fr: "Études à l'étranger" } },
        { value: "autre", label: { fr: "Aucune de ces situations" } },
      ],
    },

    // ------- Travail (le C4 permet de réduire la durée du SIP) -------
    {
      id: "aTravaille",
      label: { fr: "As-tu déjà travaillé comme salarié ?" },
      helpText: {
        fr: "Si tu as travaillé, le C4 remis par ton employeur peut réduire la durée de ton stage d'insertion. Réponds « oui » même pour un job étudiant ou un contrat court.",
      },
      type: "boolean",
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
    {
      // Montants issus de lib/chomage/params.ts (source unique, datée,
      // vérifiée contre le barème publié par le test de parité).
      title: "Montants actuels (bruts)",
      titleKey: "insertion.warning.montants.title",
      message: MONTANTS_MESSAGE,
      severity: "info",
    },
    {
      // Advisory toujours visible : l'alternance n'ajoute pas de document mais
      // change le parcours (SIP raccourci/supprimé). On ne pose donc pas de
      // question dédiée — on informe (principe « informatif, jamais bloquant »).
      title: "Formation en alternance : contacte vite un organisme",
      titleKey: "insertion.warning.alternance.title",
      message:
        "Si tu as réussi une formation en alternance, ton stage d'insertion peut être raccourci — voire supprimé — et tes évaluations en sont affectées. Prends contact avec un organisme de paiement (CAPAC, CSC, FGTB ou SYNOVA) dès maintenant.",
      messageKey: "insertion.warning.alternance.message",
      severity: "info",
    },
  ],

  // ===================================================================
  // ARBRE DE DOCUMENTS (dicté par Oraliks 2026-07-05).
  // Deux couches :
  //   • REMPLISSABLES dans beldoc (responsibility user + sourcePdfPath +
  //     fields) : C109/36-DEMANDE (PDF officiel Oraliks) et C1. Elles
  //     deviennent des PdfForms au seed. ⚠️ Activation prod = Vercel Blob +
  //     seed (sans Blob, le PDF stocké pointe vers le disque local → cassé en
  //     prod ; cf. lib/pdf-forms/storage.ts).
  //   • À FOURNIR PAR UN TIERS (responsibility external/employer, fields vides)
  //     : école, ACTIRIS/Forem/VDAB/ADG, employeur. Affichées en checklist
  //     conditionnelle sans PDF requis (code-driven, pas de seed).
  // Cf. [[project-insertion-document-tree]].
  //
  // Conditions basées sur les réponses (stockées en chaînes) :
  //   parcoursEtudes ∈ secondaire-belge | superieur-belge | etranger | autre
  //   age ∈ moins-18 | 18-20 | 21-24 | 25-plus
  //   aTravaille ∈ "true" | "false"
  // Réforme 01/03/2026 : CERTIFICAT → remplacé par DIPLÔME ; ANNEXE →
  // remplacé par ÉTRANGER. CONDITION21ANS conservé (À VALIDER Oraliks).
  // ===================================================================
  documents: [
    // ---------- Toujours dans le dossier ----------
    {
      slug: "c109-36-demande",
      title: "C109/36-DEMANDE — Demande d'allocations d'insertion",
      titleKey: "insertion.doc.c109Demande.title",
      issuer: "ONEM",
      required: true,
      // Formulaire OBLIGATOIRE, préremplissable dans beldoc (responsibility
      // user par défaut). PDF officiel AcroForm fourni par Oraliks (44 widgets).
      // On mappe l'identité + la signature ci-dessous ; les déclarations de
      // situation pendant le SIP et les cases « pièces jointes » sont
      // auto-inférées par l'ingest (l'admin peut les enrichir).
      // Bases légales : art. 36 et 36quater AR 25.11.1991.
      sourcePdfPath: "private/pdfs/C109-36_Demande_FR.pdf",
      internalRef:
        "C109/36-DEMANDE — obligatoire. PDF officiel Oraliks 2026-07-05. Activation prod = Vercel Blob + seed (sans Blob, le PDF stocké pointe vers le disque local → cassé en prod). Cf. [[project-insertion-document-tree]].",
      fields: [
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
        { field: "fullName", required: true, section: "identite", pdfFieldName: "NomPrenom" },
        // Date de signature = jour de génération (system.today), champ "DateSignature".
        { field: "creationDate", section: "signature", pdfFieldName: "DateSignature" },
        { field: "signature", section: "signature", pdfFieldName: "Signature" },
      ],
    },
    {
      // C1 — déclaration de situation personnelle (PDF présent : C1_FR.pdf).
      // Slug distinct des autres C1 (unicité globale de PdfForm.slug).
      slug: "c1-insertion",
      title: "C1 — Déclaration de situation personnelle",
      titleKey: "insertion.doc.c1.title",
      issuer: "ONEM",
      required: true,
      sourcePdfPath: "private/pdfs/C1_FR.pdf",
      internalRef:
        "Déclaration personnelle. Préremplissable (PDF présent). Activation prod = Blob + seed (comme la demande).",
      fields: [
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
      ],
    },
    {
      slug: "attestation-inscription-a15",
      title: "Attestation d'inscription comme demandeur d'emploi (A15 – historique)",
      titleKey: "insertion.doc.a15.title",
      issuer: "ACTIRIS / Forem / VDAB / ADG",
      required: true,
      responsibility: "external",
      responsibilityNote: {
        fr: "À demander à ton service régional de l'emploi : ACTIRIS (Bruxelles), Forem (Wallonie), VDAB (Flandre) ou ADG (Communauté germanophone). Toujours à joindre à ta demande.",
      },
      internalRef: "A15 historique — attestation d'inscription. Toujours requise.",
      fields: [],
    },
    {
      slug: "evaluations-positives-sip",
      title: "Les 2 évaluations positives du stage d'insertion",
      titleKey: "insertion.doc.evaluations.title",
      issuer: "ACTIRIS / Forem / VDAB / ADG",
      required: true,
      responsibility: "external",
      responsibilityNote: {
        fr: "Deux évaluations positives de ton comportement de recherche d'emploi, délivrées par ton service régional pendant le stage d'insertion.",
      },
      internalRef: "2 évaluations positives pendant le SIP. Toujours requises.",
      fields: [],
    },

    // ---------- Preuve d'études — une branche selon `parcoursEtudes` ----------
    // NB : le C109/36-CERTIFICAT n'est plus valable depuis le 01/03/2026 —
    // remplacé par le C109/36-DIPLÔME (info Oraliks 2026-07-05).
    {
      slug: "c109-36-diplome",
      title: "C109/36-DIPLÔME — Preuve de diplôme, certificat ou attestation",
      titleKey: "insertion.doc.c109Diplome.title",
      issuer: "Établissement d'enseignement",
      required: true,
      responsibility: "external",
      responsibilityNote: {
        fr: "À faire remplir par ton école secondaire ou de formation. Prouve que tu possèdes le diplôme, certificat ou attestation requis.",
      },
      includeWhen: (a) => a.parcoursEtudes === "secondaire-belge",
      internalRef:
        "C109/36-DIPLÔME (art. 36) — remplace le CERTIFICAT depuis le 01/03/2026 (Oraliks). Formulaire école secondaire/formation.",
      fields: [],
    },
    {
      slug: "copie-diplome-superieur",
      title: "Copie de ton bachelier ou master belge",
      titleKey: "insertion.doc.copieDiplomeSuperieur.title",
      issuer: "Toi",
      required: true,
      responsibility: "external",
      responsibilityNote: {
        fr: "Dispense de formulaire d'école : joins une copie de ton diplôme belge (bachelier/master). Valable s'il a été précédé de 6 ans d'études en Belgique, OU si tu as travaillé ≥ 78 jours comme salarié, OU été indépendant à titre principal ≥ 3 mois.",
      },
      includeWhen: (a) => a.parcoursEtudes === "superieur-belge",
      internalRef:
        "Dispense bachelier/master belge (conditions art. 36). À VALIDER Oraliks (les conditions peuvent renvoyer vers DEMANDE ou ÉTRANGER).",
      fields: [],
    },
    {
      // Le C109/36-ÉTRANGER remplace le C109/36-ANNEXE (info Oraliks
      // 2026-07-05) : il couvre les études à l'étranger ET le cas résiduel
      // (aucune situation belge standard).
      slug: "c109-36-etranger",
      title: "C109/36-ÉTRANGER — Déclaration d'études à l'étranger",
      titleKey: "insertion.doc.c109Etranger.title",
      issuer: "Toi + preuves",
      required: true,
      responsibility: "external",
      responsibilityNote: {
        fr: "À compléter si tu as étudié à l'étranger (avec les attestations ou preuves de ton diplôme), ou si ta situation ne correspond à aucun des autres cas. Vérifie si ton diplôme ouvre le droit.",
      },
      includeWhen: (a) =>
        a.parcoursEtudes === "etranger" || a.parcoursEtudes === "autre",
      internalRef:
        "C109/36-ÉTRANGER (art. 36) — remplace l'ANNEXE depuis le 01/03/2026 (Oraliks). Couvre 'études à l'étranger' + cas résiduel 'autre'.",
      fields: [],
    },

    // ---------- Conditionnels ----------
    {
      slug: "c109-36-condition21ans",
      title: "C109/36-CONDITION21ANS — Preuve du diplôme (moins de 21 ans)",
      titleKey: "insertion.doc.c109Condition21.title",
      issuer: "Établissement / Communauté",
      required: true,
      responsibility: "external",
      responsibilityNote: {
        fr: "Si tu as moins de 21 ans : formulaire prouvant le diplôme ou certificat obtenu, dans la version de ta Communauté (F, N ou D). Une dispense est parfois possible.",
      },
      includeWhen: (a) => a.age === "moins-18" || a.age === "18-20",
      internalRef:
        "C109/36-CONDITION21ANS (F/N/D). Exigé < 21 ans. Dispenses à préciser (À VALIDER Oraliks).",
      fields: [],
    },
    {
      slug: "c4-reduction-sip",
      title: "C4 — Certificat de chômage (si tu as travaillé)",
      titleKey: "insertion.doc.c4.title",
      issuer: "Ton employeur",
      required: false,
      responsibility: "employer",
      responsibilityNote: {
        fr: "Si tu as travaillé : réclame le C4 à ton (ancien) employeur. Il peut réduire la durée de ton stage d'insertion.",
      },
      includeWhen: (a) => a.aTravaille === "true",
      internalRef: "C4 employeur — réduit le SIP. Conditionnel (a travaillé).",
      fields: [],
    },
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
