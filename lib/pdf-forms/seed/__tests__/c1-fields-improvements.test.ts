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

describe("applyC1Improvements — restrictMotifTo5Situations (Oraliks, 2026-07-06)", () => {
  it("absent (par défaut) : comportement inchangé, pas de 5e chip, cotisation syndicale toujours visible", () => {
    const result = applyC1Improvements([]);
    expect(result.find((f) => f.id === "transfereOrganismePaiement")).toBeUndefined();
    const cotisation = result.find((f) => f.id === "modificationCotisationSyndicale");
    expect(cotisation?.hidden).toBeFalsy();
    const adresse = result.find((f) => f.id === "modificationAdresse");
    expect(adresse?.label?.fr).toBe("Modification d'adresse");
  });

  it("actif : motifIntroduction garde ses 4 options ET son pdfFieldName pipe d'origine intacts", () => {
    // Invariant critique : le filler mappe options[i] <-> pdfFieldName.split('|')[i]
    // positionnellement (cf. filler-checkbox-pair.test.ts). Toucher ici casserait
    // le stamping PDF pour "première fois"/"interruption"/"modification"/"changement-op".
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif?.options).toHaveLength(4);
    expect(motif?.pdfFieldName).toBe(
      "pour la première fois 5|après une interruption de mes allocations 5|je déclare une modification concernant|je change dorganisme de paiement à partir du 5"
    );
  });

  it("actif : motifIntroduction devient autoAnswered (exclu du rendu interactif, reste requis/soumis)", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif?.autoAnswered).toBe(true);
    expect(motif?.required).toBe(true); // reste requis : le filler/validator le voient toujours
    expect(motif?.defaultValue).toBeUndefined(); // note: defaultMotif est un opt séparé, testé ailleurs
  });

  it("absent : motifIntroduction n'est PAS autoAnswered (comportement c1/c1-insertion inchangé)", () => {
    const result = applyC1Improvements([]);
    const motif = result.find((f) => f.id === "motifIntroduction");
    expect(motif?.autoAnswered).toBeFalsy();
  });

  it("actif : ajoute le 5e chip virtuel transfereOrganismePaiement (aucune case PDF propre)", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const f = result.find((q) => q.id === "transfereOrganismePaiement");
    expect(f).toBeDefined();
    expect(f?.pdfFieldName).toBe("");
    expect(f?.type).toBe("checkbox");
    expect(f?.required).toBe(false);
    expect(f?.renderAs).toBe("chip");
    expect(f?.section).toBe("demande");
    expect(f?.label?.fr).toBe("Je transfère mon dossier vers un autre organisme de paiement");
  });

  it("actif : masque modificationCotisationSyndicale (hors périmètre de ce dossier)", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const f = result.find((q) => q.id === "modificationCotisationSyndicale");
    expect(f?.hidden).toBe(true);
  });

  it("actif : relabelle et réordonne les 4 chips de modification restants selon le phrasé Oraliks", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const expected: Record<string, { label: string; order: number }> = {
      modificationAdresse: { label: "J'ai changé d'adresse", order: 5 },
      modificationSituationFamiliale: {
        label: "Ma situation personnelle ou celle des membres de mon ménage a changé",
        order: 6,
      },
      modificationPermisSejour: { label: "Mon permis de séjour ou mon permis de travail a changé", order: 7 },
      modificationCompte: { label: "Mon n° de compte bancaire a changé", order: 8 },
    };
    for (const [id, exp] of Object.entries(expected)) {
      const f = result.find((q) => q.id === id);
      expect(f?.label?.fr, `label de ${id}`).toBe(exp.label);
      expect(f?.order, `order de ${id}`).toBe(exp.order);
    }
  });

  it("actif : dateChangementOrganisme se déclenche sur transfereOrganismePaiement, plus sur motifIntroduction", () => {
    const result = applyC1Improvements([], { restrictMotifTo5Situations: true });
    const f = result.find((q) => q.id === "dateChangementOrganisme");
    expect(f?.visibleIf).toEqual({ fieldId: "transfereOrganismePaiement", op: "equals", value: true });
  });

  it("actif : C1_QUESTIONS partagé reste non muté (labels/visibleIf/hidden d'origine intacts)", () => {
    applyC1Improvements([], { restrictMotifTo5Situations: true });
    const adresse = C1_QUESTIONS.find((q) => q.id === "modificationAdresse");
    expect(adresse?.label?.fr).toBe("Modification d'adresse");
    expect(adresse?.order).toBe(5);
    const cotisation = C1_QUESTIONS.find((q) => q.id === "modificationCotisationSyndicale");
    expect(cotisation?.hidden).toBeFalsy();
    const dateChangement = C1_QUESTIONS.find((q) => q.id === "dateChangementOrganisme");
    expect(dateChangement?.visibleIf).toEqual({ fieldId: "motifIntroduction", op: "equals", value: "changement-op" });
    expect(C1_QUESTIONS.find((q) => q.id === "transfereOrganismePaiement")).toBeUndefined();
  });
});
