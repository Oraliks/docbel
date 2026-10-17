/** PostgreSQL réel, exclusivement sur une base locale jetable explicitement marquée. */
import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { PrismaClient, Prisma, UserStatus } from "@prisma/client"

const marker = "baremes-concurrency-20261017"
const name = process.env.DOCBEL_BAREMES_TEST_DATABASE_NAME
const url = process.env.DOCBEL_BAREMES_TEST_DATABASE_URL
assert.equal(process.env.NODE_ENV, "test", "La recette doit être exécutée avec NODE_ENV=test")
assert(name && /^docbel_baremes_test_[a-z0-9_]+$/.test(name), "Nom de base Barèmes jetable requis")
assert(url, "URL PostgreSQL Barèmes jetable requise")
const parsed = new URL(url)
assert(["postgres:", "postgresql:"].includes(parsed.protocol), "PostgreSQL requis")
assert.equal(parsed.hostname, "127.0.0.1", "La recette refuse toute base non locale")
assert.equal(decodeURIComponent(parsed.pathname.slice(1)), name, "URL et nom de base doivent correspondre")

process.env.DATABASE_URL = url
process.env.DIRECT_URL = url
process.env.BETTER_AUTH_SECRET ??= "baremes-test-only-secret-not-for-production"
const db = new PrismaClient({ datasources: { db: { url } } })
;(globalThis as unknown as { prismaBase: PrismaClient }).prismaBase = db

const prefix = `baremes-pg-${randomUUID()}`
const past = new Date("2026-09-01T00:00:00.000Z")
const results: string[] = []
const workbookPath = "C:\\Users\\Admin\\AppData\\Local\\Temp\\docbel-onem-barema20260901-new.xlsx"
const workbookHash = "a237c1a2a26f05249f8177700844a375ac5508e256e1db82e2279964226151f0"

async function draft(fileType: string, overrides: Record<string, unknown> = {}) {
  return db.baremeFile.create({ data: {
    name: `${prefix}-${fileType}.xlsx`, filePath: `test://${prefix}/${fileType}.xlsx`, effectiveDate: "01/09/2026",
    fileType, status: "draft", validFrom: past, fileHash: `${prefix}-${randomUUID()}`, fileSize: 1,
    alerts: [], ...overrides,
  } })
}

async function installInsertFailure(fileName: string) {
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION baremes_runner_fail_insert() RETURNS trigger AS $$
    BEGIN
      IF NEW.name = '${fileName.replace(/'/g, "''")}' THEN
        RAISE EXCEPTION 'baremes runner forced PostgreSQL transaction failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS baremes_runner_fail_insert ON "BaremeFile"')
  await db.$executeRawUnsafe(
    'CREATE TRIGGER baremes_runner_fail_insert BEFORE INSERT ON "BaremeFile" FOR EACH ROW EXECUTE FUNCTION baremes_runner_fail_insert()'
  )
}

async function removeInsertFailure() {
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS baremes_runner_fail_insert ON "BaremeFile"')
  await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS baremes_runner_fail_insert()')
}

async function main() {
  const identity = await db.$queryRaw<{ database: string; marker: string }[]>`
    SELECT current_database() AS database, purpose AS marker FROM "_DocbelAuditIsolation"
  `
  assert.equal(identity.length, 1)
  assert.equal(identity[0].database, name)
  assert.equal(identity[0].marker, marker)

  const { publishBaremeImport, rollbackToVersion } = await import("../lib/baremes/publishBaremeImport")
  const { approveBaremeImport } = await import("../lib/baremes/approveBaremeImport")
  const { importBaremeFile } = await import("../lib/baremes/importBaremeFile")
  const { getActiveBaremeData } = await import("../lib/baremes/getActiveBaremeData")
  const { withBlobStorageTestAdapter } = await import("../lib/storage/blob-storage")
  const { withAdminAuthTestOverride } = await import("../lib/auth-check")
  const { NextRequest, NextResponse } = await import("next/server")
  const { GET: downloadSource } = await import("../app/api/baremes/import/[id]/source/route")
  const { GET: exportBaremes } = await import("../app/api/baremes/export/route")
  const workbook = await readFile(workbookPath)
  assert.equal(workbook.byteLength, 201084)
  assert.equal(createHash("sha256").update(workbook).digest("hex"), workbookHash)

  const blobs = new Map<string, Buffer>()
  const storage = {
    failSave: false, failDelete: false, saveCalls: 0, deleteCalls: 0, getCalls: 0,
    async save(bytes: Buffer, key: string, isPrivate: boolean) {
      this.saveCalls += 1
      assert.equal(isPrivate, true)
      if (this.failSave) throw new Error("baremes runner forced storage upload failure")
      const path = `blobs:https://fixture.private.blob.vercel-storage.com/${key}`
      blobs.set(path, Buffer.from(bytes))
      return path
    },
    async get(filePath: string) {
      this.getCalls += 1
      const value = blobs.get(filePath)
      return value ? Buffer.from(value) : null
    },
    async delete(filePath: string) {
      this.deleteCalls += 1
      if (this.failDelete) throw new Error("baremes runner forced storage cleanup failure")
      blobs.delete(filePath)
    },
  }
  return withBlobStorageTestAdapter(storage, async () => {

  const preservedPath = `blobs:https://fixture.private.blob.vercel-storage.com/private/baremes/${prefix}-preserved.xlsx`
  const preservedBytes = Buffer.from("preserved runner source")
  blobs.set(preservedPath, preservedBytes)
  const preserved = await draft("preserved", { filePath: preservedPath })
  const baselineFiles = await db.baremeFile.count()

  storage.failSave = true
  const savesBeforeStorageFailure = storage.saveCalls
  await assert.rejects(
    () => importBaremeFile({ buffer: workbook, fileName: "barema20260901-new.xlsx", createdBy: "runner@example.test" }),
    /Conservation durable du fichier source impossible/
  )
  assert.equal(storage.saveCalls, savesBeforeStorageFailure + 1)
  assert.equal(await db.baremeFile.count(), baselineFiles)
  assert.equal(await db.baremeAmount.count(), 0)
  assert.equal(blobs.size, 1)
  assert.equal(blobs.get(preservedPath)?.equals(preservedBytes), true)
  storage.failSave = false
  results.push("échec stockage : upload atteint, erreur explicite, aucune écriture DB ni source partielle")

  const dbFailureName = "barema20260901-db-failure.xlsx"
  await installInsertFailure(dbFailureName)
  const savesBeforeDbFailure = storage.saveCalls
  const deletesBeforeDbFailure = storage.deleteCalls
  await assert.rejects(
    () => importBaremeFile({ buffer: workbook, fileName: dbFailureName, createdBy: "runner@example.test" }),
    /baremes runner forced PostgreSQL transaction failure/
  )
  await removeInsertFailure()
  assert.equal(storage.saveCalls, savesBeforeDbFailure + 1)
  assert.equal(storage.deleteCalls, deletesBeforeDbFailure + 1)
  assert.equal(await db.baremeFile.count(), baselineFiles)
  assert.equal(await db.baremeAmount.count(), 0)
  assert.equal(blobs.size, 1)
  assert.equal((await db.baremeFile.findUnique({ where: { id: preserved.id } }))?.filePath, preservedPath)
  assert.equal(blobs.get(preservedPath)?.equals(preservedBytes), true)
  results.push("échec PostgreSQL après upload : trigger transactionnel, rollback DB et suppression de l'orphelin")

  const cleanupFailureName = "barema20260901-cleanup-failure.xlsx"
  await installInsertFailure(cleanupFailureName)
  storage.failDelete = true
  const cleanupDiagnostics: unknown[][] = []
  const previousConsoleError = console.error
  console.error = (...args: unknown[]) => { cleanupDiagnostics.push(args) }
  try {
    await assert.rejects(
      () => importBaremeFile({ buffer: workbook, fileName: cleanupFailureName, createdBy: "runner@example.test" }),
      /baremes runner forced PostgreSQL transaction failure/
    )
  } finally {
    console.error = previousConsoleError
    storage.failDelete = false
    await removeInsertFailure()
  }
  const orphanPath = `blobs:https://fixture.private.blob.vercel-storage.com/private/baremes/${workbookHash}-${cleanupFailureName}`
  assert.equal(await db.baremeFile.count(), baselineFiles)
  assert.equal(await db.baremeAmount.count(), 0)
  assert.equal(blobs.get(orphanPath)?.equals(workbook), true)
  assert(cleanupDiagnostics.some((entry) => String(entry[0]).includes("impossible de nettoyer le Blob orphelin")))
  await storage.delete(orphanPath)
  assert.equal(blobs.has(orphanPath), false)
  assert.equal(blobs.get(preservedPath)?.equals(preservedBytes), true)
  results.push("échec nettoyage : cause PostgreSQL préservée, diagnostic observé, orphelin de fixture nettoyé explicitement")

  const imported = await importBaremeFile({ buffer: workbook, fileName: "barema20260901-new.xlsx", createdBy: "runner@example.test" })
  assert.equal(imported.status, "created")
  if (imported.status !== "created") throw new Error("Import authentique inattendu")
  const importedFile = await db.baremeFile.findUniqueOrThrow({ where: { id: imported.fileId }, include: { sheets: { orderBy: { sheetIndex: "asc" } }, amounts: true } })
  assert.equal(importedFile.status, "draft")
  assert.equal(importedFile.fileHash, workbookHash)
  assert.equal(importedFile.fileSize, workbook.byteLength)
  assert.equal(importedFile.sheets.length, 12)
  assert.equal(importedFile.amounts.length, 6600)
  assert.equal(blobs.get(importedFile.filePath)?.equals(workbook), true)
  assert.equal((await importBaremeFile({ buffer: workbook, fileName: "barema20260901-new.xlsx" })).status, "duplicate")
  assert.equal(await db.baremeFile.count(), baselineFiles + 1)
  assert.equal((await publishBaremeImport(imported.fileId, { publishedBy: "a@example.test" })).status, "published")
  assert.equal((await getActiveBaremeData({ force: true }))?.allAmounts.length, 6600)
  results.push("import nominal authentique : 12 feuilles, 6600 montants, source mémoire et lecture active")

  let authResult: unknown = { isAuthorized: true, user: { id: "runner-admin", name: "Runner Admin", email: "runner@example.test", role: "admin", status: UserStatus.active } }
  await withAdminAuthTestOverride(async () => authResult as never, async () => {
  const sourceRequest = () => new NextRequest(`https://docbel.test/api/baremes/import/${imported.fileId}/source`)
  const sourceResponse = await downloadSource(sourceRequest(), { params: Promise.resolve({ id: imported.fileId }) })
  assert.equal(sourceResponse.status, 200)
  assert.equal(sourceResponse.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  assert.equal(sourceResponse.headers.get("cache-control"), "private, no-store")
  assert(sourceResponse.headers.get("content-disposition")?.includes("barema20260901-new.xlsx"))
  const downloaded = Buffer.from(await sourceResponse.arrayBuffer())
  assert.equal(downloaded.byteLength, workbook.byteLength)
  assert.equal(createHash("sha256").update(downloaded).digest("hex"), workbookHash)
  blobs.delete(importedFile.filePath)
  assert.equal((await downloadSource(sourceRequest(), { params: Promise.resolve({ id: imported.fileId }) })).status, 404)
  blobs.set(importedFile.filePath, workbook.subarray(0, workbook.byteLength - 1))
  assert.equal((await downloadSource(sourceRequest(), { params: Promise.resolve({ id: imported.fileId }) })).status, 409)
  const altered = Buffer.from(workbook); altered[0] ^= 1
  blobs.set(importedFile.filePath, altered)
  assert.equal((await downloadSource(sourceRequest(), { params: Promise.resolve({ id: imported.fileId }) })).status, 409)
  blobs.set(importedFile.filePath, Buffer.from(workbook))
  const readsBeforeDeniedAuth = storage.getCalls
  authResult = { isAuthorized: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  assert.equal((await downloadSource(sourceRequest(), { params: Promise.resolve({ id: imported.fileId }) })).status, 401)
  authResult = { isAuthorized: false, error: NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 }) }
  assert.equal((await downloadSource(sourceRequest(), { params: Promise.resolve({ id: imported.fileId }) })).status, 403)
  assert.equal(storage.getCalls, readsBeforeDeniedAuth)
  authResult = { isAuthorized: true, user: { id: "runner-admin", name: "Runner Admin", email: "runner@example.test", role: "admin", status: UserStatus.active } }
  results.push("route source : handler réel, octets/hash/taille/headers vérifiés; absence, corruption, anonyme et non-admin refusés")

  const basicSheet = importedFile.sheets.find((sheet) => sheet.name === "Basisbedragen")
  assert(basicSheet)
  const sheetExport = await exportBaremes(new NextRequest(`https://docbel.test/api/baremes/export?sheetId=${basicSheet.id}`))
  const sheetBytes = Buffer.from(await sheetExport.arrayBuffer())
  const sheetCsv = sheetBytes.toString("utf8")
  assert.equal(sheetExport.status, 200)
  assert.equal(sheetExport.headers.get("content-type"), "text/csv; charset=utf-8")
  assert(sheetExport.headers.get("content-disposition")?.includes("Basisbedragen.csv"))
  assert.equal(sheetBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), true)
  assert(sheetCsv.includes('"2,189.81"'))
  assert(!sheetCsv.includes("blobs:"))
  const allExport = await exportBaremes(new NextRequest(`https://docbel.test/api/baremes/export?fileId=${imported.fileId}`))
  const allCsv = await allExport.text()
  assert.equal(allExport.status, 200)
  assert.equal((allCsv.match(/^=== /gm) ?? []).length, 12)
  assert(allCsv.includes("=== Basisbedragen ==="))
  assert(!allCsv.includes(importedFile.filePath))

  const syntheticBytes = Buffer.from("synthetic baremes runner fixture")
  const syntheticPath = `blobs:https://fixture.private.blob.vercel-storage.com/private/baremes/${prefix}-synthetic.xlsx`
  blobs.set(syntheticPath, syntheticBytes)
  const synthetic = await db.baremeFile.create({ data: {
    name: `${prefix}-synthetic-B.xlsx`, filePath: syntheticPath, effectiveDate: "01/09/2026", fileType: "onem-rates", status: "draft", validFrom: past,
    fileHash: createHash("sha256").update(syntheticBytes).digest("hex"), fileSize: syntheticBytes.byteLength, alerts: [], createdBy: "runner@example.test",
    sheets: { create: { name: "Fixture B", category: "basic", rowCount: 2, colCount: 2, sheetIndex: 0, cellData: JSON.stringify([["Code", "Valeur"], ["B-SYN", "=not-a-formula"]]), searchText: "fixture b" } },
  }, include: { sheets: true } })
  const syntheticExport = await exportBaremes(new NextRequest(`https://docbel.test/api/baremes/export?sheetId=${synthetic.sheets[0].id}`))
  assert((await syntheticExport.text()).includes("'=not-a-formula"))
  results.push("routes export : filtres sheetId/fileId réels, 12 feuilles sans troncature, BOM/échappement et aucune métadonnée Blob")

  assert.equal((await publishBaremeImport(synthetic.id, { publishedBy: "b@example.test" })).status, "published")
  assert.equal((await db.baremeFile.findUniqueOrThrow({ where: { id: imported.fileId } })).status, "archived")
  assert.equal((await rollbackToVersion(imported.fileId, "c@example.test")).status, "rolled_back")
  const restored = await db.baremeFile.findUniqueOrThrow({ where: { id: imported.fileId } })
  assert.equal(restored.status, "published")
  assert.equal(restored.fileHash, workbookHash)
  assert.equal((await db.baremeFile.findUniqueOrThrow({ where: { id: synthetic.id } })).status, "archived")
  assert.equal(await db.baremeFile.count({ where: { fileType: "onem-rates", status: "published" } }), 1)
  assert.equal((await getActiveBaremeData({ force: true }))?.allAmounts.length, 6600)
  const restoredExport = await exportBaremes(new NextRequest(`https://docbel.test/api/baremes/export?fileId=${imported.fileId}`))
  assert((await restoredExport.text()).includes('"2,189.81"'))
  const restoredDownload = await downloadSource(sourceRequest(), { params: Promise.resolve({ id: imported.fileId }) })
  assert.equal(createHash("sha256").update(Buffer.from(await restoredDownload.arrayBuffer())).digest("hex"), workbookHash)
  const events = await db.baremePublicationLog.findMany({ where: { fileId: imported.fileId }, select: { action: true } })
  for (const action of ["created", "published", "archived", "rollback"]) assert(events.some((event) => event.action === action))
  results.push("rollback authentique : B synthétique publiée puis A restaurée, 6600 montants, export/source/hash et événements conformes")
  })

  const nominal = await draft("nominal")
  assert.equal((await publishBaremeImport(nominal.id, { publishedBy: "a@example.test" })).status, "published")
  assert.equal((await db.baremeFile.count({ where: { fileType: "nominal", status: "published" } })), 1)
  results.push("publication nominale")
  const approval = await draft("approval", { requiresApproval: true })
  assert.equal((await approveBaremeImport(approval.id, { approverEmail: "a@example.test" })).status, "recorded")
  assert.equal((await approveBaremeImport(approval.id, { approverEmail: "b@example.test" })).autoPublished, true)
  assert.equal((await db.baremeFile.findUniqueOrThrow({ where: { id: approval.id } })).status, "published")
  results.push("approbation à deux administrateurs")
  const future = await draft("future", { validFrom: new Date("2099-01-01T00:00:00.000Z") })
  assert.equal((await publishBaremeImport(future.id)).status, "error")
  assert.equal((await db.baremeFile.findUniqueOrThrow({ where: { id: future.id } })).status, "draft")
  results.push("refus de date future")
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX "BaremeFile_one_published_per_fileType" ON "BaremeFile" ("fileType") WHERE "status" = \'published\'')
  const familyA = await db.baremeFile.create({ data: { name: `${prefix}-a`, filePath: "test://a", effectiveDate: "01/09/2026", fileType: "index-a", status: "published", validFrom: past, fileHash: `${prefix}-a`, fileSize: 1 } })
  await db.baremeFile.create({ data: { name: `${prefix}-b`, filePath: "test://b", effectiveDate: "01/09/2026", fileType: "index-b", status: "published", validFrom: past, fileHash: `${prefix}-b`, fileSize: 1 } })
  await assert.rejects(() => db.baremeFile.create({ data: { name: `${prefix}-duplicate`, filePath: "test://d", effectiveDate: "01/09/2026", fileType: familyA.fileType, status: "published", validFrom: past, fileHash: `${prefix}-d`, fileSize: 1 } }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
  results.push("index unique partiel : familles distinctes autorisées, doublon refusé")
  const first = await draft("concurrent")
  const second = await draft("concurrent")
  const concurrent = await Promise.allSettled([publishBaremeImport(first.id), publishBaremeImport(second.id)])
  assert.equal(await db.baremeFile.count({ where: { fileType: "concurrent", status: "published" } }), 1)
  assert(concurrent.some((entry) => entry.status === "fulfilled" && entry.value.status === "published"))
  results.push("deux publications concurrentes : un seul publié final")
  const archived = await db.baremeFile.findFirstOrThrow({ where: { fileType: "nominal", status: "published" } })
  const replacement = await draft("nominal")
  assert.equal((await publishBaremeImport(replacement.id)).status, "published")
  assert.equal((await rollbackToVersion(archived.id)).status, "rolled_back")
  assert.equal(await db.baremeFile.count({ where: { fileType: "nominal", status: "published" } }), 1)
  results.push("publication puis rollback : une version active")
  console.log(JSON.stringify({ database: name, checks: results }, null, 2))
  })
}

main().finally(async () => {
  await removeInsertFailure().catch(() => undefined)
  await db.$executeRawUnsafe('DROP INDEX IF EXISTS "BaremeFile_one_published_per_fileType"')
  await db.baremeFile.deleteMany({ where: { OR: [{ name: { startsWith: prefix } }, { fileHash: workbookHash }] } })
  await db.$disconnect()
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Échec de recette PostgreSQL Barèmes")
  process.exitCode = 1
})
