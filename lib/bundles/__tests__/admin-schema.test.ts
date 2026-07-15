import { describe, expect, it } from "vitest";
import {
  createBundleSchema,
  normalizeAdminCondition,
  updateBundleSchema,
  validateBundleItemReferences,
} from "../admin-schema";

describe("bundle admin schemas", () => {
  it("rejects unknown keys and malformed slugs", () => {
    expect(
      createBundleSchema.safeParse({ slug: "Pas Bon", name: "Dossier" }).success,
    ).toBe(false);
    expect(
      createBundleSchema.safeParse({
        slug: "dossier-valide",
        name: "Dossier",
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate PDF forms", () => {
    const result = updateBundleSchema.safeParse({
      items: [
        { pdfFormId: "pdf-1", order: 0, required: true, condition: null },
        { pdfFormId: "pdf-1", order: 1, required: false, condition: null },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("normalizes CSV values for in/notIn operators", () => {
    expect(
      normalizeAdminCondition({
        type: "and",
        rules: [
          {
            type: "leaf",
            sourceTemplateId: "pdf-1",
            fieldId: "statut",
            op: "in",
            value: "ouvrier, employe",
          },
        ],
      }),
    ).toEqual({
      type: "and",
      rules: [
        {
          type: "leaf",
          sourceTemplateId: "pdf-1",
          fieldId: "statut",
          op: "in",
          value: ["ouvrier", "employe"],
        },
      ],
    });
  });

  it("rejects a condition referencing itself or a missing document", () => {
    const base = [
      { pdfFormId: "pdf-1", order: 0, required: true, condition: null },
      {
        pdfFormId: "pdf-2",
        order: 1,
        required: true,
        condition: {
          type: "and" as const,
          rules: [
            {
              type: "leaf" as const,
              sourceTemplateId: "pdf-2",
              fieldId: "x",
              op: "equals" as const,
              value: "yes",
            },
          ],
        },
      },
    ];
    const parsed = updateBundleSchema.parse({ items: base });
    expect(validateBundleItemReferences(parsed.items!)).toEqual({
      ok: false,
      itemIndex: 1,
      sourceId: "pdf-2",
    });
  });

  it("accepts a condition referencing another included document", () => {
    const parsed = updateBundleSchema.parse({
      items: [
        { pdfFormId: "pdf-1", order: 0, required: true, condition: null },
        {
          pdfFormId: "pdf-2",
          order: 1,
          required: true,
          condition: {
            type: "and",
            rules: [
              {
                type: "leaf",
                sourceTemplateId: "pdf-1",
                fieldId: "x",
                op: "equals",
                value: "yes",
              },
            ],
          },
        },
      ],
    });
    expect(validateBundleItemReferences(parsed.items!)).toEqual({ ok: true });
  });
});
