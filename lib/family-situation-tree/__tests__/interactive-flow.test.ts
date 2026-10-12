import { describe, expect, it } from "vitest";
import { chooseFamilyTreeBranch, resetFamilyTreeBranch, updateTreePerson } from "../interactive-flow";

describe("interactive family tree state", () => {
  it("starts a partner branch with one qualified partner and no income assumption", () => {
    const state = chooseFamilyTreeBranch("partner");
    expect(state.people).toMatchObject([{ relation: "partner", partnerEstablished: true }]);
    expect(state.people[0]).not.toHaveProperty("hasProfessionalIncome");
  });

  it("drops incompatible facts on a branch change", () => {
    const partner = updateTreePerson(chooseFamilyTreeBranch("partner"), "partner", { hasProfessionalIncome: true, professionalIncomeAmount: 800 });
    expect(resetFamilyTreeBranch(partner, "alone")).toEqual({ branch: "alone", people: [] });
  });
});
