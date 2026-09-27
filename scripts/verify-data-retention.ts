import { createHash } from "node:crypto"
import { pathToFileURL } from "node:url"
import { Prisma, PrismaClient } from "@prisma/client"
import { retentionCutoffs } from "../lib/bundles/retention"
import { addDaysYmd, brusselsNowParts } from "../lib/booking/dates"

type CounterRow = Record<string, bigint>

/** Counters only: this inventory never returns identity fields or payloads. */
export async function inventoryDataRetention(db: PrismaClient, now = new Date()) {
  const { anonymizeBefore, deleteBefore, draftBefore } = retentionCutoffs(now)
  const today = brusselsNowParts(now).ymd
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const [rows] = await tx.$queryRaw<CounterRow[]>`
      SELECT
        (SELECT count(*) FROM "UserProfile" p WHERE NOT EXISTS
          (SELECT 1 FROM "User" u WHERE u.id = p."userId")) AS "orphanProfiles",
        (SELECT count(*) FROM "PdfFormDraft" p WHERE NOT EXISTS
          (SELECT 1 FROM "User" u WHERE u.id = p."userId")) AS "orphanPdfDrafts",
        (SELECT count(*) FROM "BundleRun" WHERE "anonymizedAt" IS NOT NULL
          AND "userId" IS NOT NULL) AS "anonymizedRunsStillLinked",
        (SELECT count(*) FROM "PdfFormDraft" WHERE "expiresAt" < ${now}) AS "expiredPdfDrafts",
        (SELECT count(*) FROM "BundleRun" WHERE "updatedAt" < ${deleteBefore}) AS "runsPastDeletion",
        (SELECT count(*) FROM "BundleRun" WHERE "updatedAt" < ${anonymizeBefore}
          AND "anonymizedAt" IS NULL) AS "runsPastAnonymization",
        (SELECT count(*) FROM "BundleRun" WHERE "updatedAt" < ${draftBefore}
          AND "draftPayloads" IS NOT NULL) AS "runsWithExpiredDrafts",
        (SELECT count(*) FROM "Booking" WHERE date < ${addDaysYmd(today, -730)}) AS "bookingsPastDeletion",
        (SELECT count(*) FROM "Booking" WHERE date < ${addDaysYmd(today, -180)} AND
          ("citizenName" IS NOT NULL OR "citizenNameNormalized" IS NOT NULL
           OR "citizenEmail" IS NOT NULL OR "citizenPhone" IS NOT NULL
           OR "citizenNrnHash" IS NOT NULL OR "citizenNrnLast4" IS NOT NULL
           OR "citizenNrnEnc" IS NOT NULL OR "citizenPostalCode" IS NOT NULL
           OR "citizenCommuneId" IS NOT NULL OR "userId" IS NOT NULL OR "internalNote" IS NOT NULL
           OR "cancelReason" IS NOT NULL OR "rejectionReason" IS NOT NULL
           OR "formData" <> '{}'::jsonb)) AS "bookingsPastMinimization",
        (SELECT count(*) FROM "BookingWaitlist" WHERE date < ${addDaysYmd(today, -730)}) AS "waitlistPastDeletion",
        (SELECT count(*) FROM "BookingWaitlist" WHERE date < ${addDaysYmd(today, -180)} AND
          ("citizenName" IS NOT NULL OR "citizenNameNormalized" IS NOT NULL
           OR "citizenEmail" IS NOT NULL OR "citizenPhone" IS NOT NULL OR "userId" IS NOT NULL
           OR "citizenNrnHash" IS NOT NULL OR "citizenNrnLast4" IS NOT NULL
           OR "citizenPostalCode" IS NOT NULL OR "notifyToken" IS NOT NULL)) AS "waitlistPastMinimization"
    `
    return Object.fromEntries(Object.entries(rows).map(([key, count]) => [key, Number(count)]))
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 })
}

export interface RepairOptions {
  apply: boolean
  maxRows: number
  reviewToken?: string
}

export function parseRepairOptions(args: string[]): RepairOptions {
  const known = /^(--dry-run|--apply|--max-rows=\d+|--review-token=[a-f0-9]{64})$/
  if (args.some((arg) => !known.test(arg))) throw new Error("Unknown argument")
  if (args.includes("--dry-run") && args.includes("--apply")) throw new Error("Choose dry-run or apply")
  if (new Set(args.map((arg) => arg.split("=")[0])).size !== args.length) throw new Error("Duplicate argument")
  const maxRows = Number(args.find((arg) => arg.startsWith("--max-rows="))?.split("=")[1] ?? 500)
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 5000) throw new Error("max-rows must be 1..5000")
  const apply = args.includes("--apply")
  const reviewToken = args.find((arg) => arg.startsWith("--review-token="))?.split("=")[1]
  if (apply && !reviewToken) throw new Error("Apply requires the review-token from a reviewed dry-run")
  return { apply, maxRows, reviewToken }
}

/** Only repairs the two historical defects; this does not trigger retention purges. */
export async function repairHistoricalData(db: PrismaClient, options: RepairOptions) {
  return db.$transaction(async (tx) => {
    if (!options.apply) await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const profiles = await tx.$queryRaw<{ userId: string }[]>`
      SELECT p."userId" FROM "UserProfile" p WHERE NOT EXISTS
        (SELECT 1 FROM "User" u WHERE u.id = p."userId")
      ORDER BY p."userId" LIMIT ${options.maxRows + 1}
    `
    const runs = await tx.bundleRun.findMany({
      where: { anonymizedAt: { not: null }, userId: { not: null } },
      select: { id: true, userId: true, updatedAt: true },
      orderBy: { id: "asc" }, take: options.maxRows + 1,
    })
    const limitReached = profiles.length + runs.length > options.maxRows
    // Include the target DB identity without exposing its URL or credentials.
    const [identity] = await tx.$queryRaw<{ database: string; schema: string }[]>`
      SELECT current_database() AS database, current_schema() AS schema
    `
    const reviewToken = createHash("sha256").update(JSON.stringify({ identity, profiles, runs })).digest("hex")
    const report = { orphanProfiles: profiles.length, anonymizedRunsStillLinked: runs.length, limitReached, reviewToken }
    if (!options.apply) return { mode: "dry-run", ...report, deletedProfiles: 0, unlinkedRuns: 0 }
    if (limitReached) throw new Error("Refusing apply: candidate count exceeds max-rows")
    if (options.reviewToken !== reviewToken) throw new Error("Refusing apply: inventory changed or review-token does not match")
    let deletedProfiles = 0
    let unlinkedRuns = 0
    if (profiles.length) {
      deletedProfiles = await tx.$executeRaw`
        DELETE FROM "UserProfile" p WHERE p."userId" IN (${Prisma.join(profiles.map((p) => p.userId))})
          AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = p."userId")
      `
    }
    if (runs.length) {
      // Raw UPDATE deliberately preserves updatedAt: cleanup is not user activity.
      unlinkedRuns = await tx.$executeRaw`
        UPDATE "BundleRun" SET "userId" = NULL
        WHERE id IN (${Prisma.join(runs.map((run) => run.id))})
          AND "anonymizedAt" IS NOT NULL AND "userId" IS NOT NULL
      `
    }
    return { mode: "apply", ...report, deletedProfiles, unlinkedRuns }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 })
}

async function main() {
  const options = parseRepairOptions(process.argv.slice(2))
  const db = new PrismaClient({ log: [] })
  try {
    console.log(JSON.stringify({ asOf: new Date().toISOString(), inventory: await inventoryDataRetention(db), repair: await repairHistoricalData(db, options) }, null, 2))
  } finally {
    await db.$disconnect()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    // Prisma diagnostics can contain connection details or row values.
    const safe = error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "Database operation failed; no row data printed"
    console.error(safe)
    process.exitCode = 1
  })
}
