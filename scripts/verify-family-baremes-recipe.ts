/** Local synthetic recipe: publication -> dated reader -> public family evaluator. */
import assert from 'node:assert/strict'
import { Prisma, PrismaClient } from '@prisma/client'

const url = process.env.DATABASE_URL
assert(url, 'An explicitly supplied local recipe URL is required')
const parsed = new URL(url)
assert.equal(process.env.NODE_ENV, 'test')
assert.equal(parsed.hostname, '127.0.0.1')
assert.equal(parsed.port, '5433')
assert.equal(parsed.pathname, '/docbel_recipe')
const db = new PrismaClient({ datasources: { db: { url } } })
;(globalThis as unknown as { prismaBase: PrismaClient }).prismaBase = db
const prefix = 'family-nine-recipe-'
const ids = ['v1', 'v2', 'v3'].map((id) => `${prefix}${id}`)
const results: string[] = []

async function main() {
  const identity = await db.$queryRaw<Array<{ database: string; host: string; port: number }>>`
    SELECT current_database() AS database, host(inet_server_addr()) AS host, inet_server_port() AS port
  `
  assert.deepEqual(identity, [{ database: 'docbel_recipe', host: '127.0.0.1', port: 5433 }])
  assert.equal(await db.baremeFile.count({ where: { NOT: { id: { in: ids } } } }), 0,
    'Refuse to publish fixtures alongside unrelated baremes')
  await db.baremeFile.deleteMany({ where: { id: { in: ids } } })
  if (process.argv.includes('--cleanup')) return
  const { compareBaremeVersions, comparisonSnapshot } = await import('../lib/baremes/compareBaremeVersions')
  const { recordBaremeComparisonReview } = await import('../lib/baremes/comparisonReview')
  const { publishBaremeImport, rollbackToVersion } = await import('../lib/baremes/publishBaremeImport')
  const { getActiveBaremeData } = await import('../lib/baremes/getActiveBaremeData')
  const { getC1BaremeThresholds } = await import('../lib/baremes/c1-thresholds')
  const { evaluateArticle110Verifier } = await import('../lib/regulatory-decision/article-110-verifier')
  const { brusselsCalendarDay } = await import('../lib/baremes/calendar-date')

  const definitions = [
    ['art. 60, al. 2', 'Salaire conjoint'], ['art. 60, al. 3', 'Revenu professionnel enfant'],
    ['art. 61, al. 2', 'Remplacement conjoint'], ['art. 62, al. 1', 'Remplacement enfant'],
    ['art. 62, al. 2', 'Pension ascendant avec enfant'],
    ['art. 62, al. 3', 'Pension ascendant'], ['art. 62, al. 3', 'Pension ascendant handicap'],
  ]
  async function publishFixture(index: number, date: string, amounts: number[]) {
    const id = ids[index]
    await db.baremeFile.create({ data: {
      id, name: `${id}-SYNTHETIQUE.xlsx`, filePath: `test://${id}`, fileType: 'onem-rates',
      effectiveDate: date, validFrom: new Date(date), status: 'draft', alerts: [],
      description: 'Synthetic local testing only; these amounts are not legal reference values.',
    } })
    await db.baremeAmount.createMany({ data: definitions.map(([article, labelFr], i) => ({
      fileId: id, sourceSheet: 'Synthetic family thresholds', category: 'other_unemployment_amount',
      article, labelFr, unit: 'monthly', amount: amounts[i], validFrom: new Date(date),
      comparisonKey: `recipe:family:${i}`,
    })) })
    const snapshot = comparisonSnapshot(await compareBaremeVersions(id))
    await db.baremeFile.update({ where: { id }, data: {
      diagnostics: JSON.parse(JSON.stringify({ comparison: snapshot })) as Prisma.InputJsonValue,
    } })
    assert.equal((await recordBaremeComparisonReview(id, 'family-recipe@example.test', snapshot)).status, 'reviewed')
    assert.equal((await publishBaremeImport(id, { publishedBy: 'family-recipe@example.test' })).status, 'published')
  }
  const v1 = [1000, 500, 100, 600, 1500, 1000, 2000]
  const v2 = [1300, 700, 100, 800, 2500, 1800, 3000]
  const category = async (day: string) => {
    const thresholds = getC1BaremeThresholds(await getActiveBaremeData({ asOf: day }))
    return evaluateArticle110Verifier({ thresholds, asOf: day, partnerQualificationPolicy: 'require_facts', people: [{
      id: 'synthetic-spouse', relation: 'spouse', hasProfessionalIncome: true, professionalIncomeType: 'employee',
      professionalIncomeAmount: 1200, professionalIncomeContract: 'cdi', professionalIncomeVariable: false,
      hasReplacementIncome: false,
    }] }).category
  }
  await publishFixture(0, '2026-01-01', v1)
  assert.equal(await category('2026-10-21'), 'B')
  await publishFixture(1, '2026-09-01', v2)
  assert.equal(await category('2026-10-21'), 'A')
  assert.equal(await category('2026-08-31'), 'B')
  assert.equal((await getActiveBaremeData({ asOf: '2026-08-31' }))?.fileId, ids[0])
  assert.equal((await getActiveBaremeData({ asOf: '2026-09-01' }))?.fileId, ids[1])
  assert.equal(await getActiveBaremeData({ asOf: '2025-12-31' }), null)
  results.push('Published v2 propagates immediately; v1 remains applicable historically; no fallback before coverage')

  const { GET } = await import('../app/api/baremes/c1-thresholds/route')
  const { NextRequest } = await import('next/server')
  const response = await GET(new NextRequest(`http://127.0.0.1/api/baremes/c1-thresholds?asOf=${brusselsCalendarDay()}`))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).source.fileId, ids[1])
  results.push('Public API accepts current Brussels day and returns published provenance')

  await publishFixture(2, '2026-10-01', [1400, 800, 100, 900, 2600, 1900, 3100])
  const originalPublication = (await db.baremeFile.findUniqueOrThrow({ where: { id: ids[0] } })).publishedAt
  const rollback = await rollbackToVersion(ids[0], 'family-recipe@example.test')
  assert.equal(rollback.status, 'rolled_back')
  assert.equal((await getActiveBaremeData({ asOf: '2026-10-21' }))?.fileId, ids[0])
  assert.equal(await category('2026-10-21'), 'B')
  const removed = await db.baremeFile.findMany({ where: { id: { in: ids.slice(1) } }, select: { status: true }, take: 3 })
  assert(removed.every((file) => file.status === 'revoked'))
  assert.deepEqual((await db.baremeFile.findUniqueOrThrow({ where: { id: ids[0] } })).publishedAt, originalPublication)
  results.push('Rollback C to A revokes B and C, restores A, and preserves its original publication date')

  // Leave only named synthetic v1/v2 fixtures for the subsequent browser recipe.
  await db.baremeFile.deleteMany({ where: { id: { in: ids } } })
  await publishFixture(0, '2026-01-01', v1)
  await publishFixture(1, '2026-09-01', v2)
  console.log(JSON.stringify({ database: 'docbel_recipe', synthetic: true, results, browserFixtures: ids.slice(0, 2) }, null, 2))
}

main().finally(() => db.$disconnect()).catch((error: unknown) => { console.error(error); process.exitCode = 1 })
