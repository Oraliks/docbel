import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { Prisma, PrismaClient } from "@prisma/client"
import { NextRequest } from "next/server"
import { inventoryDataRetention, repairHistoricalData } from "./verify-data-retention"
import { ANONYMIZATION_RESET_FIELDS } from "../lib/bundles/retention"

// Dedicated empty database provisioned for this check; never accepts DATABASE_URL.
async function main() {
  const connection = JSON.parse(await readFile(".vercel/audit-test-connections.json", "utf8")).data as {
    databaseUrl: string; databaseName: string; marker: string
  }
  assert.match(connection.databaseName, /^docbel_audit_data_\d{8}_[a-f0-9]+$/)
  assert.equal(new URL(connection.databaseUrl).pathname.slice(1), connection.databaseName)
  process.env.DATABASE_URL = connection.databaseUrl
  process.env.DIRECT_URL = connection.databaseUrl
  process.env.CRON_SECRET = randomUUID()
  const db = new PrismaClient({ datasources: { db: { url: connection.databaseUrl } }, log: [] })
  const [identity] = await db.$queryRaw<{ database: string; marker: string }[]>`
    SELECT current_database() AS database, purpose AS marker FROM "_DocbelAuditIsolation"
  `
  assert.equal(identity.database, connection.databaseName)
  assert.equal(identity.marker, "data-retention-20260927")
  // Keep expected rollback diagnostics out of logs; use this guarded client.
  ;(globalThis as unknown as { prismaBase: PrismaClient }).prismaBase = db
  const { deleteUserAndPersonalData } = await import("../lib/users-delete")
  const { prisma: appDb } = await import("../lib/prisma")
  const bundleCron = await import("../app/api/cron/bundle-runs-purge/route")
  const bookingCron = await import("../app/api/cron/booking-purge/route")
  const pdfCron = await import("../app/api/admin/pdf/cron/purge-drafts/route")
  const prefix = `audit-${randomUUID()}`
  const subject = `${prefix}-subject`
  const other = `${prefix}-other`
  const orphan = `${prefix}-orphan`
  const bundleId = `${prefix}-bundle`
  const formId = `${prefix}-form`
  const tenantId = `${prefix}-tenant`
  const locationId = `${prefix}-location`
  const before = (days: number) => new Date(Date.now() - days * 86_400_000)
  const req = () => new NextRequest("https://example.invalid/api/cron/test", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const passed: string[] = []
  let blockerCreated = false
  try {
    for (const userId of [subject, other]) {
      await db.user.create({ data: { id: userId, name: "Synthetic retention fixture", email: `${userId}@example.invalid` } })
    }
    await db.documentBundle.create({ data: { id: bundleId, slug: bundleId, name: "Synthetic bundle" } })
    await db.pdfForm.create({ data: { id: formId, slug: formId, title: "Synthetic form", sourceStoragePath: "test://synthetic", sourceFileName: "synthetic.pdf", sourceByteSize: 0, sourceSha256: "synthetic" } })
    await db.bookingTenant.create({ data: { id: tenantId, slug: tenantId, name: "Synthetic tenant" } })
    await db.bookingLocation.create({ data: { id: locationId, tenantId, name: "Synthetic location" } })
    await db.userProfile.create({ data: { userId: subject, firstName: "Synthetic", iban: "synthetic-only" } })
    await db.pdfFormDraft.create({ data: { formId, userId: subject, payload: { synthetic: true }, expiresAt: before(-1) } })
    await db.account.create({ data: { id: `${prefix}-account`, userId: subject, providerId: "credential", accountId: subject, password: "synthetic-noncredential" } })
    await db.session.createMany({ data: [
      { id: `${prefix}-self`, token: randomUUID(), userId: subject, expiresAt: before(-1) },
      { id: `${prefix}-impersonated`, token: randomUUID(), userId: other, impersonatedBy: subject, expiresAt: before(-1) },
      { id: `${prefix}-keep`, token: randomUUID(), userId: other, expiresAt: before(-1) },
    ] })
    await db.bundleRun.create({ data: {
      id: `${prefix}-user-run`, bundleId, userId: subject, sessionId: "synthetic-session", resumeEmail: "fixture@example.invalid",
      payloads: { synthetic: true }, eligibilityAnswers: { synthetic: true }, orientationAnswers: { synthetic: true },
      completedTemplateIds: ["synthetic"], draftPayloads: { synthetic: true }, lastFormId: "synthetic", lastStepId: "synthetic", lastActiveField: "synthetic",
    } })
    await db.booking.create({ data: { id: `${prefix}-booking`, tenantId, locationId, date: "2099-01-01", startTime: "09:00", endTime: "10:00", confirmationToken: randomUUID(), userId: subject, citizenName: "Synthetic", formData: { synthetic: true } } })
    await db.bookingWaitlist.create({ data: { id: `${prefix}-waitlist`, tenantId, locationId, date: "2099-01-01", startTime: "09:00", userId: subject, citizenName: "Synthetic" } })

    // A real FK error at the final User deletion must roll back all earlier writes.
    await db.$executeRaw`CREATE TABLE "_DocbelAuditDeletionBlock" ("userId" TEXT PRIMARY KEY REFERENCES "User"(id) ON DELETE RESTRICT)`
    blockerCreated = true
    await db.$executeRaw`INSERT INTO "_DocbelAuditDeletionBlock" ("userId") VALUES (${subject})`
    await assert.rejects(deleteUserAndPersonalData(subject), (error: unknown) =>
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") ||
      (error instanceof Prisma.PrismaClientUnknownRequestError && error.message.includes("_DocbelAuditDeletionBlock_userId_fkey")))
    assert.equal(await db.userProfile.count({ where: { userId: subject } }), 1)
    assert.equal(await db.pdfFormDraft.count({ where: { userId: subject } }), 1)
    assert.equal(await db.session.count({ where: { OR: [{ userId: subject }, { impersonatedBy: subject }] } }), 2)
    assert.equal((await db.bundleRun.findUniqueOrThrow({ where: { id: `${prefix}-user-run` } })).userId, subject)
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: `${prefix}-booking` } })).userId, subject)
    passed.push("real foreign-key failure rolls back profile, draft, run, booking and session changes")
    await db.$executeRaw`DROP TABLE "_DocbelAuditDeletionBlock"`
    blockerCreated = false
    await deleteUserAndPersonalData(subject)
    assert.equal(await db.user.count({ where: { id: subject } }), 0)
    assert.equal(await db.account.count({ where: { userId: subject } }), 0)
    assert.equal(await db.userProfile.count({ where: { userId: subject } }), 0)
    assert.equal(await db.pdfFormDraft.count({ where: { userId: subject } }), 0)
    assert.equal(await db.session.count({ where: { OR: [{ userId: subject }, { impersonatedBy: subject }] } }), 0)
    assert.equal(await db.session.count({ where: { id: `${prefix}-keep` } }), 1)
    const deletedRun = await db.bundleRun.findUniqueOrThrow({ where: { id: `${prefix}-user-run` } })
    for (const [key, value] of Object.entries(ANONYMIZATION_RESET_FIELDS)) {
      assert.deepEqual(deletedRun[key as keyof typeof deletedRun], value === Prisma.DbNull ? null : value)
    }
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: `${prefix}-booking` } })).userId, null)
    const retainedWaitlist = await db.bookingWaitlist.findUniqueOrThrow({ where: { id: `${prefix}-waitlist` } })
    assert.equal(retainedWaitlist.userId, null)
    assert.equal(retainedWaitlist.citizenName, "Synthetic")
    passed.push("real account deletion cascades, revokes impersonations, anonymizes runs and only detaches booking references")

    const oldActivity = before(70)
    const draftActivity = before(8)
    await db.bundleRun.createMany({ data: [
      { id: `${prefix}-old-run`, bundleId, userId: other, updatedAt: oldActivity, payloads: { synthetic: true }, draftPayloads: { synthetic: true } },
      { id: `${prefix}-old-draft`, bundleId, updatedAt: draftActivity, payloads: { keep: true }, draftPayloads: { synthetic: true } },
      { id: `${prefix}-expired-run`, bundleId, updatedAt: before(181) },
      { id: `${prefix}-fresh-run`, bundleId, updatedAt: before(1), draftPayloads: { keep: true } },
    ] })
    // Authentication failure must leave all retention candidates untouched.
    const unauth = new NextRequest("https://example.invalid/api/cron/test")
    for (const cron of [bundleCron, bookingCron, pdfCron]) assert.equal((await cron.GET(unauth)).status, 403)
    assert.equal(await db.bundleRun.count({ where: { id: `${prefix}-expired-run` } }), 1)
    const bundleResult = await bundleCron.GET(req())
    assert.equal(bundleResult.status, 200)
    assert.deepEqual(await bundleResult.json(), { ok: true, deleted: 1, anonymized: 1, draftPurged: 1 })
    const minimized = await db.bundleRun.findUniqueOrThrow({ where: { id: `${prefix}-old-run` } })
    assert.equal(minimized.updatedAt.getTime(), oldActivity.getTime())
    for (const [key, value] of Object.entries(ANONYMIZATION_RESET_FIELDS)) assert.deepEqual(minimized[key as keyof typeof minimized], value === Prisma.DbNull ? null : value)
    const draft = await db.bundleRun.findUniqueOrThrow({ where: { id: `${prefix}-old-draft` } })
    assert.equal(draft.updatedAt.getTime(), draftActivity.getTime())
    assert.equal(draft.draftPayloads, null)
    assert.deepEqual(draft.payloads, { keep: true })
    assert.deepEqual((await db.bundleRun.findUniqueOrThrow({ where: { id: `${prefix}-fresh-run` } })).draftPayloads, { keep: true })
    assert.deepEqual(await (await bundleCron.GET(req())).json(), { ok: true, deleted: 0, anonymized: 0, draftPurged: 0 })
    passed.push("bundle cron authenticates, preserves inactivity timestamp and validated payloads, and is idempotent")

    await db.booking.create({ data: {
      id: `${prefix}-old-booking`, tenantId, locationId, date: before(190).toISOString().slice(0, 10), startTime: "09:00", endTime: "10:00", confirmationToken: randomUUID(),
      citizenName: null, userId: other, citizenEmail: "fixture@example.invalid", internalNote: "Synthetic note", cancelReason: "Synthetic reason", rejectionReason: "Synthetic reason", formData: { synthetic: true },
    } })
    assert.deepEqual(await (await bookingCron.GET(req())).json(), { ok: true, deleted: 0, anonymized: 1 })
    const booking = await db.booking.findUniqueOrThrow({ where: { id: `${prefix}-old-booking` } })
    for (const key of ["userId", "citizenEmail", "internalNote", "cancelReason", "rejectionReason"] as const) assert.equal(booking[key], null)
    assert.deepEqual(booking.formData, {})
    assert.deepEqual(await (await bookingCron.GET(req())).json(), { ok: true, deleted: 0, anonymized: 0 })
    await db.booking.update({ where: { id: `${prefix}-old-booking` }, data: { citizenPhone: "synthetic-phone-only" } })
    assert.equal((await inventoryDataRetention(db)).bookingsPastMinimization, 1)
    assert.deepEqual(await (await bookingCron.GET(req())).json(), { ok: true, deleted: 0, anonymized: 1 })
    assert.equal((await inventoryDataRetention(db)).bookingsPastMinimization, 0)
    passed.push("booking minimization repairs already nameless records including free-text notes and account link")
    await db.pdfFormDraft.create({ data: { formId, userId: other, expiresAt: before(1), payload: { synthetic: true } } })
    assert.deepEqual(await (await pdfCron.GET(req())).json(), { purgedDrafts: 1 })
    passed.push("PDF cron removes expired drafts after authentication")

    await db.userProfile.create({ data: { userId: orphan, firstName: "Synthetic orphan" } })
    const historicalRun = await db.bundleRun.update({ where: { id: `${prefix}-old-run` }, data: { userId: other } })
    const inventory = await inventoryDataRetention(db)
    assert.equal(inventory.orphanProfiles, 1)
    assert.equal(inventory.anonymizedRunsStillLinked, 1)
    const dry = await repairHistoricalData(db, { apply: false, maxRows: 10 })
    assert.equal(dry.deletedProfiles, 0)
    assert.equal(await db.userProfile.count({ where: { userId: orphan } }), 1)
    await assert.rejects(repairHistoricalData(db, { apply: true, maxRows: 1, reviewToken: dry.reviewToken }), /exceeds max-rows/)
    await assert.rejects(repairHistoricalData(db, { apply: true, maxRows: 10, reviewToken: "0".repeat(64) }), /does not match/)
    const repaired = await repairHistoricalData(db, { apply: true, maxRows: 10, reviewToken: dry.reviewToken })
    assert.equal(repaired.deletedProfiles, 1)
    assert.equal(repaired.unlinkedRuns, 1)
    assert.equal((await db.bundleRun.findUniqueOrThrow({ where: { id: historicalRun.id } })).updatedAt.getTime(), historicalRun.updatedAt.getTime())
    const empty = await repairHistoricalData(db, { apply: false, maxRows: 10 })
    assert.equal(empty.orphanProfiles, 0)
    assert.equal(empty.anonymizedRunsStillLinked, 0)
    const replay = await repairHistoricalData(db, { apply: true, maxRows: 10, reviewToken: empty.reviewToken })
    assert.equal(replay.deletedProfiles + replay.unlinkedRuns, 0)
    passed.push("historical repair dry-run, count cap, reviewed inventory token and idempotent apply verified")
    console.log(JSON.stringify({ isolatedDatabase: connection.databaseName, checksPassed: passed.length, checks: passed }, null, 2))
  } finally {
    if (blockerCreated) await db.$executeRaw`DROP TABLE "_DocbelAuditDeletionBlock"`
    await db.booking.deleteMany({ where: { tenantId } })
    await db.bookingWaitlist.deleteMany({ where: { tenantId } })
    await db.bookingTenant.deleteMany({ where: { id: tenantId } })
    await db.documentBundle.deleteMany({ where: { id: bundleId } })
    await db.pdfForm.deleteMany({ where: { id: formId } })
    await db.userProfile.deleteMany({ where: { userId: { in: [subject, other, orphan] } } })
    await db.user.deleteMany({ where: { id: { in: [subject, other] } } })
    await appDb.$disconnect()
    await db.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "Isolated database check failed")
  process.exitCode = 1
})
