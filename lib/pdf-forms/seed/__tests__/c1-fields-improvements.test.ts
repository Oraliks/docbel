import { describe, expect, it } from "vitest";
import { C1_QUESTIONS, C1_TRIGGERS, applyC1Improvements } from "../c1-fields-improvements";
import { evaluateTrigger } from "../../triggers";

describe("C1_QUESTIONS — habiteEnColocation", () => {
  it("existe, est de type boolean-like (radio oui/non), et n'est visible que si cohabite", () => {
    const q = C1_QUESTIONS.find((f) => f.id === "habiteEnColocation");
    expect(q).toBeDefined();
    expect(q?.type).toBe("radio");
    expect(q?.visibleIf).toEqual({ fieldId: "statutFamilial", op: "equals", value: "cohabite" });
  });
});

describe("C1_TRIGGERS — colocation → Annexe Regis", () => {
  it("déclenche c1-regis quand habiteEnColocation = oui", () => {
    const t = C1_TRIGGERS.find(
      (trig) => trig.whenFieldId === "habiteEnColocation" && trig.requiresFormSlug === "c1-regis",
    );
    expect(t).toBeDefined();
    expect(evaluateTrigger(t!, { habiteEnColocation: "oui" })).toBe(true);
    expect(evaluateTrigger(t!, { habiteEnColocation: "non" })).toBe(false);
  });

  it("le trigger existant 'situationCohabitationAmbigue' reste inchangé (autres cas ambigus)", () => {
    const t = C1_TRIGGERS.find((trig) => trig.whenFieldId === "situationCohabitationAmbigue");
    expect(t).toBeDefined();
    expect(t?.requiresFormSlug).toBe("c1-regis");
  });

  it("les 9 déclencheurs pré-existants sont toujours présents (aucun retiré)", () => {
    expect(C1_TRIGGERS.length).toBeGreaterThanOrEqual(10); // 9 existants + 1 nouveau
    const targets = C1_TRIGGERS.map((t) => t.requiresFormSlug);
    for (const slug of ["c1-partenaire", "c47", "c1-regis", "c46", "c1c", "c1a", "c1b"]) {
      expect(targets).toContain(slug);
    }
  });
});

describe("C1_QUESTIONS — dateModificationEffective", () => {
  it("existe, type date, visible seulement si motifIntroduction = modification", () => {
    const f = C1_QUESTIONS.find((q) => q.id === "dateModificationEffective");
    expect(f).toBeDefined();
    expect(f?.type).toBe("date");
    expect(f?.required).toBe(false);
    expect(f?.visibleIf).toEqual({ fieldId: "motifIntroduction", op: "equals", value: "modification" });
  });
});

describe("C1_QUESTIONS — dateChangementOrganisme aide enrichie", () => {
  it("mentionne que le délai dépend du type d'allocation en cours", () => {
    const f = C1_QUESTIONS.find((q) => q.id === "dateChangementOrganisme");
    expect(f?.help?.fr).toContain("type d'allocation");
  });
});

describe("applyC1Improvements — defaultMotif optionnel", () => {
  it("sans options, motifIntroduction n'a pas de defaultValue (comportement actuel inchangé)", () => {
    const result = applyC1Improvements([]);
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif).toBeDefined();
    expect(motif?.defaultValue).toBeUndefined();
  });

  it("avec defaultMotif, motifIntroduction porte la defaultValue fournie", () => {
    const result = applyC1Improvements([], { defaultMotif: "modification" });
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif?.defaultValue).toBe("modification");
  });

  it("C1_QUESTIONS partagé reste non muté après un appel avec defaultMotif", () => {
    applyC1Improvements([], { defaultMotif: "modification" });
    const motif = C1_QUESTIONS.find((f) => f.id === "motifIntroduction");
    expect(motif?.defaultValue).toBeUndefined();
  });
});

describe("C1_QUESTIONS — habillage renderAs / stepPriority", () => {
  it("motifIntroduction et les champs de modification sont renderAs=chip", () => {
    const chipIds = ["motifIntroduction", "modificationAdresse", "modificationCompte", "modificationSituationFamiliale", "modificationPermisSejour", "modificationCotisationSyndicale"];
    for (const id of chipIds) {
      const f = C1_QUESTIONS.find((q) => q.id === id);
      expect(f, `champ ${id} introuvable`).toBeDefined();
      expect(f?.renderAs, `champ ${id} devrait être renderAs=chip`).toBe("chip");
    }
  });

  it("toutes les sections activités/revenus/cotisation/non-UE/divers/annexes sont stepPriority=optional", () => {
    const optionalSectionKeys = ["mes-activites", "mes-revenus", "cotisation-syndicale", "non-eee", "divers", "annexes"];
    for (const key of optionalSectionKeys) {
      const fieldsInSection = C1_QUESTIONS.filter((q) => q.section === key);
      expect(fieldsInSection.length, `aucun champ trouvé pour la section ${key}`).toBeGreaterThan(0);
      for (const f of fieldsInSection) {
        expect(f.stepPriority, `champ ${f.id} (section ${key}) devrait être stepPriority=optional`).toBe("optional");
      }
    }
  });

  it("identite/demande/situation-familiale/mode-paiement/affirmations/signature restent stepPriority core (absent)", () => {
    const coreSectionKeys = ["identite", "demande", "situation-familiale", "mode-paiement", "affirmations", "signature"];
    for (const key of coreSectionKeys) {
      const fieldsInSection = C1_QUESTIONS.filter((q) => q.section === key);
      expect(fieldsInSection.length, `aucun champ trouvé pour la section ${key}`).toBeGreaterThan(0);
      for (const f of fieldsInSection) {
        expect(f.stepPriority, `champ ${f.id} (section ${key}) ne devrait PAS être optional`).not.toBe("optional");
      }
    }
  });

  it("chaque champ ayant un renderAs=chip conserve son pdfFieldName/visibleIf/section/order d'origine", () => {
    const expectations: Record<string, { pdfFieldName: string; section: string; order: number; visibleIf?: unknown }> = {
      motifIntroduction: {
        pdfFieldName:
          "pour la première fois 5|après une interruption de mes allocations 5|je déclare une modification concernant|je change dorganisme de paiement à partir du 5",
        section: "demande",
        order: 3,
      },
      modificationAdresse: {
        pdfFieldName: "mon adresse à partir du",
        section: "demande",
        order: 5,
        visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
      },
      modificationCompte: {
        pdfFieldName: "le mode de paiement de mes allocations ou mon numéro de compte6",
        section: "demande",
        order: 6,
        visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
      },
      modificationSituationFamiliale: {
        pdfFieldName: "ma situation personnelle ou celle des membres de mon ménage 7",
        section: "demande",
        order: 7,
        visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
      },
      modificationPermisSejour: {
        pdfFieldName: "mon permis de séjour ou mon permis de travail",
        section: "demande",
        order: 8,
        visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
      },
      modificationCotisationSyndicale: {
        pdfFieldName: "la retenue des cotisations syndicales",
        section: "demande",
        order: 9,
        visibleIf: { fieldId: "motifIntroduction", op: "equals", value: "modification" },
      },
    };
    for (const [id, expected] of Object.entries(expectations)) {
      const f = C1_QUESTIONS.find((q) => q.id === id);
      expect(f, `champ ${id} introuvable`).toBeDefined();
      expect(f?.pdfFieldName, `pdfFieldName de ${id} ne doit pas changer`).toBe(expected.pdfFieldName);
      expect(f?.section, `section de ${id} ne doit pas changer`).toBe(expected.section);
      expect(f?.order, `order de ${id} ne doit pas changer`).toBe(expected.order);
      if (expected.visibleIf) {
        expect(f?.visibleIf, `visibleIf de ${id} ne doit pas changer`).toEqual(expected.visibleIf);
      }
    }
  });
});
