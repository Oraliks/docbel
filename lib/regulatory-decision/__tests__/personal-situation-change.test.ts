import { describe, expect, it } from "vitest";
import {
  deriveArticle110FactsFromC1,
  deriveHouseholdCompositionFromC1,
  derivePersonalSituationTrace,
  assessIsolatedHouseholdClaim,
  withPersonalSituationTrace,
} from "../personal-situation-change";
import { decidePersonalSituation } from "../personal-situation";

describe("personal situation change trace", () => {
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
    expect(deriveHouseholdCompositionFromC1({ cohabitants: [{ lien: "cousin" }] }).kind).toBe("mixed_or_unsupported");
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

  it("keeps a declared autonomous co-housing claim in its dedicated review path, not the tier conclusion", () => {
    const composition = deriveHouseholdCompositionFromC1({ cohabitants: [{ lien: "cousin", typeRevenuPro: "aucun", revenuRemplacement: "aucun" }] });
    expect(assessIsolatedHouseholdClaim({ cohousingVieAutonomeRevendiquee: "oui" }, composition)).toMatchObject({ branch: "cohousing", status: "needs_review", claimState: "ISOLATED_CLAIM" });
  });

  it("does not treat a merely declared non-married partner as established", () => {
    expect(deriveHouseholdCompositionFromC1({
      cohabitants: [{ lien: "partenaire", typeRevenuPro: "aucun", revenuRemplacement: "aucun" }],
    })).toMatchObject({ kind: "mixed_or_unsupported", needsReview: true });
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

describe("isolated household branches", () => {
  const alone = (payload: Record<string, unknown>) => assessIsolatedHouseholdClaim({ statutFamilial: "isole", ...payload }, deriveHouseholdCompositionFromC1({}));

  it("1. expects A only for a declared, paid alimony obligation with an admissible received act", () => {
    expect(alone({ pensionAlimentaire: "oui", statutJugementPensionAlimentaire: "en-main", pensionAlimentairePaiementEffectif: "oui", pensionAlimentaireBaseJuridique: "decision-judiciaire", pensionAlimentaireBeneficiaire: "enfant-mineur" })).toMatchObject({ branch: "alimony", expectedCategory: "A", status: "probable" });
  });

  it("2. keeps an adult-child alimony obligation pending when its relevance is not declared", () => {
    expect(alone({ pensionAlimentaire: "oui", statutJugementPensionAlimentaire: "en-main", pensionAlimentairePaiementEffectif: "oui", pensionAlimentaireBaseJuridique: "acte-notarie-enfant", pensionAlimentaireBeneficiaire: "enfant-majeur" })).toMatchObject({ expectedCategory: null, status: "needs_information" });
  });

  it("3. records a pending judgment without immediately expecting A", () => {
    expect(alone({ pensionAlimentaire: "oui", statutJugementPensionAlimentaire: "en-cours", pensionAlimentairePaiementEffectif: "oui" })).toMatchObject({ claimState: "PENDING_JUDGMENT", expectedCategory: null, recommendedAction: "provide_judgment" });
  });

  it("4. marks supplied historical dates for human retroactive review without a deadline", () => {
    expect(alone({ pensionAlimentaire: "oui", statutJugementPensionAlimentaire: "en-cours", dateDemandePensionAlimentaire: "2026-01-01", dateActePensionAlimentaire: "2026-02-01", dateEffetRevendiquePensionAlimentaire: "2025-12-01" })?.retroactivity).toMatchObject({ status: "RETROACTIVE_REVIEW_REQUIRED", claimedEffectiveDate: "2025-12-01" });
  });

  it("5. recalculates from the declared stop date rather than retaining A", () => {
    expect(alone({ pensionAlimentaire: "oui", statutJugementPensionAlimentaire: "en-main", pensionAlimentairePaiementEffectif: "non", dateArretPensionAlimentaire: "2026-10-01" })).toMatchObject({ expectedCategory: null, recommendedAction: "reassess_from_effective_date", recalculationEffectiveAt: "2026-10-01" });
  });

  it("6. makes alternating care A-eligible only with regular actual accommodation and family allowances", () => {
    expect(alone({ hebergementAlterneEnfant: "oui", hebergementAlterneRegulier: "oui", hebergementAlterneAllocationsFamiliales: "oui", hebergementAlterneEnfantRevenuPertinent: "oui", hebergementAlternePieceStatut: "jugement" })).toMatchObject({ branch: "alternating_care", expectedCategory: "A" });
  });

  it("7. safe-fails alternating care when regular accommodation is not established", () => {
    expect(alone({ hebergementAlterneEnfant: "oui", hebergementAlterneRegulier: "non" })).toMatchObject({ expectedCategory: null, status: "needs_review" });
  });

  it("8. keeps an explicit co-housing claim in ONEM review and requires the existing REGIS route", () => {
    expect(alone({ cohousingVieAutonomeRevendiquee: "oui", cohousingBailDisponible: "oui", cohousingAttestationHonneur: "oui", cohousingGestionMenageSeparee: "oui" })).toMatchObject({ branch: "cohousing", claimState: "ISOLATED_CLAIM", expectedCategory: null, documents: expect.arrayContaining([expect.objectContaining({ document: "c1-regis", status: "required" })]) });
  });

  it("shows the existing REGIS document as completed when the BundleRun confirms it", () => {
    expect(assessIsolatedHouseholdClaim({ statutFamilial: "isole", cohousingVieAutonomeRevendiquee: "oui" }, deriveHouseholdCompositionFromC1({}), undefined, { regisCompleted: true })).toMatchObject({ documents: expect.arrayContaining([expect.objectContaining({ document: "c1-regis", status: "completed" })]) });
  });

  it("9. does not infer a co-housing category from an address or a bare colocation", () => {
    expect(assessIsolatedHouseholdClaim({ statutFamilial: "isole", habiteEnColocation: "oui" }, deriveHouseholdCompositionFromC1({}))).toBeUndefined();
  });

  it("10. exits the co-housing path when a family or couple relation is declared", () => {
    const composition = deriveHouseholdCompositionFromC1({ cohabitants: [{ lien: "epoux" }] });
    expect(assessIsolatedHouseholdClaim({ cohousingVieAutonomeRevendiquee: "oui" }, composition)).toBeUndefined();
  });

  it("keeps the claim and its previous version in the BundleRun decision snapshot", () => {
    const base = {
      ...decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } }),
      isolatedHouseholdAssessment: alone({ pensionAlimentaire: "oui", statutJugementPensionAlimentaire: "en-main", pensionAlimentairePaiementEffectif: "oui", pensionAlimentaireBaseJuridique: "decision-judiciaire", pensionAlimentaireBeneficiaire: "enfant-mineur" }),
    };
    const snapshot = withPersonalSituationTrace(base, {
      statutFamilial: "isole", pensionAlimentaire: "oui", statutJugementPensionAlimentaire: "en-main", pensionAlimentairePaiementEffectif: "non", dateArretPensionAlimentaire: "2026-10-01",
    });
    expect(snapshot?.isolatedHouseholdAssessment).toMatchObject({ recalculationEffectiveAt: "2026-10-01" });
    expect(snapshot?.isolatedHouseholdAssessmentHistory).toHaveLength(1);
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

  it("4. expects B when no child has family allowances and one has relevant income", () => {
    expect(withPersonalSituationTrace(decision(), children([{ allocationsFamiliales: "non", typeRevenuPro: "salarie-employe" }]))?.householdAssessment).toMatchObject({ expectedCategory: "B" });
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

  it("8. expects A for documented regular alternating care with its conditions established", () => {
    expect(assessIsolatedHouseholdClaim({ statutFamilial: "isole", hebergementAlterneEnfant: "oui", hebergementAlterneRegulier: "oui", hebergementAlterneAllocationsFamiliales: "oui", hebergementAlternePieceStatut: "jugement" }, deriveHouseholdCompositionFromC1({}))).toMatchObject({ expectedCategory: "A", documents: [expect.objectContaining({ status: "received" })] });
  });

  it("9. holds alternating care as pending while the judgment or act is awaited", () => {
    expect(assessIsolatedHouseholdClaim({ statutFamilial: "isole", hebergementAlterneEnfant: "oui", hebergementAlternePieceStatut: "en-cours" }, deriveHouseholdCompositionFromC1({}))).toMatchObject({ claimState: "PENDING_JUDGMENT", expectedCategory: null, documents: [expect.objectContaining({ status: "pending" })] });
  });

  it("10. preserves pending alternating-care history when the judgment arrives", () => {
    const pending = assessIsolatedHouseholdClaim({ statutFamilial: "isole", hebergementAlterneEnfant: "oui", hebergementAlternePieceStatut: "en-cours" }, deriveHouseholdCompositionFromC1({}));
    const snapshot = withPersonalSituationTrace({ ...decision(), isolatedHouseholdAssessment: pending }, { statutFamilial: "isole", hebergementAlterneEnfant: "oui", hebergementAlterneRegulier: "oui", hebergementAlterneAllocationsFamiliales: "oui", hebergementAlternePieceStatut: "jugement", dateEffetRevendiqueHebergementAlterne: "2026-01-01" });
    expect(snapshot?.isolatedHouseholdAssessmentHistory).toHaveLength(1);
    expect(snapshot?.isolatedHouseholdAssessment?.retroactivity).toMatchObject({ status: "RETROACTIVE_REVIEW_REQUIRED" });
  });

  it("11. sends insufficiently established alternating care to review", () => {
    expect(assessIsolatedHouseholdClaim({ statutFamilial: "isole", hebergementAlterneEnfant: "oui", hebergementAlterneRegulier: "non", hebergementAlternePieceStatut: "jugement" }, deriveHouseholdCompositionFromC1({}))).toMatchObject({ expectedCategory: null, status: "needs_review" });
  });
});
