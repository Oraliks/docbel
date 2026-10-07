import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  retentionCutoffs,
  ANONYMIZE_DAYS,
  HARD_DELETE_DAYS,
  ANONYMIZATION_RESET_FIELDS,
} from "../retention";

const DAY = 86_400_000;
const daysBetween = (a: Date, b: Date) =>
  Math.round((a.getTime() - b.getTime()) / DAY);

describe("retentionCutoffs", () => {
  it("calcule les seuils par défaut (anonymisation avant suppression)", () => {
    const now = new Date("2026-06-21T00:00:00.000Z");
    const { anonymizeBefore, deleteBefore } = retentionCutoffs(now);
    expect(daysBetween(now, anonymizeBefore)).toBe(ANONYMIZE_DAYS);
    expect(daysBetween(now, deleteBefore)).toBe(HARD_DELETE_DAYS);
    // La suppression remonte plus loin dans le passé que l'anonymisation.
    expect(deleteBefore.getTime()).toBeLessThan(anonymizeBefore.getTime());
  });

  it("accepte des fenêtres personnalisées", () => {
    const now = new Date("2026-06-21T00:00:00.000Z");
    const { anonymizeBefore, deleteBefore } = retentionCutoffs(now, 10, 20);
    expect(daysBetween(now, anonymizeBefore)).toBe(10);
    expect(daysBetween(now, deleteBefore)).toBe(20);
  });
});

describe("ANONYMIZATION_RESET_FIELDS", () => {
  it("vide les réponses d'orientation et la décision réglementaire associée", () => {
    expect(ANONYMIZATION_RESET_FIELDS.orientationAnswers).toBe(Prisma.DbNull);
    expect(ANONYMIZATION_RESET_FIELDS.regulatoryDecisionSnapshot).toBe(Prisma.DbNull);
  });

  it("vide aussi les repères pseudonymes et le brouillon en cours", () => {
    expect(ANONYMIZATION_RESET_FIELDS.draftPayloads).toBe(Prisma.DbNull);
    expect(ANONYMIZATION_RESET_FIELDS.resumeEmail).toBeNull();
    expect(ANONYMIZATION_RESET_FIELDS.sessionId).toBeNull();
    expect(ANONYMIZATION_RESET_FIELDS.resumeCode).toBeNull();
    expect(ANONYMIZATION_RESET_FIELDS.resumeCodeHash).toBeNull();
  });

  it("retire le rattachement au compte d'un dossier connecté", () => {
    const run = {
      userId: "user-to-anonymize",
      sessionId: "session-to-anonymize",
      payloads: { form: { firstName: "Exemple" } },
    };
    const anonymized = { ...run, ...ANONYMIZATION_RESET_FIELDS };
    expect(anonymized.userId).toBeNull();
    expect(anonymized.sessionId).toBeNull();
    expect(anonymized.payloads).toEqual({});
  });
});
