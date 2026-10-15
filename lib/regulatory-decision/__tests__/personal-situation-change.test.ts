import { describe, expect, it } from "vitest";
import {
  deriveArticle110FactsFromC1,
  deriveHouseholdCompositionFromC1,
  derivePersonalSituationTrace,
  deriveFamilyFactsFromC1,
  withPersonalSituationTrace,
} from "../personal-situation-change";
import { decidePersonalSituation } from "../personal-situation";
import { evaluateArticle110Verifier } from "../article-110-verifier";

describe("personal situation change trace", () => {
  it("keeps an absent C1 household inventory unknown instead of treating it as an isolated declaration", () => {
    const facts = deriveFamilyFactsFromC1({});

    expect(facts).toMatchObject({ people: [], householdDeclared: true });
  });

  it("does not calculate an isolated category from an unfinished C1 household", () => {
    const decision = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });

    expect(withPersonalSituationTrace(decision, {})?.householdAssessment).toMatchObject({
      expectedCategory: null,
      status: "needs_information",
      factKeys: ["household.people"],
    });
  });

  it("distinguishes an incomplete income inventory from explicit negative C1 answers", () => {
    const partial = deriveFamilyFactsFromC1({
      cohabitants: [{ lien: "epoux", typeRevenuPro: "salarie-employe", montantRevenuPro: 900 }],
    }).people?.[0];
    const empty = deriveFamilyFactsFromC1({
      cohabitants: [{ lien: "epoux", typeRevenuPro: "aucun", revenuRemplacement: "aucun" }],
    }).people?.[0];

    expect(partial).toMatchObject({ incomeInventoryComplete: false });
    expect(partial?.incomes).toEqual([expect.objectContaining({ kind: "professional", amount: 900 })]);
    expect(empty).toMatchObject({ incomeInventoryComplete: true, incomes: [] });
  });

  it("preserves declared professional and replacement incomes without turning document statuses into facts", () => {
    const person = deriveFamilyFactsFromC1({
      cohabitants: [{
        lien: "epoux",
        typeRevenuPro: "salarie-employe",
        montantRevenuPro: 900,
        revenuRemplacement: "pension",
        montantRevenuRemplacement: 500,
        montantPensionNature: "brut",
        preuvePension: "manquante",
        handicapReconnu: "oui",
        preuveHandicap: "non",
        revenuProfessionnelVariable: "oui",
        c110aStatut: "non-recu",
        montantMensuelC110a: 850,
      }],
    }).people?.[0];

    expect(person?.incomes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "professional", amount: 900, monthlyAmount: 850 }),
      expect.objectContaining({ kind: "pension", amount: 500, amountKind: "gross" }),
    ]));
    for (const income of person?.incomes ?? []) {
      expect(income).not.toHaveProperty("c110aReceived");
      expect(income).not.toHaveProperty("pensionProofAvailable");
      expect(income).not.toHaveProperty("disabilityProofAvailable");
    }
  });

  it("keeps C1 person identifiers stable when rows are reordered", () => {
    const rows = [
      { prenom: "Anne", nom: "Martin", dateNaissance: "1980-01-01", lien: "enfant", allocationsFamiliales: "oui", typeRevenuPro: "aucun" },
      { prenom: "Benoît", nom: "Martin", dateNaissance: "2004-01-01", lien: "enfant", allocationsFamiliales: "non", typeRevenuPro: "aucun" },
    ];
    const first = deriveFamilyFactsFromC1({ cohabitants: rows });
    const reordered = deriveFamilyFactsFromC1({ cohabitants: [...rows].reverse() });
    expect(reordered.people.map((person) => person.id).sort()).toEqual(first.people.map((person) => person.id).sort());
  });

  it("does not let C110A availability change a result based on the declared monthly amount", () => {
    const decision = () => decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const payload = (c110aStatut: string) => ({ cohabitants: [{ lien: "epoux", typeRevenuPro: "salarie-employe", montantRevenuPro: 900, typeContratRevenuPro: "cdi", revenuProfessionnelVariable: "oui", c110aStatut, montantMensuelC110a: 900, revenuRemplacement: "aucun" }] });
    const thresholds = { spouseProfessionalMonthly: 1000, childProfessionalMonthly: null, spouseReplacementMonthly: null, childReplacementMonthly: null, source: null };
    expect(withPersonalSituationTrace(decision(), payload("recu"), new Date("2026-10-08T00:00:00Z"), thresholds)?.householdAssessment)
      .toEqual(withPersonalSituationTrace(decision(), payload("non-recu"), new Date("2026-10-08T00:00:00Z"), thresholds)?.householdAssessment);
  });

  it("uses alimony facts, not a judgment-copy status, in the common calculation", () => {
    const decision = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const result = withPersonalSituationTrace(decision, {
      statutFamilial: "isole",
      pensionAlimentaire: "oui",
      pensionAlimentairePaiementEffectif: "oui",
      pensionAlimentaireBaseJuridique: "decision-judiciaire",
      pensionAlimentaireBeneficiaire: "enfant-mineur",
      statutJugementPensionAlimentaire: "pas-encore-recu",
    });
    expect(result?.householdAssessment).toMatchObject({ expectedCategory: "A", sourceRuleIds: ["situation_familiale_isole_pension_alimentaire"] });
    expect(result?.isolatedHouseholdAssessment).toBeUndefined();
  });

  it("maps the C1 alternating-care average and cycle into the shared family facts", () => {
    const facts = deriveFamilyFactsFromC1({
      statutFamilial: "isole",
      hebergementAlterneEnfant: "oui",
      hebergementAlterneJoursMoyensSemaine: 2,
      hebergementAlterneCycle: "trimestriel",
      hebergementAlterneAllocationsFamiliales: "non",
      hebergementAlterneEnfantRevenuPertinent: "non",
      hebergementAlternePieceStatut: "en-cours",
    });
    expect(facts.isolated?.alternatingCare).toEqual({
      averageDaysPerWeek: 2,
      cycle: "quarterly",
      familyAllowances: false,
      childHasRelevantIncome: false,
    });
  });

  it("returns the same family category for equivalent C1 and verifier alternating-care facts", () => {
    const payload = {
      statutFamilial: "isole",
      hebergementAlterneEnfant: "oui",
      hebergementAlterneJoursMoyensSemaine: 2,
      hebergementAlterneCycle: "trimestriel",
      hebergementAlterneAllocationsFamiliales: "non",
      hebergementAlterneEnfantRevenuPertinent: "non",
    };
    const c1 = withPersonalSituationTrace(
      decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } }),
      payload,
    );
    const verifier = evaluateArticle110Verifier({
      thresholds: { spouseProfessionalMonthly: null, childProfessionalMonthly: null, spouseReplacementMonthly: null, childReplacementMonthly: null, source: null },
      isAloneExplicit: true,
      people: [],
      alternatingCare: {
        enabled: true,
        averageDaysPerWeek: 2,
        cycle: "quarterly",
        familyAllowances: false,
        childHasRelevantIncome: false,
      },
    });
    expect(c1?.householdAssessment?.expectedCategory).toBe(verifier.category);
    expect(c1?.householdAssessment?.expectedCategory).toBe("A");
  });

  it("returns the same spouse result for equivalent declared C1 and verifier income facts", () => {
    const thresholds = {
      spouseProfessionalMonthly: 1_000,
      childProfessionalMonthly: 1_000,
      spouseReplacementMonthly: null,
      childReplacementMonthly: null,
      source: null,
    };
    const c1 = withPersonalSituationTrace(
      decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } }),
      { cohabitants: [{ lien: "epoux", typeRevenuPro: "salarie-employe", montantRevenuPro: 900, typeContratRevenuPro: "cdi", revenuProfessionnelVariable: "non", revenuRemplacement: "aucun" }] },
      new Date("2026-10-13T00:00:00Z"),
      thresholds,
    );
    const verifier = evaluateArticle110Verifier({
      thresholds,
      asOf: "2026-10-13",
      people: [{ id: "spouse", relation: "spouse", hasProfessionalIncome: true, professionalIncomeType: "employee", professionalIncomeAmount: 900, professionalIncomeContract: "cdi", professionalIncomeVariable: false, hasReplacementIncome: false }],
    });

    expect(c1?.householdAssessment).toMatchObject({
      expectedCategory: verifier.category,
      operationalArticle: verifier.householdAssessment.operationalArticle,
      monthlyPaymentAssessment: verifier.householdAssessment.monthlyPaymentAssessment,
    });
  });
  it("keeps a previous family status, current status and its own effective date", () => {
    const trace = derivePersonalSituationTrace({
      modificationSituationFamiliale: true,
      previousStatutFamilial: "isole",
      statutFamilial: "cohabite",
      dateModificationSituationFamilialeEffective: "2026-10-15",
    });

    expect(trace.changes).toEqual([{
      factKey: "famille.statut",
      previousValue: "isole",
      currentValue: "cohabite",
      effectiveDate: "2026-10-15",
      source: "c1",
    }]);
  });

  it("keeps two declared changes with independent effective dates", () => {
    const trace = derivePersonalSituationTrace({
      modificationAdresse: true,
      dateModificationAdresseEffective: "2026-10-01",
      modificationSituationFamiliale: true,
      statutFamilial: "cohabite",
      dateModificationSituationFamilialeEffective: "2026-10-15",
    });

    expect(trace.changes.map((change) => [change.factKey, change.effectiveDate])).toEqual([
      ["adresse", "2026-10-01"],
      ["famille.statut", "2026-10-15"],
    ]);
  });

  it("does not invent a family qualification when the previous status is absent", () => {
    const trace = derivePersonalSituationTrace({
      modificationSituationFamiliale: true,
      statutFamilial: "cohabite",
      dateModificationSituationFamilialeEffective: "2026-10-15",
    });

    expect(trace.changes[0]).not.toHaveProperty("previousValue");
    expect(trace.companions).toEqual([]);
  });

  it("traces the sourced C1-Partenaire condition and keeps colocation under review", () => {
    const trace = derivePersonalSituationTrace({
      cohabitants: [{ lien: "FAC", c1PartenaireStatus: "premiere-fois" }],
      cohabiteType: "colocation",
    });

    expect(trace.companions).toEqual(expect.arrayContaining([
      expect.objectContaining({ formSlug: "c1-partenaire", status: "required", sourceRuleIds: ["c1_partenaire_personne_charge"] }),
      expect.objectContaining({ formSlug: "c1-regis", status: "needs_review" }),
    ]));
  });

  it("requires REGIS only for a declared difference with the registers", () => {
    const trace = derivePersonalSituationTrace({ situationCohabitationAmbigue: "oui" });
    expect(trace.companions).toEqual([expect.objectContaining({ formSlug: "c1-regis", status: "required" })]);
  });

  it("collects 110&1M temporal facts without inventing the category-A branch", () => {
    const facts = deriveArticle110FactsFromC1({
      cohabitants: [{
        lien: "enfant",
        premierRevenuProfessionnel: "oui",
        demandeNeutralisationPremierRevenu: "oui",
        dateDebutPremiereActivite: "2026-04-01",
        dateFinEtudes: "2026-03-31",
      }],
    });
    expect(facts).toMatchObject({
      "family.child.firstProfessionalIncome": { value: true },
      "family.child.neutralisationRequested": { value: true },
    });
    expect(facts).not.toHaveProperty("family.categoryA.branchEstablished");
  });

  it("maps C1 relations to a composition without retaining identities", () => {
    const composition = deriveHouseholdCompositionFromC1({
      cohabitants: [
        { lien: "enfant", allocationsFamiliales: "oui" },
        { lien: "aucun-lien", typeRevenuPro: "salarie-employe" },
      ],
    });
    expect(composition).toMatchObject({ kind: "children_and_third_parties" });
    expect(composition.factKeys.join(" ")).not.toContain("prenom");
  });

  it("keeps a cousin outside the relatives branch and sends an unknown relation to review", () => {
    expect(deriveHouseholdCompositionFromC1({ cohabitants: [{ lien: "cousin" }] }).kind).toBe("third_parties_only");
    expect(deriveHouseholdCompositionFromC1({ cohabitants: [{ lien: "inconnu" }] })).toMatchObject({ needsReview: true });
  });

  it("retains an SPF disability allowance but marks it neutral for family-status income", () => {
    const composition = deriveHouseholdCompositionFromC1({
      cohabitants: [{ lien: "pere", revenuRemplacement: "allocation-handicap" }],
    });
    expect(composition.members[0]).toMatchObject({ hasReplacementIncome: true, replacementIncomeRelevantForFamilyStatus: false });
  });

  it("keeps A with a child receiving family allowances and a parent without relevant income", () => {
    const base = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const snapshot = withPersonalSituationTrace(base, {
      cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui", revenuRemplacement: "aucun" }, { lien: "pere", revenuRemplacement: "allocation-handicap" }],
    });
    expect(snapshot?.householdAssessment).toMatchObject({ composition: "children_and_relatives", expectedCategory: "A" });
  });

  it("records a pension change even when the calculated parent branch remains A", () => {
    const base = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const first = withPersonalSituationTrace(base, { cohabitants: [{ lien: "pere", revenuRemplacement: "pension", montantRevenuRemplacement: 500, montantPensionNature: "brut", preuvePension: "recu" }] }, new Date(), { spouseProfessionalMonthly: null, childProfessionalMonthly: null, spouseReplacementMonthly: null, childReplacementMonthly: null, ascendantPensionWithChildMonthly: null, ascendantPensionMonthly: 800, ascendantDisabledPensionMonthly: null, source: null });
    const second = withPersonalSituationTrace(first, { cohabitants: [{ lien: "pere", revenuRemplacement: "pension", montantRevenuRemplacement: 600, montantPensionNature: "brut", preuvePension: "recu" }] }, new Date(), { spouseProfessionalMonthly: null, childProfessionalMonthly: null, spouseReplacementMonthly: null, childReplacementMonthly: null, ascendantPensionWithChildMonthly: null, ascendantPensionMonthly: 800, ascendantDisabledPensionMonthly: null, source: null });
    expect(second?.relativeHouseholdAssessment).toMatchObject({ expectedCategory: "A", categoryChanged: false, declarationRequired: true, changes: expect.arrayContaining([expect.objectContaining({ reason: "PENSION_AMOUNT_CHANGED" })]) });
  });

  it("reclassifies children-only immediately when a tier arrives and requires declaration", () => {
    const base = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const before = withPersonalSituationTrace(base, { cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui", revenuRemplacement: "aucun", typeRevenuPro: "aucun" }] });
    const after = withPersonalSituationTrace(before, { cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui", revenuRemplacement: "aucun", typeRevenuPro: "aucun" }, { lien: "cousin", revenuRemplacement: "aucun", typeRevenuPro: "salarie-employe" }] });
    expect(after?.householdAssessment).toMatchObject({ composition: "children_and_third_parties", expectedCategory: "B" });
    expect(after?.thirdPartyHouseholdAssessment).toMatchObject({ declarationRequired: true, changes: expect.arrayContaining([expect.objectContaining({ reason: "THIRD_PARTY_ARRIVED" })]) });
  });

  it("reclassifies again when the tier leaves", () => {
    const base = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const withTier = withPersonalSituationTrace(base, { cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui", revenuRemplacement: "aucun", typeRevenuPro: "aucun" }, { lien: "cousin", revenuRemplacement: "aucun", typeRevenuPro: "aucun" }] });
    const after = withPersonalSituationTrace(withTier, { cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui", revenuRemplacement: "aucun", typeRevenuPro: "aucun" }] });
    expect(after?.householdAssessment?.composition).toBe("children_only");
    expect(after?.thirdPartyHouseholdAssessment).toMatchObject({ composition: "none", declarationRequired: true, changes: expect.arrayContaining([expect.objectContaining({ reason: "THIRD_PARTY_LEFT" })]) });
  });

  it("uses the declared non-married partner branch in the theoretical simulation", () => {
    expect(deriveHouseholdCompositionFromC1({
      cohabitants: [{ lien: "partenaire", typeRevenuPro: "aucun", revenuRemplacement: "aucun" }],
    })).toMatchObject({ kind: "spouse_or_partner", needsReview: false });
  });

  it("persists the temporal effect beside a recomputed household branch", () => {
    const base = decidePersonalSituation({
      "entry.dossier": { value: "changement-situation-personnelle", origin: "system" },
    });
    const snapshot = withPersonalSituationTrace(base, {
      cohabitants: [
        {
          lien: "enfant",
          premierRevenuProfessionnel: "oui",
          demandeNeutralisationPremierRevenu: "oui",
          dateDebutPremiereActivite: "2026-04-01",
          dateFinEtudes: "2026-03-31",
        },
        { lien: "partenaire", partenaireConditionsEtablies: "oui", typeRevenuPro: "aucun", revenuRemplacement: "aucun" },
      ],
    }, new Date("2026-05-01T00:00:00Z"));
    expect(snapshot?.article110Decision?.temporalEffect).toMatchObject({ onemCode: "110&1M", familyCategory: null });
    expect(snapshot?.householdAssessment).toMatchObject({
      composition: "spouse_or_partner",
      expectedCategory: "A",
    });
  });

  it("preserves the official B / 60B state while C110A evidence makes one month A-rate eligible", () => {
    const base = {
      ...decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } }),
      officialOnemState: { onemCode: "B / 60B", recordedAt: "2026-10-08" },
    };
    const snapshot = withPersonalSituationTrace(base, {
      cohabitants: [{
        lien: "epoux",
        typeRevenuPro: "salarie-employe",
        montantRevenuPro: 900,
        typeContratRevenuPro: "cdi",
        revenuProfessionnelVariable: "oui",
        c110aStatut: "recu",
        montantMensuelC110a: 900,
        revenuRemplacement: "aucun",
      }],
    }, new Date("2026-10-08T00:00:00Z"), {
      spouseProfessionalMonthly: 1000,
      childProfessionalMonthly: null,
      spouseReplacementMonthly: null,
      childReplacementMonthly: null,
      source: null,
    });
    expect(snapshot?.officialOnemState).toEqual(base.officialOnemState);
    expect(snapshot?.householdAssessment).toMatchObject({
      expectedCategory: "B",
      operationalArticle: "60B",
      monthlyPaymentAssessment: "A_RATE",
    });
  });
});

describe("children-only branch and declaration events", () => {
  const decision = () => decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
  const children = (rows: Record<string, unknown>[]) => ({ cohabitants: rows.map((row) => ({ lien: "enfant", revenuRemplacement: "aucun", ...row })) });

  it("1. keeps A when two children receive family allowances", () => {
    const snapshot = withPersonalSituationTrace(decision(), children([{ allocationsFamiliales: "oui" }, { allocationsFamiliales: "oui" }]));
    expect(snapshot?.householdAssessment).toMatchObject({ composition: "children_only", expectedCategory: "A" });
  });

  it("2. records a declaration when one child starts work although another keeps A through family allowances", () => {
    const before = withPersonalSituationTrace(decision(), children([{ allocationsFamiliales: "oui" }, { allocationsFamiliales: "oui", typeRevenuPro: "aucun" }]));
    const after = withPersonalSituationTrace(before, children([{ allocationsFamiliales: "oui" }, { allocationsFamiliales: "non", typeRevenuPro: "salarie-employe" }]));
    expect(after?.childrenOnlyAssessment).toMatchObject({ expectedCategory: "A", categoryChanged: false, declarationRequired: true, changes: expect.arrayContaining([expect.objectContaining({ reason: "CHILD_STARTED_WORK" })]) });
  });

  it("keeps the official ONEM state unchanged while emitting the declaration event", () => {
    const before = withPersonalSituationTrace({ ...decision(), officialOnemState: { onemCode: "A", recordedAt: "2026-10-08" } }, children([{ allocationsFamiliales: "oui" }, { allocationsFamiliales: "oui", typeRevenuPro: "aucun" }]));
    const after = withPersonalSituationTrace(before, children([{ allocationsFamiliales: "oui" }, { allocationsFamiliales: "non", typeRevenuPro: "salarie-employe" }]));
    expect(after?.officialOnemState).toEqual({ onemCode: "A", recordedAt: "2026-10-08" });
    expect(after?.childrenOnlyAssessment?.declarationRequired).toBe(true);
  });

  it("3. expects A when no child has family allowances or relevant income", () => {
    expect(withPersonalSituationTrace(decision(), children([{ allocationsFamiliales: "non", typeRevenuPro: "aucun" }, { allocationsFamiliales: "non", typeRevenuPro: "aucun" }]))?.householdAssessment).toMatchObject({ expectedCategory: "A" });
  });

  it("4. expects B when no child has family allowances and one has an above-threshold declared income", () => {
    expect(withPersonalSituationTrace(decision(), children([{ allocationsFamiliales: "non", typeRevenuPro: "salarie-employe", montantRevenuPro: 1_001 }]), new Date(), {
      spouseProfessionalMonthly: null,
      childProfessionalMonthly: 1_000,
      spouseReplacementMonthly: null,
      childReplacementMonthly: null,
      source: null,
    })?.householdAssessment).toMatchObject({ expectedCategory: "B" });
  });

  it("5. traces 110&1M and the declaration while another child independently keeps A", () => {
    const snapshot = withPersonalSituationTrace(decision(), children([
      { allocationsFamiliales: "oui" },
      { allocationsFamiliales: "non", typeRevenuPro: "salarie-employe", premierRevenuProfessionnel: "oui", demandeNeutralisationPremierRevenu: "oui", dateDebutPremiereActivite: "2026-04-01", dateFinEtudes: "2026-03-31" },
    ]), new Date("2026-05-01T00:00:00Z"));
    expect(snapshot?.householdAssessment).toMatchObject({ expectedCategory: "A" });
    expect(snapshot?.article110Decision?.temporalEffect).toMatchObject({ onemCode: "110&1M" });
  });

  it("6. keeps A after 110&1M ends when another child still receives family allowances", () => {
    const prior = withPersonalSituationTrace(decision(), children([
      { allocationsFamiliales: "oui" },
      { allocationsFamiliales: "non", typeRevenuPro: "salarie-employe", premierRevenuProfessionnel: "oui", demandeNeutralisationPremierRevenu: "oui", dateDebutPremiereActivite: "2026-04-01", dateFinEtudes: "2026-03-31" },
    ]), new Date("2026-05-01T00:00:00Z"));
    const after = withPersonalSituationTrace(prior, children([
      { allocationsFamiliales: "oui" },
      { allocationsFamiliales: "non", typeRevenuPro: "salarie-employe", premierRevenuProfessionnel: "oui", demandeNeutralisationPremierRevenu: "oui", dateDebutPremiereActivite: "2026-04-01", dateFinEtudes: "2026-03-31" },
    ]), new Date("2027-05-01T00:00:00Z"));
    expect(after?.householdAssessment).toMatchObject({ expectedCategory: "A" });
  });

  it("7. leaves children-only when another household relation is declared", () => {
    const snapshot = withPersonalSituationTrace(decision(), { cohabitants: [{ lien: "enfant", allocationsFamiliales: "oui" }, { lien: "pere", revenuRemplacement: "aucun" }] });
    expect(snapshot?.householdAssessment?.composition).not.toBe("children_only");
  });

});
