import { describe, expect, it, vi } from "vitest";

import {
  parseWaitlistRetentionConfig,
  runWaitlistRetention,
  waitlistRetentionWhere,
} from "../waitlist-retention";

const activeConfig = {
  mode: "apply" as const,
  anonymizeAfterDays: 30,
  deleteAfterDays: 90,
  batchSize: 25,
};

function repository() {
  return {
    count: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  };
}

describe("BookingWaitlist retention configuration", () => {
  it("is disabled without an explicit opt-in", () => {
    expect(parseWaitlistRetentionConfig({})).toEqual({ mode: "disabled" });
    expect(parseWaitlistRetentionConfig({ BOOKING_WAITLIST_RETENTION_MODE: "disabled" }))
      .toEqual({ mode: "disabled" });
  });

  it("requires explicit, ordered durations for dry-run and apply", () => {
    expect(() => parseWaitlistRetentionConfig({
      BOOKING_WAITLIST_RETENTION_MODE: "dry-run",
    })).toThrow(/ANONYMIZE_AFTER_DAYS/);
    expect(() => parseWaitlistRetentionConfig({
      BOOKING_WAITLIST_RETENTION_MODE: "apply",
      BOOKING_WAITLIST_ANONYMIZE_AFTER_DAYS: "90",
      BOOKING_WAITLIST_DELETE_AFTER_DAYS: "30",
    })).toThrow(/strictement supérieur/);
    expect(() => parseWaitlistRetentionConfig({
      BOOKING_WAITLIST_RETENTION_MODE: "yes",
    })).toThrow(/disabled, dry-run ou apply/);
  });

  it("accepts a bounded batch and rejects an excessive one", () => {
    expect(parseWaitlistRetentionConfig({
      BOOKING_WAITLIST_RETENTION_MODE: "dry-run",
      BOOKING_WAITLIST_ANONYMIZE_AFTER_DAYS: "30",
      BOOKING_WAITLIST_DELETE_AFTER_DAYS: "90",
      BOOKING_WAITLIST_RETENTION_BATCH_SIZE: "12",
    })).toMatchObject({ mode: "dry-run", batchSize: 12 });
    expect(() => parseWaitlistRetentionConfig({
      BOOKING_WAITLIST_RETENTION_MODE: "dry-run",
      BOOKING_WAITLIST_ANONYMIZE_AFTER_DAYS: "30",
      BOOKING_WAITLIST_DELETE_AFTER_DAYS: "90",
      BOOKING_WAITLIST_RETENTION_BATCH_SIZE: "1001",
    })).toThrow(/maximum 1000/);
  });
});

describe("BookingWaitlist retention execution", () => {
  it("uses strict date boundaries and disjoint anonymization/deletion windows", () => {
    const where = waitlistRetentionWhere(activeConfig, "2026-09-27");
    expect(where.anonymizeBefore).toBe("2026-08-28");
    expect(where.deleteBefore).toBe("2026-06-29");
    expect(where.deleteWhere).toEqual({ date: { lt: "2026-06-29" } });
    expect(where.anonymizeWhere.date).toEqual({
      gte: "2026-06-29",
      lt: "2026-08-28",
    });
  });

  it("does not even inventory without opt-in", async () => {
    const db = repository();
    await expect(runWaitlistRetention(db as never, { mode: "disabled" }, "2026-09-27"))
      .resolves.toEqual({ mode: "disabled" });
    for (const call of Object.values(db)) expect(call).not.toHaveBeenCalled();
  });

  it("inventories counts only and never writes in dry-run", async () => {
    const db = repository();
    db.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    const result = await runWaitlistRetention(
      db as never,
      { ...activeConfig, mode: "dry-run" },
      "2026-09-27",
    );
    expect(result).toMatchObject({
      mode: "dry-run",
      inventory: { anonymize: 4, delete: 2 },
      processed: { anonymized: 0, deleted: 0 },
    });
    expect(db.findMany).not.toHaveBeenCalled();
    expect(db.deleteMany).not.toHaveBeenCalled();
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("covers phone-only, token-only, user links and notification state", async () => {
    const db = repository();
    db.count.mockResolvedValue(1);
    db.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "waitlist-1" }]);
    db.updateMany.mockResolvedValue({ count: 1 });

    await runWaitlistRetention(db as never, activeConfig, "2026-09-27");

    const inventoryWhere = db.count.mock.calls[0][0].where;
    expect(inventoryWhere.OR).toEqual(expect.arrayContaining([
      { citizenPhone: { not: null } },
      { notifyToken: { not: null } },
      { userId: { not: null } },
      { notifiedAt: { not: null } },
      { status: { in: ["waiting", "notified"] } },
    ]));

    const mutation = db.updateMany.mock.calls[0][0];
    expect(mutation.data).toMatchObject({
      citizenName: null,
      citizenNameNormalized: null,
      citizenEmail: null,
      citizenPhone: null,
      citizenNrnHash: null,
      citizenNrnLast4: null,
      citizenPostalCode: null,
      userId: null,
      notifiedAt: null,
      notifyToken: null,
      status: "expired",
    });
    for (const shared of ["tenantId", "locationId", "date", "startTime", "createdAt"]) {
      expect(mutation.data).not.toHaveProperty(shared);
    }
  });

  it("rechecks the deletion cutoff after selecting the bounded IDs", async () => {
    const db = repository();
    db.count.mockResolvedValue(1);
    db.findMany.mockResolvedValueOnce([{ id: "old-waitlist" }]).mockResolvedValueOnce([]);
    db.deleteMany.mockResolvedValue({ count: 1 });

    await runWaitlistRetention(db as never, activeConfig, "2026-09-27");

    expect(db.deleteMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { date: { lt: "2026-06-29" } },
          { id: { in: ["old-waitlist"] } },
        ],
      },
    });
  });

  it("is idempotent once no candidate remains", async () => {
    const db = repository();
    db.count.mockResolvedValue(0);
    db.findMany.mockResolvedValue([]);

    const first = await runWaitlistRetention(db as never, activeConfig, "2026-09-27");
    const second = await runWaitlistRetention(db as never, activeConfig, "2026-09-27");

    expect(first).toMatchObject({ processed: { anonymized: 0, deleted: 0 } });
    expect(second).toMatchObject({ processed: { anonymized: 0, deleted: 0 } });
    expect(db.updateMany).not.toHaveBeenCalled();
    expect(db.deleteMany).not.toHaveBeenCalled();
    expect(db.findMany).toHaveBeenCalledTimes(4);
  });
});
