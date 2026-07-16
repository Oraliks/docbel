import { describe, expect, it } from "vitest";
import { validateTransferDate } from "../transfer-date-validation";

describe("validateTransferDate", () => {
  const today = "2026-07-16";
  it("refuse une date passée pour une nouvelle demande", () => {
    expect(validateTransferDate({ effectiveDate: "2026-07-15", today })).toMatchObject({ ok: false, kind: "past-not-allowed" });
  });
  it("autorise une date passée pour révision/régularisation", () => {
    expect(validateTransferDate({ effectiveDate: "2026-07-01", today, isRevisionOrRegularisation: true })).toMatchObject({ ok: true, kind: "past-allowed" });
  });
  it("autorise aujourd'hui et une date future", () => {
    expect(validateTransferDate({ effectiveDate: today, today }).ok).toBe(true);
    expect(validateTransferDate({ effectiveDate: "2026-08-01", today }).ok).toBe(true);
  });
  it("refuse les dates inexistantes", () => {
    expect(validateTransferDate({ effectiveDate: "2026-02-30", today })).toMatchObject({ ok: false, kind: "invalid" });
  });
});
