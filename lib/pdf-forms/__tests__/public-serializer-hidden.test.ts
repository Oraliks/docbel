import { describe, expect, it } from "vitest";

import { toPublicForm } from "../public-serializer";
import type { PdfFormField } from "../types";

function field(id: string, over: Partial<PdfFormField> = {}): PdfFormField {
  return {
    id,
    pdfFieldName: id,
    type: "text",
    label: { fr: id },
    order: 0,
    ...over,
  } as PdfFormField;
}

const baseForm = {
  id: "f1",
  slug: "demo",
  title: "Demo",
  description: null,
  issuer: "ONEM",
  version: 1,
  defaultLocale: "fr" as const,
  locales: ["fr"] as const,
  allowDownload: true,
  allowDoccle: false,
  allowItsme: false,
};

describe("toPublicForm — champs hidden", () => {
  it("exclut les champs hidden du formulaire public envoyé au client", () => {
    const form = {
      ...baseForm,
      fields: [
        field("niss"),
        field("cachet_ecole", { hidden: true }),
        field("nom"),
        field("signature_ecole", { type: "signature", hidden: true }),
      ] as unknown,
    };
    const pub = toPublicForm(form as never);
    expect(pub.fields.map((f) => f.id)).toEqual(["niss", "nom"]);
  });

  it("garde tous les champs quand aucun n'est hidden (rétro-compat)", () => {
    const form = {
      ...baseForm,
      fields: [field("a"), field("b"), field("c")] as unknown,
    };
    const pub = toPublicForm(form as never);
    expect(pub.fields).toHaveLength(3);
  });
});
