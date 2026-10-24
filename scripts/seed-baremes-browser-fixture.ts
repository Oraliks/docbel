/** Fixture navigateur Barèmes : PostgreSQL local marqué uniquement. */
import assert from 'node:assert/strict'
import { hash } from 'bcryptjs'
import { Prisma, PrismaClient, UserRole, UserStatus } from '@prisma/client'

const url = process.env.DATABASE_URL
assert(url, 'DATABASE_URL locale requise')
const parsed = new URL(url)
assert.equal(parsed.hostname, '127.0.0.1', 'Cette fixture refuse toute base non locale')
assert.equal(parsed.pathname, '/docbel_baremes_browser_20261017', 'Base de recette exacte requise')
const db = new PrismaClient({ datasources: { db: { url } } })
;(globalThis as unknown as { prismaBase: PrismaClient }).prismaBase = db

const prefix = 'browser-baremes-review-'
const email = 'baremes-browser-admin@example.test'
const password = 'Fixture-Baremes-Review-2026!'

async function main() {
  const marker = await db.$queryRaw<Array<{ purpose: string }>>`SELECT purpose FROM "_DocbelAuditIsolation" WHERE purpose = ${'baremes-browser-20261017'}`
  assert.equal(marker.length, 1, 'Marqueur d’isolation absent')
  await db.baremeFile.deleteMany({ where: { name: { startsWith: prefix } } })
  await db.account.deleteMany({ where: { user: { email } } })
  await db.user.deleteMany({ where: { email } })
  const passwordHash = await hash(password, 10)
  const admin = await db.user.create({ data: {
    id: 'browser-baremes-admin', name: 'Administrateur Barèmes de recette', email,
    role: UserRole.admin, status: UserStatus.active, password: passwordHash, emailVerified: true,
    accounts: { create: { id: 'browser-baremes-admin-credential', accountId: 'browser-baremes-admin', providerId: 'credential', password: passwordHash } },
  } })
  const old = await db.baremeFile.create({ data: {
    name: `${prefix}A-reference-synthetique.xlsx`, filePath: 'test://browser/A.xlsx', effectiveDate: '01/09/2026',
    fileType: 'browser-review', status: 'published', validFrom: new Date('2026-09-01T00:00:00.000Z'),
    fileHash: 'browser-review-reference', fileSize: 1, alerts: [], createdBy: admin.email,
  } })
  const candidate = await db.baremeFile.create({ data: {
    name: `${prefix}B-candidate-synthetique.xlsx`, filePath: 'test://browser/B.xlsx', effectiveDate: '01/10/2026',
    fileType: 'browser-review', status: 'draft', validFrom: new Date('2026-10-01T00:00:00.000Z'),
    fileHash: 'browser-review-candidate', fileSize: 1, alerts: [], createdBy: admin.email,
    diagnostics: { unknownCodes: [], ignoredRows: [], unsupportedSheets: [{ name: 'Feuille hors périmètre', reason: 'fixture de couverture' }], partialSheets: [], sheetPeriods: [], duplicates: [], contracts: [] },
  } })
  const row = (fileId: string, index: number, amount: number, changes: Record<string, unknown> = {}) => ({
    fileId, sourceSheet: 'Fixture allocations', category: 'full_unemployment', allocationCode: `CODE-${String(index).padStart(3, '0')}`,
    salaryCode: null, article: index === 130 ? 'art. fixture' : null, labelFr: `Ligne synthétique ${index}`, labelNl: null,
    unit: 'daily', amount, minDailySalary: null, maxDailySalary: null, validFrom: new Date('2026-10-01T00:00:00.000Z'),
    comparisonKey: `fixture:${String(index).padStart(3, '0')}`,
    rawData: { trace: { sourceCell: `B${index + 2}`, sourceRowIndex: index + 2, sourceColumnIndex: 2, rawValue: String(amount), normalizedValue: amount, mappingFile: 'fixture-browser.ts', transformTemplate: 'synthetic' }, ...changes },
  })
  const oldRows = Array.from({ length: 130 }, (_, index) => row(old.id, index, index === 124 ? 0 : 100 + index / 10))
  const candidateRows = Array.from({ length: 125 }, (_, index) => {
    const base = 100 + index / 10
    const amount = index === 124 ? 1 : index >= 10 && index < 66 ? base * 1.6 : index >= 66 && index < 75 ? base * 1.15 : base + 0.0001
    return row(candidate.id, index, amount, index === 5 ? { trace: { sourceCell: 'C7', sourceRowIndex: 7, sourceColumnIndex: 3, rawValue: String(amount), normalizedValue: amount, mappingFile: 'fixture-browser.ts', transformTemplate: 'synthetic' } } : {})
  })
  // Jeu explicitement synthétique : 56 fortes variations, 9 autres variations
  // notables, puis des changements minimes; 10 inchangées, 5 disparues, 10 ajoutées.
  for (let index = 0; index < 10; index++) candidateRows[index].amount = oldRows[index].amount
  candidateRows[20].allocationCode = 'CODE-020-renamed'
  for (let index = 130; index < 140; index++) candidateRows.push(row(candidate.id, index, 200 + index / 100))
  await db.baremeAmount.createMany({ data: [...oldRows, ...candidateRows] })
  const { compareBaremeVersions, comparisonSnapshot, detectAnomaliesFromDiff } = await import('../lib/baremes/compareBaremeVersions')
  const diff = await compareBaremeVersions(candidate.id)
  const comparisonAlerts = detectAnomaliesFromDiff(diff)
  assert.equal(diff.countsByType.modified, 115)
  assert.equal(diff.countsByType.unchanged, 10)
  assert.equal(diff.countsByType.added, 10)
  assert.equal(diff.countsByType.disappeared, 5)
  assert.deepEqual(comparisonAlerts.map((alert) => alert.problem?.affectedCount), [55, 9])
  const diagnostics = JSON.parse(JSON.stringify({ unknownCodes: [], ignoredRows: [], unsupportedSheets: [{ name: 'Feuille hors périmètre', reason: 'fixture de couverture' }], partialSheets: [], sheetPeriods: [], duplicates: [], contracts: [], comparison: comparisonSnapshot(diff), comparisonAlerts })) as Prisma.InputJsonValue
  await db.baremeFile.update({ where: { id: candidate.id }, data: { diagnostics, alerts: comparisonAlerts as Prisma.InputJsonValue } })
  console.log(JSON.stringify({ email, candidateId: candidate.id, referenceId: old.id, expected: diff.countsByType, syntheticAnomalies: comparisonAlerts.map((alert) => alert.problem?.affectedCount) }, null, 2))
}

main().finally(() => db.$disconnect()).catch((error: unknown) => { console.error(error); process.exitCode = 1 })
