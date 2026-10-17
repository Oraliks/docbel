import { describe, expect, it } from "vitest";
import { qualificationInputFromLegacy } from "../family-person-facts";
import type { FamilyPersonQualificationInput } from "../family-person-facts";
import { qualifyPartnerAssimilation } from "../family-person-qualification";

describe("person qualification facts — legacy boundary", () => {
  it.each([undefined, false, true])("preserves partnerEstablished=%s without creating facts", (oldValue) => {
    const input = qualificationInputFromLegacy(
      { id: "person-1", relation: "partner", partnerEstablished: oldValue },
      { asOf: "2026-10-17" },
    );
    expect(input).toMatchObject({
      schemaVersion: 2, personId: "person-1", declaredRelation: "partner",
      asOf: "2026-10-17", facts: {}, declarationStatus: "unknown",
    });
    expect(input.legacy?.partnerEstablished).toBe(oldValue);
    expect(qualifyPartnerAssimilation(input).status).toBe("needs_information");
  });

  it.each(["oui", "non"] as const)("retains C1 answer %s alongside a divergent legacy boolean", (answer) => {
    const input = qualificationInputFromLegacy(
      { id: "person-2", relation: "partner", partnerEstablished: answer === "non" },
      { asOf: "2026-10-17", partenaireConditionsEtablies: answer },
    );
    expect(input.legacy).toEqual({
      partnerEstablished: answer === "non", partenaireConditionsEtablies: answer,
    });
    expect(input.facts).toEqual({});
    expect(qualifyPartnerAssimilation(input).status).toBe("needs_information");
  });

  it("keeps an explicit negative answer and its exact provenance", () => {
    const answer = { value: false, origin: "user" as const, sourceField: "c1.sameRoof", effectiveAt: "2026-10-01" };
    const input: FamilyPersonQualificationInput = {
      ...qualificationInputFromLegacy({ id: "p", relation: "partner", partnerEstablished: true }, { asOf: "2026-10-17" }),
      facts: { sameRoof: answer },
    };
    expect(input.facts.sameRoof).toEqual(answer);
    expect(qualifyPartnerAssimilation(input).missingFactKeys).toContain("absenceReason");
    expect(input.facts.sameRoof).toBe(answer);
    expect(input.legacy?.partnerEstablished).toBe(true);
  });
});
