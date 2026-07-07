import { describe, it, expect } from "vitest";
import type { FormPayload } from "../../types";
import { bind, evaluateWhen, resolveStamps } from "../engine";
import type { MappingRule } from "../types";

describe("evaluateWhen — conditions déclaratives", () => {
  it("valeur brute string = égalité stricte", () => {
    const rule: MappingRule = { name: "r", when: { motif: "modification" } };
    expect(evaluateWhen(rule, { motif: "modification" })).toBe(true);
    expect(evaluateWhen(rule, { motif: "premiere" })).toBe(false);
    expect(evaluateWhen(rule, {})).toBe(false);
  });

  it("valeur brute boolean = égalité stricte", () => {
    const rule: MappingRule = { name: "r", when: { flag: true } };
    expect(evaluateWhen(rule, { flag: true })).toBe(true);
    expect(evaluateWhen(rule, { flag: false })).toBe(false);
    // undefined ≠ true — la clé n'est pas là.
    expect(evaluateWhen(rule, {})).toBe(false);
  });

  it("{ equals: v } équivalent à valeur brute", () => {
    const rule: MappingRule = { name: "r", when: { motif: { equals: "modification" } } };
    expect(evaluateWhen(rule, { motif: "modification" })).toBe(true);
    expect(evaluateWhen(rule, { motif: "autre" })).toBe(false);
  });

  it("{ not: v } inverse l'égalité", () => {
    const rule: MappingRule = { name: "r", when: { transfert: { not: true } } };
    expect(evaluateWhen(rule, { transfert: true })).toBe(false);
    expect(evaluateWhen(rule, { transfert: false })).toBe(true);
    // Sur clé absente, "not: true" est vrai (undefined !== true).
    expect(evaluateWhen(rule, {})).toBe(true);
  });

  it("{ in: [...] } — appartenance", () => {
    const rule: MappingRule = {
      name: "r",
      when: { mode: { in: ["virement", "cheque"] as const } },
    };
    expect(evaluateWhen(rule, { mode: "virement" })).toBe(true);
    expect(evaluateWhen(rule, { mode: "cheque" })).toBe(true);
    expect(evaluateWhen(rule, { mode: "autre" })).toBe(false);
    expect(evaluateWhen(rule, {})).toBe(false);
  });

  it("{ matches: regex } — coerce en string et teste", () => {
    const rule: MappingRule = {
      name: "r",
      when: { iban: { matches: "^BE\\d" } },
    };
    expect(evaluateWhen(rule, { iban: "BE68 5390 0754 7034" })).toBe(true);
    expect(evaluateWhen(rule, { iban: "FR76 3000 6000" })).toBe(false);
    // Valeur non-string : coercée en string via String(v ?? "").
    expect(evaluateWhen(rule, { iban: 12345 })).toBe(false);
  });

  it("regex invalide → false, pas d'exception", () => {
    const rule: MappingRule = { name: "r", when: { x: { matches: "[unclosed" } } };
    expect(evaluateWhen(rule, { x: "abc" })).toBe(false);
  });

  it("AND implicite : toutes les clés doivent passer", () => {
    const rule: MappingRule = {
      name: "r",
      when: { motif: "modification", flag: { not: true } },
    };
    expect(evaluateWhen(rule, { motif: "modification", flag: false })).toBe(true);
    expect(evaluateWhen(rule, { motif: "modification", flag: true })).toBe(false);
    expect(evaluateWhen(rule, { motif: "autre", flag: false })).toBe(false);
  });

  it("whenFn : évalué en AND avec when", () => {
    const rule: MappingRule = {
      name: "r",
      when: { motif: "modification" },
      whenFn: (v) => (v.count as number) > 0,
    };
    expect(evaluateWhen(rule, { motif: "modification", count: 5 })).toBe(true);
    expect(evaluateWhen(rule, { motif: "modification", count: 0 })).toBe(false);
    expect(evaluateWhen(rule, { motif: "autre", count: 5 })).toBe(false);
  });

  it("règle sans when ni whenFn = toujours active", () => {
    expect(evaluateWhen({ name: "r" }, {})).toBe(true);
    expect(evaluateWhen({ name: "r" }, { x: "y" })).toBe(true);
  });
});

describe("resolveStamps — dernier gagnant par widget", () => {
  it("collecte les stamps statiques dans l'ordre", () => {
    const rules: MappingRule[] = [
      { name: "a", stamp: [{ widget: "w1", value: true }] },
      { name: "b", stamp: [{ widget: "w2", value: "hello" }] },
    ];
    const out = resolveStamps({}, rules);
    expect(out.size).toBe(2);
    expect(out.get("w1")).toBe(true);
    expect(out.get("w2")).toBe("hello");
  });

  it("règle inactive → aucune contribution", () => {
    const rules: MappingRule[] = [
      { name: "a", when: { flag: true }, stamp: [{ widget: "w1", value: true }] },
      { name: "b", stamp: [{ widget: "w2", value: "keep" }] },
    ];
    const out = resolveStamps({ flag: false }, rules);
    expect(out.has("w1")).toBe(false);
    expect(out.get("w2")).toBe("keep");
  });

  it("le dernier écrit gagne quand deux règles ciblent le même widget", () => {
    const rules: MappingRule[] = [
      { name: "a", stamp: [{ widget: "w", value: "first" }] },
      { name: "b", stamp: [{ widget: "w", value: "last" }] },
    ];
    const out = resolveStamps({}, rules);
    expect(out.get("w")).toBe("last");
  });

  it("stampFn contribue à la Map", () => {
    const rules: MappingRule[] = [
      {
        name: "fn",
        stampFn: (v) => [{ widget: "target", value: String(v.hello ?? "") }],
      },
    ];
    const out = resolveStamps({ hello: "world" }, rules);
    expect(out.get("target")).toBe("world");
  });

  it("stamp + stampFn dans la même règle → les deux appliqués (stampFn dernier)", () => {
    const rules: MappingRule[] = [
      {
        name: "mix",
        stamp: [{ widget: "shared", value: "static" }],
        stampFn: () => [{ widget: "shared", value: "dynamic" }],
      },
    ];
    const out = resolveStamps({}, rules);
    // stampFn est traité APRÈS stamp dans la boucle → dernier gagne.
    expect(out.get("shared")).toBe("dynamic");
  });

  it("widget name vide est ignoré (jamais dans la Map)", () => {
    const rules: MappingRule[] = [
      { name: "r", stamp: [{ widget: "", value: true }] },
    ];
    expect(resolveStamps({}, rules).size).toBe(0);
  });
});

describe("bind — helper d'écriture directe", () => {
  it("stampe la valeur trimée sur le widget quand non vide", () => {
    const rule = bind("nom", "widget_nom");
    const stamps = resolveStamps({ nom: "  Dupont  " } as FormPayload, [rule]);
    expect(stamps.get("widget_nom")).toBe("Dupont");
  });

  it("ne stampe rien si la valeur source est vide/absente", () => {
    const rule = bind("nom", "widget_nom");
    expect(resolveStamps({}, [rule]).size).toBe(0);
    expect(resolveStamps({ nom: "" }, [rule]).size).toBe(0);
    expect(resolveStamps({ nom: "   " }, [rule]).size).toBe(0);
    expect(resolveStamps({ nom: null }, [rule]).size).toBe(0);
  });

  it("format date-fr : ISO → DD/MM/YYYY, autre → tel quel", () => {
    const rule = bind("date", "w_date", "date-fr");
    expect(resolveStamps({ date: "2026-07-08" }, [rule]).get("w_date")).toBe("08/07/2026");
    expect(resolveStamps({ date: "08/07/2026" }, [rule]).get("w_date")).toBe("08/07/2026");
  });

  it("format iban-strip-be : retire le préfixe BE", () => {
    const rule = bind("iban", "w_iban", "iban-strip-be");
    expect(resolveStamps({ iban: "BE68 5390 0754 7034" }, [rule]).get("w_iban")).toBe(
      "68 5390 0754 7034"
    );
    // Idempotent : sans BE, laisse tel quel.
    expect(resolveStamps({ iban: "FR76 3000" }, [rule]).get("w_iban")).toBe("FR76 3000");
  });

  it("coerce number/boolean en string", () => {
    const rule = bind("age", "w_age");
    expect(resolveStamps({ age: 42 }, [rule]).get("w_age")).toBe("42");
    expect(resolveStamps({ age: true }, [rule]).get("w_age")).toBe("true");
  });

  it("declaredWidgets renseigné pour le mapping-report", () => {
    expect(bind("x", "w").declaredWidgets).toEqual(["w"]);
  });
});
