import { describe, it, expect } from "vitest";
import { REPORT_TYPES, isKnownReportType } from "@/lib/reports/registry";

describe("isKnownReportType", () => {
  it("reconnaît les 5 types initiaux", () => {
    expect(isKnownReportType("bureau")).toBe(true);
    expect(isKnownReportType("form_validation")).toBe(true);
    expect(isKnownReportType("training")).toBe(true);
    expect(isKnownReportType("translation")).toBe(true);
    expect(isKnownReportType("riolex_article")).toBe(true);
  });
  it("rejette un type inconnu", () => {
    expect(isKnownReportType("inexistant")).toBe(false);
  });
});

describe("bureau payloadSchema", () => {
  it("accepte une catégorie valide", () => {
    const r = REPORT_TYPES.bureau.payloadSchema.safeParse({ category: "hours" });
    expect(r.success).toBe(true);
  });
  it("rejette une catégorie invalide", () => {
    const r = REPORT_TYPES.bureau.payloadSchema.safeParse({ category: "nope" });
    expect(r.success).toBe(false);
  });
});

describe("bureau messageSchema", () => {
  it("rejette un message trop court", () => {
    expect(REPORT_TYPES.bureau.messageSchema.safeParse("abc").success).toBe(false);
  });
  it("accepte un message de 5 à 1000 caractères", () => {
    expect(REPORT_TYPES.bureau.messageSchema.safeParse("abcde").success).toBe(true);
    expect(REPORT_TYPES.bureau.messageSchema.safeParse("a".repeat(1001)).success).toBe(false);
  });
});

describe("form_validation payloadSchema", () => {
  it("exige fieldId, fieldType, rejectedValue, errorMessage", () => {
    const r = REPORT_TYPES.form_validation.payloadSchema.safeParse({
      fieldId: "niss", fieldType: "niss", rejectedValue: "123", errorMessage: "Format invalide",
    });
    expect(r.success).toBe(true);
  });
  it("rejette si errorMessage manque", () => {
    const r = REPORT_TYPES.form_validation.payloadSchema.safeParse({
      fieldId: "niss", fieldType: "niss", rejectedValue: "123",
    });
    expect(r.success).toBe(false);
  });
});

describe("training payloadSchema", () => {
  it("accepte une raison valide", () => {
    expect(REPORT_TYPES.training.payloadSchema.safeParse({ reason: "prix_trompeur" }).success).toBe(true);
  });
  it("rejette une raison inconnue", () => {
    expect(REPORT_TYPES.training.payloadSchema.safeParse({ reason: "invalide" }).success).toBe(false);
  });
});

describe("translation payloadSchema", () => {
  it("accepte une cible DB (model+recordId+field)", () => {
    const r = REPORT_TYPES.translation.payloadSchema.safeParse({
      locale: "nl", model: "News", recordId: "abc", field: "title",
      sourceText: "Titre FR", suggestedText: "NL titel",
    });
    expect(r.success).toBe(true);
  });
  it("accepte une cible UI (uiKey)", () => {
    const r = REPORT_TYPES.translation.payloadSchema.safeParse({
      locale: "nl", uiKey: "public.home.heroTitle",
      sourceText: "Titre FR", suggestedText: "NL titel",
    });
    expect(r.success).toBe(true);
  });
  it("rejette si ni cible DB ni uiKey", () => {
    const r = REPORT_TYPES.translation.payloadSchema.safeParse({
      locale: "nl", sourceText: "Titre FR", suggestedText: "NL titel",
    });
    expect(r.success).toBe(false);
  });
});

describe("riolex_article payloadSchema", () => {
  it("exige loi et articleNumber", () => {
    expect(REPORT_TYPES.riolex_article.payloadSchema.safeParse({ loi: "AR 25/11/1991", articleNumber: "45" }).success).toBe(true);
    expect(REPORT_TYPES.riolex_article.payloadSchema.safeParse({ loi: "AR 25/11/1991" }).success).toBe(false);
  });
});
