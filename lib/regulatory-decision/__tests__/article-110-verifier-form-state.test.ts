import { describe, expect, it } from "vitest";

import { canAddVerifierMember, createVerifierMember, moveVerifierMember, removeVerifierMember, updateVerifierMember } from "@/app/partenaire/outils/verificateur-situation-familiale/form-state";

describe("Article 110 verifier household form state", () => {
  it("updates only the intended stable id after adding and reordering partner, child and mother", () => {
    const partner = createVerifierMember("partner-id", "partner");
    const child = createVerifierMember("child-id", "child");
    const mother = createVerifierMember("mother-id", "mother");
    const reordered = moveVerifierMember([partner, child, mother], "mother-id", -1);
    const afterMother = updateVerifierMember(reordered, "mother-id", { hasReplacementIncome: true });
    const updated = updateVerifierMember(afterMother, "child-id", { hasProfessionalIncome: true });
    expect(updated.find((person) => person.id === "mother-id")).toMatchObject({ hasReplacementIncome: true });
    expect(updated.find((person) => person.id === "child-id")).toMatchObject({ hasProfessionalIncome: true });
    expect(updated.find((person) => person.id === "partner-id")).not.toHaveProperty("hasReplacementIncome");
    expect(removeVerifierMember(updated, "mother-id").map((person) => person.id)).toEqual(["partner-id", "child-id"]);
  });

  it("allows only one spouse or partner entry", () => {
    expect(canAddVerifierMember([createVerifierMember("spouse", "spouse")], "partner")).toBe(false);
  });
});
