import type { Prisma, PrismaClient } from "@prisma/client";

import { addDaysYmd } from "./dates";

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 1_000;

export const WAITLIST_RETENTION_ENV = {
  mode: "BOOKING_WAITLIST_RETENTION_MODE",
  anonymizeDays: "BOOKING_WAITLIST_ANONYMIZE_AFTER_DAYS",
  deleteDays: "BOOKING_WAITLIST_DELETE_AFTER_DAYS",
  batchSize: "BOOKING_WAITLIST_RETENTION_BATCH_SIZE",
} as const;

export type WaitlistRetentionMode = "disabled" | "dry-run" | "apply";

export type WaitlistRetentionConfig =
  | { mode: "disabled" }
  | {
      mode: "dry-run" | "apply";
      anonymizeAfterDays: number;
      deleteAfterDays: number;
      batchSize: number;
    };

export type WaitlistRetentionResult =
  | { mode: "disabled" }
  | {
      mode: "dry-run" | "apply";
      cutoffs: { anonymizeBefore: string; deleteBefore: string };
      inventory: { anonymize: number; delete: number };
      processed: { anonymized: number; deleted: number };
      batchSize: number;
    };

type WaitlistRepository = Pick<
  PrismaClient["bookingWaitlist"],
  "count" | "findMany" | "deleteMany" | "updateMany"
>;

function parsePositiveInteger(name: string, raw: string | undefined, maximum?: number): number {
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error(`${name} doit être un entier positif explicite`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || (maximum !== undefined && value > maximum)) {
    const suffix = maximum === undefined ? "" : ` (maximum ${maximum})`;
    throw new Error(`${name} doit être un entier positif valide${suffix}`);
  }
  return value;
}

/**
 * La politique métier n'est pas implicite : sans mode, le traitement Waitlist
 * est désactivé. Tout mode actif exige des durées explicites et cohérentes.
 */
export function parseWaitlistRetentionConfig(
  env: Record<string, string | undefined> = process.env,
): WaitlistRetentionConfig {
  const rawMode = env[WAITLIST_RETENTION_ENV.mode]?.trim();
  if (!rawMode || rawMode === "disabled") return { mode: "disabled" };
  if (rawMode !== "dry-run" && rawMode !== "apply") {
    throw new Error(`${WAITLIST_RETENTION_ENV.mode} doit valoir disabled, dry-run ou apply`);
  }

  const anonymizeAfterDays = parsePositiveInteger(
    WAITLIST_RETENTION_ENV.anonymizeDays,
    env[WAITLIST_RETENTION_ENV.anonymizeDays],
  );
  const deleteAfterDays = parsePositiveInteger(
    WAITLIST_RETENTION_ENV.deleteDays,
    env[WAITLIST_RETENTION_ENV.deleteDays],
  );
  if (deleteAfterDays <= anonymizeAfterDays) {
    throw new Error(
      `${WAITLIST_RETENTION_ENV.deleteDays} doit être strictement supérieur à ${WAITLIST_RETENTION_ENV.anonymizeDays}`,
    );
  }

  const batchSizeRaw = env[WAITLIST_RETENTION_ENV.batchSize]?.trim();
  const batchSize = batchSizeRaw
    ? parsePositiveInteger(WAITLIST_RETENTION_ENV.batchSize, batchSizeRaw, MAX_BATCH_SIZE)
    : DEFAULT_BATCH_SIZE;

  return { mode: rawMode, anonymizeAfterDays, deleteAfterDays, batchSize };
}

const personalOrNotificationData: Prisma.BookingWaitlistWhereInput[] = [
  { citizenName: { not: null } },
  { citizenNameNormalized: { not: null } },
  { citizenEmail: { not: null } },
  { citizenPhone: { not: null } },
  { citizenNrnHash: { not: null } },
  { citizenNrnLast4: { not: null } },
  { citizenPostalCode: { not: null } },
  { userId: { not: null } },
  { notifyToken: { not: null } },
  { notifiedAt: { not: null } },
  { status: { in: ["waiting", "notified"] } },
];

export function waitlistRetentionWhere(
  config: Exclude<WaitlistRetentionConfig, { mode: "disabled" }>,
  todayYmd: string,
) {
  const anonymizeBefore = addDaysYmd(todayYmd, -config.anonymizeAfterDays);
  const deleteBefore = addDaysYmd(todayYmd, -config.deleteAfterDays);
  const deleteWhere: Prisma.BookingWaitlistWhereInput = { date: { lt: deleteBefore } };
  const anonymizeWhere: Prisma.BookingWaitlistWhereInput = {
    date: { gte: deleteBefore, lt: anonymizeBefore },
    OR: personalOrNotificationData,
  };
  return { anonymizeBefore, deleteBefore, anonymizeWhere, deleteWhere };
}

/** Inventorie toujours avant d'écrire ; dry-run ne charge ni ne renvoie aucune PII. */
export async function runWaitlistRetention(
  repository: WaitlistRepository,
  config: WaitlistRetentionConfig,
  todayYmd: string,
): Promise<WaitlistRetentionResult> {
  if (config.mode === "disabled") return { mode: "disabled" };

  const { anonymizeBefore, deleteBefore, anonymizeWhere, deleteWhere } =
    waitlistRetentionWhere(config, todayYmd);
  const [anonymize, remove] = await Promise.all([
    repository.count({ where: anonymizeWhere }),
    repository.count({ where: deleteWhere }),
  ]);

  const base = {
    mode: config.mode,
    cutoffs: {
      anonymizeBefore,
      deleteBefore,
    },
    inventory: { anonymize, delete: remove },
    batchSize: config.batchSize,
  } as const;
  if (config.mode === "dry-run") {
    return { ...base, processed: { anonymized: 0, deleted: 0 } };
  }

  const deleteCandidates = await repository.findMany({
    where: deleteWhere,
    select: { id: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    take: config.batchSize,
  });
  const deleted = deleteCandidates.length
    ? await repository.deleteMany({
        where: {
          AND: [deleteWhere, { id: { in: deleteCandidates.map(({ id }) => id) } }],
        },
      })
    : { count: 0 };

  const anonymizeCandidates = await repository.findMany({
    where: anonymizeWhere,
    select: { id: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    take: config.batchSize,
  });
  const anonymized = anonymizeCandidates.length
    ? await repository.updateMany({
        where: {
          AND: [anonymizeWhere, { id: { in: anonymizeCandidates.map(({ id }) => id) } }],
        },
        data: {
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
        },
      })
    : { count: 0 };

  return {
    ...base,
    processed: { anonymized: anonymized.count, deleted: deleted.count },
  };
}
