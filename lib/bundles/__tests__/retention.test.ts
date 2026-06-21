import { describe, it, expect } from "vitest";
import {
  retentionCutoffs,
  ANONYMIZE_DAYS,
  HARD_DELETE_DAYS,
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
