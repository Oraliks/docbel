/**
 * Exercices Lookup réels sur PostgreSQL éphémère uniquement.
 * Refuse les bases autre que localhost:55434/lookup_hardening_test avant toute écriture.
 */
import assert from 'node:assert/strict'
import { appendFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import * as bcrypt from 'bcryptjs'
import { UserRole, UserStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { createLookupImportProposal, publishLookupImportProposal } from '../lib/lookup/importWorkflow'
import { resolveLookupEntry, resolveLookupEntriesByCodes } from '../lib/lookup/getLookupEntry'

const TARGET_DATABASE = 'lookup_hardening_test'
const TARGET_USER = 'docbel_test'
const TARGET_PORT = '55434'
const PRIVATE_MARKER = 'LOOKUP_E2E_PRIVATE_SENTINEL'

function assertTargetUrl(raw: string | undefined, label: string) {
  assert.ok(raw, label + ' is required')
  const url = new URL(raw)
  assert.equal(url.hostname, '127.0.0.1', label + ' must use loopback')
  assert.equal(url.port, TARGET_PORT, label + ' must use dedicated port ' + TARGET_PORT)
  assert.equal(url.pathname, '/' + TARGET_DATABASE, label + ' must target the disposable Lookup database')
  assert.equal(url.username, TARGET_USER, label + ' must use the disposable test role')
}

async function createApprovals(proposalId: string) {
  await prisma.lookupImportApproval.createMany({
    data: ['lookup-reviewer-a@local.test', 'lookup-reviewer-b@local.test'].map((approverEmail) => ({
      proposalId,
      approverEmail,
      approverName: 'Lookup E2E',
    })),
  })
}

async function main() {
  assertTargetUrl(process.env.DATABASE_URL, 'DATABASE_URL')
  assertTargetUrl(process.env.DIRECT_URL, 'DIRECT_URL')
  assert.ok(process.env.GITHUB_ENV, 'GITHUB_ENV is required so the browser job can receive ephemeral test accounts')

  const identity = await prisma.$queryRaw<Array<{ database_name: string; role_name: string }>>`
    SELECT current_database() AS database_name, current_user AS role_name
  `
  assert.equal(identity[0]?.database_name, TARGET_DATABASE)
  assert.equal(identity[0]?.role_name, TARGET_USER)

  const category = await prisma.lookupCategory.create({
    data: { id: 'lookup-e2e-category', slug: 'lookup-e2e', labelFr: 'Lookup E2E', labelNl: 'Lookup E2E', order: 9000 },
  })

  const publicTable = await prisma.lookupTable.create({
    data: {
      id: 'lookup-e2e-public-table',
      categoryId: category.id,
      slug: 'code-rue',
      prefix: 'E2E-RUE',
      labelFr: 'Rue de test Lookup',
      labelNl: 'Teststraat Lookup',
      notes: PRIVATE_MARKER + '_TABLE_NOTE',
      lastImportSource: 'internal/lookup-e2e-secret-file.csv',
      entriesCount: 1,
    },
  })
  await prisma.lookupEntry.create({
    data: {
      tableId: publicTable.id,
      code: '1000-E2E',
      labelFr: 'Rue synthétique',
      labelNl: 'Synthetische straat',
      metadata: { internalMarker: PRIVATE_MARKER + '_METADATA' },
      notes: PRIVATE_MARKER + '_ENTRY_NOTE',
    },
  })

  const publicationTable = await prisma.lookupTable.create({
    data: {
      id: 'lookup-e2e-publication-table',
      categoryId: category.id,
      slug: 'lookup-e2e-publication',
      prefix: 'E2E-PUB',
      labelFr: 'Publication Lookup E2E',
      labelNl: 'Lookup E2E publicatie',
      requiresApproval: true,
    },
  })

  const csv = [
    'Code;Date de début;Date de fin;Description française;Description néerlandaise',
    'PG-001;;;Libellé synthétique publié;Published synthetic label',
  ].join('\n')
  const proposal = await createLookupImportProposal({
    tableId: publicationTable.id,
    csvContent: csv,
    fileName: 'lookup-e2e-synthetic.csv',
    createdBy: 'lookup-admin@local.test',
  })
  assert.equal(proposal.state, 'prepared', JSON.stringify(proposal.errors ?? []))

  const waiting = await publishLookupImportProposal({ proposalId: proposal.id, publishedBy: 'lookup-admin@local.test' })
  assert.equal(waiting.state, 'pending_approvals')
  assert.equal(waiting.approvalsCount, 0)

  await createApprovals(proposal.id)
  const concurrent = await Promise.allSettled([
    publishLookupImportProposal({ proposalId: proposal.id, publishedBy: 'lookup-admin@local.test' }),
    publishLookupImportProposal({ proposalId: proposal.id, publishedBy: 'lookup-admin@local.test' }),
  ])
  const rejected = concurrent.find((item): item is PromiseRejectedResult => item.status === 'rejected')
  if (rejected) throw rejected.reason
  const states = concurrent
    .map((item) => (item as PromiseFulfilledResult<Awaited<ReturnType<typeof publishLookupImportProposal>>>).value.state)
    .sort()
  assert.deepEqual(states, ['already_published', 'published'])

  const publishedTable = await prisma.lookupTable.findUniqueOrThrow({ where: { id: publicationTable.id } })
  assert.equal(publishedTable.publishedRevision, 1)
  assert.equal(publishedTable.entriesCount, 1)
  const savedProposal = await prisma.lookupImportProposal.findUniqueOrThrow({ where: { id: proposal.id } })
  assert.equal(savedProposal.state, 'published')

  const dateUpdateTable = await prisma.lookupTable.create({
    data: {
      id: 'lookup-e2e-date-update-table',
      categoryId: category.id,
      slug: 'lookup-e2e-date-update',
      prefix: 'E2E-DATE',
      labelFr: 'Dates Lookup E2E',
      labelNl: 'Lookup E2E datums',
      entriesCount: 0,
    },
  })
  const dateHeader = 'Code;Date de début;Date de fin;Description française;Description néerlandaise'
  const dateInitial = await createLookupImportProposal({
    tableId: dateUpdateTable.id,
    csvContent: [
      dateHeader,
      'DATE-UPDATE;01/01/2020;31/12/2024;Libellé initial;Initial label',
      'DATE-PRESERVE;01/01/2020;;À conserver;Keep this entry',
    ].join('\n'),
    fileName: 'lookup-e2e-dates-initial.csv',
    createdBy: 'lookup-admin@local.test',
  })
  assert.equal(dateInitial.state, 'prepared', JSON.stringify(dateInitial.errors ?? []))
  const dateInitialPublished = await publishLookupImportProposal({
    proposalId: dateInitial.id,
    publishedBy: 'lookup-admin@local.test',
  })
  assert.equal(dateInitialPublished.state, 'published')

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION lookup_e2e_reject_date_update() RETURNS trigger LANGUAGE plpgsql AS $body$
    BEGIN
      IF NEW."code" = 'DATE-UPDATE' AND NEW."validUntil"::date = DATE '2025-12-31' THEN
        RAISE EXCEPTION 'LOOKUP_E2E_DATE_UPDATE_REJECTED';
      END IF;
      RETURN NEW;
    END;
    $body$
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER lookup_e2e_reject_date_update_trigger
    BEFORE UPDATE ON "LookupEntry"
    FOR EACH ROW EXECUTE FUNCTION lookup_e2e_reject_date_update()
  `)
  let dateRetryProposalId: string | null = null
  try {
    const updateToDate = await createLookupImportProposal({
      tableId: dateUpdateTable.id,
      csvContent: [dateHeader, 'DATE-UPDATE;01/01/2020;31/12/2025;Libellé daté;Dated label'].join('\n'),
      fileName: 'lookup-e2e-dates-update.csv',
      createdBy: 'lookup-admin@local.test',
    })
    assert.equal(updateToDate.state, 'prepared', JSON.stringify(updateToDate.errors ?? []))
    assert.deepEqual(updateToDate.diff.absentFromExport.map((entry) => entry.code), ['DATE-PRESERVE'])
    dateRetryProposalId = updateToDate.id
    await assert.rejects(
      publishLookupImportProposal({ proposalId: updateToDate.id, publishedBy: 'lookup-admin@local.test' }),
      /LOOKUP_E2E_DATE_UPDATE_REJECTED/,
    )
    const afterDateRollback = await prisma.lookupEntry.findMany({
      where: { tableId: dateUpdateTable.id },
      select: { code: true, validUntil: true },
      orderBy: { code: 'asc' },
    })
    assert.equal(afterDateRollback.length, 2)
    assert.equal(afterDateRollback.find((entry) => entry.code === 'DATE-UPDATE')?.validUntil?.toISOString(), '2024-12-31T00:00:00.000Z')
    assert.equal(afterDateRollback.find((entry) => entry.code === 'DATE-PRESERVE')?.validUntil, null)
    const dateTableAfterRollback = await prisma.lookupTable.findUniqueOrThrow({ where: { id: dateUpdateTable.id } })
    assert.equal(dateTableAfterRollback.publishedRevision, 1)
    assert.equal(dateTableAfterRollback.entriesCount, 2)
    const dateProposalAfterRollback = await prisma.lookupImportProposal.findUniqueOrThrow({ where: { id: updateToDate.id } })
    assert.equal(dateProposalAfterRollback.state, 'failed')
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS lookup_e2e_reject_date_update_trigger ON "LookupEntry"')
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS lookup_e2e_reject_date_update()')
  }

  assert.ok(dateRetryProposalId)
  const dateRetry = await publishLookupImportProposal({
    proposalId: dateRetryProposalId,
    publishedBy: 'lookup-admin@local.test',
    retryFailed: true,
  })
  assert.equal(dateRetry.state, 'published')
  assert.equal(dateRetry.updated, 1)
  const afterDateRetry = await prisma.lookupEntry.findMany({
    where: { tableId: dateUpdateTable.id },
    select: { code: true, validUntil: true },
    orderBy: { code: 'asc' },
  })
  assert.equal(afterDateRetry.length, 2, 'entries absent from the export must remain published')
  assert.equal(afterDateRetry.find((entry) => entry.code === 'DATE-UPDATE')?.validUntil?.toISOString(), '2025-12-31T00:00:00.000Z')
  assert.equal(afterDateRetry.find((entry) => entry.code === 'DATE-PRESERVE')?.validUntil, null)
  const dateTableAfterRetry = await prisma.lookupTable.findUniqueOrThrow({ where: { id: dateUpdateTable.id } })
  assert.equal(dateTableAfterRetry.publishedRevision, 2)
  assert.equal(dateTableAfterRetry.entriesCount, 2)

  const clearDate = await createLookupImportProposal({
    tableId: dateUpdateTable.id,
    csvContent: [dateHeader, 'DATE-UPDATE;01/01/2020;;Libellé sans fin;Open-ended label'].join('\n'),
    fileName: 'lookup-e2e-dates-open-ended.csv',
    createdBy: 'lookup-admin@local.test',
  })
  assert.equal(clearDate.state, 'prepared', JSON.stringify(clearDate.errors ?? []))
  const clearDatePublished = await publishLookupImportProposal({
    proposalId: clearDate.id,
    publishedBy: 'lookup-admin@local.test',
  })
  assert.equal(clearDatePublished.state, 'published')
  const afterClearDate = await prisma.lookupEntry.findMany({
    where: { tableId: dateUpdateTable.id },
    select: { code: true, validUntil: true },
    orderBy: { code: 'asc' },
  })
  assert.equal(afterClearDate.length, 2, 'clearing a date must not remove entries omitted from the export')
  assert.equal(afterClearDate.find((entry) => entry.code === 'DATE-UPDATE')?.validUntil, null)
  assert.equal(afterClearDate.find((entry) => entry.code === 'DATE-PRESERVE')?.validUntil, null)
  const dateTableAfterClear = await prisma.lookupTable.findUniqueOrThrow({ where: { id: dateUpdateTable.id } })
  assert.equal(dateTableAfterClear.publishedRevision, 3)
  assert.equal(dateTableAfterClear.entriesCount, 2)

  await prisma.lookupEntry.createMany({
    data: [
      { tableId: publicationTable.id, code: 'HIST', labelFr: 'Historique A', labelNl: 'Historiek A', validFrom: new Date('2020-01-01T00:00:00.000Z') },
      { tableId: publicationTable.id, code: 'HIST', labelFr: 'Historique B', labelNl: 'Historiek B', validFrom: new Date('2022-01-01T00:00:00.000Z') },
      { tableId: publicationTable.id, code: 'BOUND', labelFr: 'Frontière', labelNl: 'Grens', validFrom: new Date('2026-10-25T00:00:00.000Z'), validUntil: new Date('2026-10-25T00:00:00.000Z') },
    ],
  })
  const unit = await resolveLookupEntry('lookup-e2e-publication', 'BOUND', { asOf: '2026-10-25', force: true })
  assert.equal(unit.status, 'resolved')
  if (unit.status === 'resolved') {
    assert.equal(unit.entry.effectiveDate, '2026-10-25')
    assert.equal(unit.entry.publishedRevision, 1)
  }
  const beforeBoundary = await resolveLookupEntry('lookup-e2e-publication', 'BOUND', { asOf: '2026-10-24', force: true })
  assert.equal(beforeBoundary.status, 'absent')
  const batch = await resolveLookupEntriesByCodes(
    'lookup-e2e-publication',
    ['PG-001', 'HIST', 'BOUND', 'MISSING'],
    { asOf: '2026-10-25' },
  )
  assert.equal(batch.get('PG-001')?.status, 'resolved')
  assert.equal(batch.get('HIST')?.status, 'ambiguous')
  assert.equal(batch.get('BOUND')?.status, 'resolved')
  assert.equal(batch.get('MISSING')?.status, 'absent')

  const collisionA = await prisma.lookupCategory.create({
    data: { id: 'lookup-e2e-collision-a', slug: 'lookup-e2e-collision-a', labelFr: 'Collision A', labelNl: 'Collision A' },
  })
  const collisionB = await prisma.lookupCategory.create({
    data: { id: 'lookup-e2e-collision-b', slug: 'lookup-e2e-collision-b', labelFr: 'Collision B', labelNl: 'Collision B' },
  })
  for (const [id, categoryId] of [['lookup-e2e-collision-table-a', collisionA.id], ['lookup-e2e-collision-table-b', collisionB.id]] as const) {
    await prisma.lookupTable.create({
      data: { id, categoryId, slug: 'lookup-e2e-same-slug', prefix: id, labelFr: id, labelNl: id },
    })
  }
  assert.equal((await resolveLookupEntry('lookup-e2e-same-slug', 'ANY')).status, 'ambiguous')
  assert.equal((await resolveLookupEntriesByCodes('lookup-e2e-same-slug', ['ANY'])).get('ANY')?.status, 'ambiguous')

  // Force an actual PostgreSQL statement failure after the proposal is prepared;
  // the service must roll back the insert and keep the published revision unchanged.
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION lookup_e2e_reject_code() RETURNS trigger LANGUAGE plpgsql AS $body$
    BEGIN
      IF NEW."code" = 'PG-FAIL' THEN
        RAISE EXCEPTION 'LOOKUP_E2E_TRIGGER_REJECTED';
      END IF;
      RETURN NEW;
    END;
    $body$
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER lookup_e2e_reject_code_trigger
    BEFORE INSERT ON "LookupEntry"
    FOR EACH ROW EXECUTE FUNCTION lookup_e2e_reject_code()
  `)
  let retryableProposalId: string | null = null
  try {
    const failedProposal = await createLookupImportProposal({
      tableId: publicationTable.id,
      csvContent: [
        'Code;Date de début;Date de fin;Description française;Description néerlandaise',
        'PG-ROLLBACK;;;Doit être annulé;Must roll back',
        'PG-FAIL;;;Déclenche une erreur;Triggers an error',
      ].join('\n'),
      fileName: 'lookup-e2e-rollback.csv',
      createdBy: 'lookup-admin@local.test',
    })
    assert.equal(failedProposal.state, 'prepared', JSON.stringify(failedProposal.errors ?? []))
    retryableProposalId = failedProposal.id
    await createApprovals(failedProposal.id)
    await assert.rejects(
      publishLookupImportProposal({ proposalId: failedProposal.id, publishedBy: 'lookup-admin@local.test' }),
      /LOOKUP_E2E_TRIGGER_REJECTED/,
    )
    const entriesAfterRollback = await prisma.lookupEntry.count({ where: { tableId: publicationTable.id } })
    const tableAfterRollback = await prisma.lookupTable.findUniqueOrThrow({ where: { id: publicationTable.id } })
    const failedState = await prisma.lookupImportProposal.findUniqueOrThrow({ where: { id: failedProposal.id } })
    assert.equal(entriesAfterRollback, 4, 'the two rejected rows must leave no partial writes')
    assert.equal(tableAfterRollback.publishedRevision, 1, 'failed publication must not advance the revision')
    assert.equal(failedState.state, 'failed')
    await prisma.lookupImportApproval.deleteMany({ where: { proposalId: failedProposal.id } })
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS lookup_e2e_reject_code_trigger ON "LookupEntry"')
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS lookup_e2e_reject_code()')
  }

  assert.ok(retryableProposalId)
  const retryWaiting = await publishLookupImportProposal({
    proposalId: retryableProposalId,
    publishedBy: 'lookup-admin@local.test',
    retryFailed: true,
  })
  assert.equal(retryWaiting.state, 'pending_approvals', 'retry must still require distinct approvals')
  const resetForReview = await prisma.lookupImportProposal.findUniqueOrThrow({ where: { id: retryableProposalId } })
  assert.equal(resetForReview.state, 'prepared')
  assert.equal(await prisma.lookupEntry.count({ where: { tableId: publicationTable.id } }), 4)
  await createApprovals(retryableProposalId)
  const retried = await publishLookupImportProposal({
    proposalId: retryableProposalId,
    publishedBy: 'lookup-admin@local.test',
  })
  assert.equal(retried.state, 'published')
  assert.equal(retried.inserted, 2)
  const afterRetryTable = await prisma.lookupTable.findUniqueOrThrow({ where: { id: publicationTable.id } })
  assert.equal(afterRetryTable.entriesCount, 6)
  assert.equal(afterRetryTable.publishedRevision, 2)

  const password = randomBytes(24).toString('base64url')
  // Mask the ephemeral credential before exposing it to later workflow steps.
  console.log('::add-mask::' + password)
  const passwordHash = await bcrypt.hash(password, 10)
  const suffix = randomBytes(5).toString('hex')
  const fixtures = [
    { key: 'admin', role: UserRole.admin, status: UserStatus.active, partnerOrganization: null, segment: null, partnerType: null },
    { key: 'user', role: UserRole.user, status: UserStatus.active, partnerOrganization: null, segment: null, partnerType: null },
    { key: 'partner', role: UserRole.partner, status: UserStatus.active, partnerOrganization: 'lookup-e2e-org', segment: 'partenaire', partnerType: 'onem' },
    { key: 'disabled', role: UserRole.partner, status: UserStatus.disabled, partnerOrganization: 'lookup-e2e-org', segment: 'partenaire', partnerType: 'onem' },
  ] as const
  const emails: Record<string, string> = {}
  for (const fixture of fixtures) {
    const email = 'lookup-' + fixture.key + '-' + suffix + '@local.test'
    const userId = 'lookup-e2e-' + suffix + '-' + fixture.key
    const accountId = userId + '-credential'
    await prisma.user.create({
      data: {
        id: userId,
        name: 'Lookup E2E ' + fixture.key,
        email,
        emailVerified: true,
        password: passwordHash,
        role: fixture.role,
        status: fixture.status,
        partnerOrganization: fixture.partnerOrganization,
        segment: fixture.segment,
        partnerType: fixture.partnerType,
      },
    })
    await prisma.account.create({
      data: { id: accountId, accountId: userId, providerId: 'credential', userId, password: passwordHash },
    })
    emails[fixture.key] = email
  }

  appendFileSync(process.env.GITHUB_ENV!, [
    'LOOKUP_E2E_PASSWORD=' + password,
    'LOOKUP_E2E_ADMIN_EMAIL=' + emails.admin,
    'LOOKUP_E2E_USER_EMAIL=' + emails.user,
    'LOOKUP_E2E_PARTNER_EMAIL=' + emails.partner,
    'LOOKUP_E2E_DISABLED_EMAIL=' + emails.disabled,
    'LOOKUP_E2E_PRIVATE_TABLE_ID=' + publicTable.id,
  ].join('\n') + '\n')

  console.info('Lookup PostgreSQL integration passed: isolation, migration-backed schema, approval gate, concurrent publish, rollback, explicit retry, dated resolution, ambiguity, and role fixtures.')
}

main()
  .catch((error: unknown) => {
    console.error('Lookup PostgreSQL integration failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
