import { describe, expect, it } from "vitest";
import { areGatingQuestionsAnswered, isGeneratingBlocked, resolveCompletedSlugs } from "../generate-lock";
import type { DossierDefinition, DossierQuestion } from "@/lib/dossiers/types";

const dossier: DossierDefinition = {
  slug: "test-dossier",
  title: "Test",
  description: "",
  category: "emploi",
  icon: "🎓",
  color: "#000",
  vocabularyTags: [],
  types: [],
  questions: [
    {
      id: "parcoursEtudes",
      label: { fr: "Parcours" },
      type: "select",
      options: [
        { value: "secondaire-belge", label: { fr: "Secondaire" } },
        { value: "superieur-belge", label: { fr: "Supérieur" } },
      ],
    },
  ],
  warnings: [],
  documents: [
    { slug: "demande", title: "Demande", issuer: "ONEM", required: true, gatedByRestOfDossier: true, fields: [] },
    { slug: "c1", title: "C1", issuer: "ONEM", required: true, fields: [] },
    {
      slug: "diplome",
      title: "Diplôme",
      issuer: "École",
      required: true,
      includeWhen: (a) => a.parcoursEtudes === "secondaire-belge",
      fields: [],
    },
  ],
};

describe("isGeneratingBlocked", () => {
  it("bloque DEMANDE si les questions d'aiguillage n'ont pas de réponse", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: {},
      completedSlugs: ["c1"],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(true);
  });

  it("bloque DEMANDE si le document de branche applicable n'est pas complété", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: { parcoursEtudes: "secondaire-belge" },
      completedSlugs: ["c1"], // diplome manquant
      triggeredSlugs: [],
    });
    expect(blocked).toBe(true);
  });

  it("bloque DEMANDE si un document déclenché n'est pas complété", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: { parcoursEtudes: "superieur-belge" },
      completedSlugs: ["c1"],
      triggeredSlugs: ["c1a"],
    });
    expect(blocked).toBe(true);
  });

  it("ne bloque pas DEMANDE quand tout l'applicable est complété", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "demande",
      answers: { parcoursEtudes: "superieur-belge" },
      completedSlugs: ["c1"],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(false);
  });

  it("ne bloque jamais un document non gated (ex. C1 lui-même)", () => {
    const blocked = isGeneratingBlocked({
      dossier,
      targetSlug: "c1",
      answers: {},
      completedSlugs: [],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(false);
  });

  it("ne bloque rien quand le dossier n'a pas de document gated", () => {
    const noGate: DossierDefinition = { ...dossier, documents: dossier.documents.map((d) => ({ ...d, gatedByRestOfDossier: false })) };
    const blocked = isGeneratingBlocked({
      dossier: noGate,
      targetSlug: "demande",
      answers: {},
      completedSlugs: [],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(false);
  });
});

// -----------------------------------------------------------------------
// resolveCompletedSlugs — Finding 1 (revue finale) : la route générait
// `completedSlugs` uniquement depuis les items RÉELS du bundle, ce qui ne
// résout jamais l'id d'un formulaire compagnon déclenché (c1-regis, c1a…) —
// celui-ci n'est JAMAIS un `DocumentBundleItem` en base (cf.
// lib/dossiers/seed.ts). Résultat : un compagnon complété n'était jamais vu
// comme complété → le verrou restait bloqué pour toujours. Cf. spec Finding 1.
// -----------------------------------------------------------------------
describe("resolveCompletedSlugs", () => {
  it("résout les slugs depuis les items réels du bundle seuls", () => {
    const slugs = resolveCompletedSlugs(
      [
        { pdfFormId: "id-demande", pdfFormSlug: "demande" },
        { pdfFormId: "id-c1", pdfFormSlug: "c1" },
      ],
      [],
      ["id-c1"],
    );
    expect(slugs).toEqual(["c1"]);
  });

  it("résout AUSSI les slugs depuis les formulaires compagnons déclenchés, absents des items du bundle (coeur du fix)", () => {
    // "companion form that is NOT a bundle item" : c1a est un PdfForm
    // autonome déclenché par une réponse du C1, jamais un DocumentBundleItem.
    const bundleItems = [
      { pdfFormId: "id-demande", pdfFormSlug: "demande" },
      { pdfFormId: "id-c1", pdfFormSlug: "c1" },
    ];
    const triggeredCompanionForms = [
      { pdfFormId: "id-c1a", pdfFormSlug: "c1a" },
    ];
    const slugs = resolveCompletedSlugs(bundleItems, triggeredCompanionForms, ["id-c1a"]);
    expect(slugs).toEqual(["c1a"]);
  });

  it("ignore un id complété qui ne correspond ni à un item du bundle ni à un formulaire déclenché", () => {
    const slugs = resolveCompletedSlugs(
      [{ pdfFormId: "id-demande", pdfFormSlug: "demande" }],
      [{ pdfFormId: "id-c1a", pdfFormSlug: "c1a" }],
      ["id-inconnu"],
    );
    expect(slugs).toEqual([]);
  });

  it("RÉGRESSION : un compagnon déclenché ET complété débloque isGeneratingBlocked une fois le reste du dossier fait (bug pré-fix : restait bloqué pour toujours)", () => {
    // Dossier où C1 déclenche un compagnon "c1a" — jamais un item du bundle
    // (ni dans dossier.documents, ni un DocumentBundleItem réel), tout comme
    // dans la production (cf. seedDossier() qui ne crée des items que pour
    // les documents PROPRES du dossier).
    const bundleItems = [
      { pdfFormId: "id-demande", pdfFormSlug: "demande" },
      { pdfFormId: "id-c1", pdfFormSlug: "c1" },
    ];
    // c1a n'existe QUE comme formulaire compagnon déclenché — pas dans
    // bundleItems, pas dans dossier.documents (matérialisé à la volée par
    // collectAllTriggeredSlugs côté page.tsx/route.ts).
    const triggeredCompanionForms = [{ pdfFormId: "id-c1a", pdfFormSlug: "c1a" }];
    const completedTemplateIds = ["id-c1", "id-c1a"]; // C1 + son compagnon complétés

    const completedSlugs = resolveCompletedSlugs(bundleItems, triggeredCompanionForms, completedTemplateIds);

    const blocked = isGeneratingBlocked({
      dossier, // parcoursEtudes répondu + diplôme requis pour cette branche
      targetSlug: "demande",
      answers: { parcoursEtudes: "superieur-belge" }, // ne requiert pas "diplome"
      completedSlugs,
      triggeredSlugs: ["c1a"], // c1a est bien exigé par le verrou
    });

    expect(blocked).toBe(false);
  });
});

// -----------------------------------------------------------------------
// areGatingQuestionsAnswered — Finding 2 (revue finale) : le verrou exigeait
// une réponse à TOUTES les questions du dossier avant de daigner considérer
// un déblocage, alors que seule `parcoursEtudes` branche un document
// remplissable réel (DIPLÔME/ÉTRANGER) — `age`/`aTravaille` ne branchent que
// des documents à charge d'un tiers, jamais remplissables, et donc déjà
// exclus de `requiredOtherSlugs`. Exiger leur réponse contredit le principe
// « informatif, jamais bloquant ». Cf. spec Finding 2.
// -----------------------------------------------------------------------
const gatingQuestion: DossierQuestion = {
  id: "parcoursEtudes",
  label: { fr: "Parcours" },
  type: "select",
  options: [{ value: "secondaire-belge", label: { fr: "Secondaire" } }],
  gatesDocuments: true,
};
const nonGatingQuestion1: DossierQuestion = {
  id: "age",
  label: { fr: "Âge" },
  type: "select",
  options: [{ value: "moins-18", label: { fr: "Moins de 18 ans" } }],
};
const nonGatingQuestion2: DossierQuestion = {
  id: "aTravaille",
  label: { fr: "A travaillé" },
  type: "boolean",
};

describe("areGatingQuestionsAnswered", () => {
  it("quand aucune question n'a gatesDocuments, se comporte comme aujourd'hui (toutes requises)", () => {
    const noFlag: DossierQuestion[] = [
      { ...gatingQuestion, gatesDocuments: undefined },
      nonGatingQuestion1,
    ];
    expect(areGatingQuestionsAnswered(noFlag, {})).toBe(false);
    expect(areGatingQuestionsAnswered(noFlag, { parcoursEtudes: "secondaire-belge" })).toBe(false); // age manquant
    expect(
      areGatingQuestionsAnswered(noFlag, { parcoursEtudes: "secondaire-belge", age: "moins-18" }),
    ).toBe(true);
  });

  it("quand une seule question a gatesDocuments: true, seule celle-ci doit être répondue — les autres peuvent rester vides", () => {
    const mixed: DossierQuestion[] = [gatingQuestion, nonGatingQuestion1, nonGatingQuestion2];
    // parcoursEtudes seul répondu, age/aTravaille non répondus → suffisant.
    expect(areGatingQuestionsAnswered(mixed, { parcoursEtudes: "secondaire-belge" })).toBe(true);
    // parcoursEtudes non répondu → bloque, même si age/aTravaille le sont.
    expect(
      areGatingQuestionsAnswered(mixed, { age: "moins-18", aTravaille: "true" }),
    ).toBe(false);
  });
});

describe("isGeneratingBlocked — ne requiert plus les questions equivalentes à age/aTravaille (Finding 2)", () => {
  // Dossier miroir de allocations-insertion : parcoursEtudes gate un document
  // remplissable réel (diplome) ; age/aTravaille ne gate qu'un document à
  // charge d'un tiers (responsibility ≠ "user"), déjà hors de
  // requiredOtherSlugs — ils ne devraient donc jamais être requis pour
  // débloquer DEMANDE.
  const mirrorDossier: DossierDefinition = {
    ...dossier,
    questions: [
      { ...gatingQuestion, gatesDocuments: true },
      nonGatingQuestion1,
      nonGatingQuestion2,
    ],
    documents: [
      ...dossier.documents,
      {
        slug: "condition21ans",
        title: "Condition 21 ans",
        issuer: "École",
        required: true,
        responsibility: "external", // tiers → jamais dans requiredOtherSlugs
        includeWhen: (a) => a.age === "moins-18",
        fields: [],
      },
    ],
  };

  it("ne bloque plus DEMANDE quand seule parcoursEtudes est répondue (age/aTravaille laissées vides)", () => {
    const blocked = isGeneratingBlocked({
      dossier: mirrorDossier,
      targetSlug: "demande",
      answers: { parcoursEtudes: "superieur-belge" }, // age/aTravaille non répondues
      completedSlugs: ["c1"],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(false);
  });

  it("bloque toujours DEMANDE si parcoursEtudes (la question qui gate) n'a pas de réponse", () => {
    const blocked = isGeneratingBlocked({
      dossier: mirrorDossier,
      targetSlug: "demande",
      answers: { age: "moins-18", aTravaille: "true" }, // parcoursEtudes manquante
      completedSlugs: ["c1"],
      triggeredSlugs: [],
    });
    expect(blocked).toBe(true);
  });
});
