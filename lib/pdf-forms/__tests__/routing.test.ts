import { describe, it, expect } from "vitest";
import { compilerRoutage, type TableRoutage } from "../routing";

describe("compilerRoutage", () => {
  it("une question sur tous les chemins n'a aucune condition", () => {
    const table: TableRoutage = {
      q1: { on: { oui: "q2", non: "q3" } },
      q2: { next: "q3" },
      q3: { next: "fin" },
    };
    const conditions = compilerRoutage(table, "q1");
    expect(conditions.q1).toBeUndefined();
    expect(conditions.q3).toBeUndefined();
  });

  it("une question atteignable par une seule branche porte sa condition", () => {
    const table: TableRoutage = {
      q1: { on: { oui: "q2", non: "q3" } },
      q2: { next: "q3" },
      q3: { next: "fin" },
    };
    const conditions = compilerRoutage(table, "q1");
    expect(conditions.q2).toEqual({ fieldId: "q1", op: "equals", value: "oui" });
  });

  it("cumule les conditions transitives sur une branche profonde", () => {
    const table: TableRoutage = {
      q1: { on: { oui: "q2", non: "q9" } },
      q2: { next: "q3" },
      q3: { on: { oui: "q4", non: "q9" } },
      q4: { next: "q7" },
      q7: { on: { oui: "q8", non: "q9" } },
      q8: { next: "q9" },
      q9: { next: "fin" },
    };
    const conditions = compilerRoutage(table, "q1");
    expect(conditions.q4).toEqual({
      fieldId: "q3",
      op: "equals",
      value: "oui",
      and: [{ fieldId: "q1", op: "equals", value: "oui" }],
    });
    expect(conditions.q8).toEqual({
      fieldId: "q7",
      op: "equals",
      value: "oui",
      and: [
        { fieldId: "q3", op: "equals", value: "oui" },
        { fieldId: "q1", op: "equals", value: "oui" },
      ],
    });
    expect(conditions.q9, "q9 est sur tous les chemins").toBeUndefined();
  });

  it("refuse un renvoi vers une question inconnue", () => {
    const table: TableRoutage = { q1: { next: "q404" } };
    expect(() => compilerRoutage(table, "q1")).toThrow(/q404/);
  });

  it("refuse un cycle", () => {
    const table: TableRoutage = { q1: { next: "q2" }, q2: { next: "q1" } };
    expect(() => compilerRoutage(table, "q1")).toThrow(/cycle/i);
  });
});
