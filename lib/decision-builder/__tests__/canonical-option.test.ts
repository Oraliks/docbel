import { describe, it, expect } from "vitest";
import { OptionNodeSchema } from "@/lib/decision-builder/schema";

describe("OptionNodeSchema — canonical", () => {
  it("accepte une option avec tag canonical", () => {
    const parsed = OptionNodeSchema.parse({
      type: "option",
      id: "o1",
      label: "Moins de 25 ans",
      nextId: "q2",
      canonical: { key: "age_bracket", value: "under_25" },
    });
    expect(parsed.canonical).toEqual({ key: "age_bracket", value: "under_25" });
  });

  it("accepte une option SANS canonical (rétro-compat)", () => {
    const parsed = OptionNodeSchema.parse({
      type: "option",
      id: "o2",
      label: "Autre",
      nextId: "q3",
    });
    expect(parsed.canonical).toBeUndefined();
  });
});
