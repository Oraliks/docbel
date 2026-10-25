import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'

const url = process.env.AUTONOMOUS_RATES_TEST_DATABASE_URL
const original =
  process.env.DOCBEL_REFERENCE_XLSX ?? 'lib/baremes-autonome/__tests__/fixtures/barema20260901-new.xlsx'
describe.skipIf(!url || !original)('isolated real PostgreSQL and workbook acceptance', () => {
  it('persists/imports/publishes with legacy tables forbidden; concurrency, rollback and permissions', async () => {
    const parsed = new URL(url!)
    if (
      parsed.hostname !== '127.0.0.1' ||
      parsed.port !== '55433' ||
      parsed.pathname !== '/autonomous_rates_test'
    )
      throw new Error('LOCAL_DISPOSABLE_DATABASE_REQUIRED')
    process.env.DATABASE_URL = url!
    // Trap every historical module, including parsers and indirect imports, in this worker only.
    const oldModules = fs
      .readdirSync('lib/baremes', { recursive: true })
      .map(String)
      .filter((file) => file.endsWith('.ts') && !file.includes('__tests__'))
      .map((file) => path.resolve('lib/baremes', file))
    oldModules.push(path.resolve('lib/baremes-parser.ts'))
    for (const modulePath of oldModules)
      vi.doMock(modulePath, () => {
        throw new Error('HISTORICAL_SERVICE_FORBIDDEN')
      })
    const blobAccess = vi.fn(() => {
      throw new Error('SHARED_BLOB_ACCESS_FORBIDDEN_IN_AUTONOMOUS_REFERENCE')
    })
    vi.doMock('@/lib/storage/blob-storage', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@/lib/storage/blob-storage')>()),
      getBlob: blobAccess,
      saveBlob: blobAccess,
      deleteBlob: blobAccess,
      moveBlob: blobAccess,
    }))
    const cacheInvalidation = vi.fn(() => {
      throw new Error('SHARED_CACHE_INVALIDATION_FORBIDDEN_IN_AUTONOMOUS_REFERENCE')
    })
    vi.doMock('next/cache', async (importOriginal) => ({
      ...(await importOriginal<typeof import('next/cache')>()),
      revalidatePath: cacheInvalidation,
      revalidateTag: cacheInvalidation,
      updateTag: cacheInvalidation,
    }))
    await expect(import('@/lib/baremes/getActiveBaremeData')).rejects.toMatchObject({
      cause: { message: 'HISTORICAL_SERVICE_FORBIDDEN' },
    })
    const admin = new PrismaClient({
      datasources: { db: { url: url!.replace('autonomous_app@', 'docbel_test@') } },
    })
    const { prisma } = await import('@/lib/prisma')
    const service = await import('../service')
    const { digest } = await import('../compare')
    const { withAdminAuthTestOverride } = await import('@/lib/auth-check')
    const routes = await import('@/app/api/admin/baremes-autonome/versions/route')
    const publishRoute = await import('@/app/api/admin/baremes-autonome/versions/[id]/publish/route')
    const sourceRoute = await import('@/app/api/admin/baremes-autonome/versions/[id]/source/route')
    const before = await admin.baremeFile.findMany({ take: 100, orderBy: { id: 'asc' } })
    const legacyTables = await admin.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE 'Bareme%' OR tablename = 'BareSheet') ORDER BY tablename`
    const legacyState = async () =>
      Promise.all(
        legacyTables.map(async ({ tablename }) => {
          if (!/^(Bareme\w+|BareSheet)$/.test(tablename)) throw new Error('INVALID_TABLE')
          return admin.$queryRawUnsafe(
            `SELECT md5(COALESCE(jsonb_agg(t ORDER BY t.id)::text, '[]')) AS hash FROM "${tablename}" t`,
          )
        }),
      )
    const legacyBefore = await legacyState()
    try {
      for (const { tablename } of legacyTables)
        await expect(prisma.$queryRawUnsafe(`SELECT 1 FROM "${tablename}" LIMIT 1`)).rejects.toThrow()
      await prisma.$transaction(async (tx) => {
        await tx.autonomousRateDecision.deleteMany({})
        await tx.autonomousRatePublication.deleteMany({})
        await tx.autonomousRateRegistry.update({
          where: { id: 'autonomous-rates' },
          data: { versionId: null, generation: 0 },
        })
        await tx.autonomousRateVersion.deleteMany({})
      })
      const bytes = fs.readFileSync(original!)
      await expect(
        service.importVersion(Buffer.from('CORRUPT-XLSX-TEST-ONLY'), 'CORRUPT-TEST-ONLY.xlsx', 'local-admin'),
      ).rejects.toMatchObject({ code: 'INVALID_FILE' })
      expect(await prisma.autonomousRateVersion.count()).toBe(0)
      const first = await service.importVersion(bytes, 'barema20260901-new.xlsx', 'local-admin')
      const initial = await service.getWorkspace(first.id, { page: 1 })
      expect(initial.reference).toBeNull()
      expect(initial.counts.added).toBeGreaterThan(2000)
      expect(initial.canPublish).toBe(true)
      expect(initial.sheets).toHaveLength(12)
      expect(initial.coverage?.tables).toHaveLength(12)
      expect(initial.issues.filter((i) => i.blocking)).toHaveLength(0)
      const source = await service.getSource(first.id)
      expect(Buffer.from(source.original).equals(bytes)).toBe(true)
      await service.publishVersion(first.id, initial.snapshot, 'local-admin')
      await expect(service.publishVersion(first.id, initial.snapshot, 'local-admin')).resolves.toEqual({
        id: first.id,
        published: true,
      })
      await prisma.$disconnect()
      expect((await service.getWorkspace(first.id, { page: 1 })).candidate.publishedAt).toBeTruthy()

      const workbook = XLSX.read(bytes, { type: 'buffer' })
      workbook.Sheets.A_N_B_vol_plein.C12 = { ...workbook.Sheets.A_N_B_vol_plein.C12, v: 79.09 }
      const synthetic = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
      const second = await service.importVersion(synthetic, 'SYNTHETIC-TEST-ONLY.xlsx', 'local-admin')
      const competitor = await service.importVersion(
        synthetic,
        'SYNTHETIC-CONCURRENT-TEST-ONLY.xlsx',
        'local-admin',
      )
      const comparison = await service.getWorkspace(second.id, { page: 1, kind: 'modified' })
      const competing = await service.getWorkspace(competitor.id, { page: 1 })
      expect(comparison.reference?.id).toBe(first.id)
      expect(comparison.counts.modified).toBe(1)
      expect(comparison.items).toHaveLength(1)
      expect(comparison.total).toBe(1)
      expect(comparison.counts.unchanged).toBeGreaterThan(2000)
      const filtered = await service.getWorkspace(second.id, {
        page: 1,
        q: 'AA1',
        sheet: comparison.items[0].after!.source.sheet,
        includeUnchanged: true,
      })
      expect(filtered.counts).toEqual(comparison.counts)
      expect(filtered.total).toBeGreaterThan(1)
      const results = await Promise.allSettled([
        service.publishVersion(second.id, comparison.snapshot, 'local-admin'),
        service.publishVersion(competitor.id, competing.snapshot, 'local-admin'),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
      expect(failed.reason.code).toBe('STALE_COMPARISON')
      const registry = await prisma.autonomousRateRegistry.findUniqueOrThrow({
        where: { id: 'autonomous-rates' },
      })
      for (const [name, mutate] of [
        [
          'missing-value',
          (book: XLSX.WorkBook) => {
            delete book.Sheets.A_N_B_vol_plein.C12
          },
        ],
        [
          'error-value',
          (book: XLSX.WorkBook) => {
            book.Sheets.A_N_B_vol_plein.C12 = { t: 'e', v: 0 }
          },
        ],
        [
          'partial-sheet',
          (book: XLSX.WorkBook) => {
            delete book.Sheets.A_N_B_half_demi
            book.SheetNames = book.SheetNames.filter((n) => n !== 'A_N_B_half_demi')
          },
        ],
        [
          'collision',
          (book: XLSX.WorkBook) => {
            book.Sheets.A_N_B_vol_plein.D9 = { t: 's', v: 'AA1' }
          },
        ],
      ] as const) {
        const book = XLSX.read(bytes, { type: 'buffer' })
        mutate(book)
        const invalid = await service.importVersion(
          Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })),
          `SYNTHETIC-${name}-TEST.xlsx`,
          'local-admin',
        )
        const invalidComparison = await service.getWorkspace(invalid.id, { page: 1 })
        expect(invalidComparison.canPublish).toBe(false)
        await expect(
          service.publishVersion(invalid.id, invalidComparison.snapshot, 'local-admin'),
        ).rejects.toMatchObject({ code: 'BLOCKED' })
      }
      const corrupt = await service.importVersion(bytes, 'SYNTHETIC-CORRUPT-TEST.xlsx', 'local-admin')
      const corruptComparison = await service.getWorkspace(corrupt.id, { page: 1 })
      await admin.autonomousRateVersion.update({
        where: { id: corrupt.id },
        data: { revision: '0'.repeat(64) },
      })
      await expect(
        service.publishVersion(corrupt.id, corruptComparison.snapshot, 'local-admin'),
      ).rejects.toMatchObject({ code: 'STALE_COMPARISON' })
      expect(await prisma.autonomousRateRegistry.findUnique({ where: { id: 'autonomous-rates' } })).toEqual(
        registry,
      )
      expect(await prisma.autonomousRatePublication.count({ where: { versionId: corrupt.id } })).toBe(0)

      const edited = await service.importVersion(bytes, 'SYNTHETIC-EDITED-READING-TEST.xlsx', 'local-admin')
      const editedComparison = await service.getWorkspace(edited.id, { page: 1 })
      const editedRow = await admin.autonomousRateVersion.findUniqueOrThrow({ where: { id: edited.id } })
      const editedReading = structuredClone(editedRow.reading) as unknown as import('../types').Reading
      editedReading.values[0].value = '999.99'
      await admin.autonomousRateVersion.update({
        where: { id: edited.id },
        data: { reading: JSON.parse(JSON.stringify(editedReading)) },
      })
      await expect(
        service.publishVersion(edited.id, editedComparison.snapshot, 'local-admin'),
      ).rejects.toMatchObject({ code: 'STALE_COMPARISON' })
      expect(await prisma.autonomousRateRegistry.findUnique({ where: { id: 'autonomous-rates' } })).toEqual(
        registry,
      )

      const refCandidate = await service.importVersion(
        bytes,
        'SYNTHETIC-REFERENCE-INTEGRITY-TEST.xlsx',
        'local-admin',
      )
      const refComparison = await service.getWorkspace(refCandidate.id, { page: 1 })
      const referenceRow = await admin.autonomousRateVersion.findUniqueOrThrow({
        where: { id: registry.versionId! },
      })
      await admin.autonomousRateVersion.update({
        where: { id: referenceRow.id },
        data: { original: Buffer.from('damaged') },
      })
      try {
        await expect(
          service.publishVersion(refCandidate.id, refComparison.snapshot, 'local-admin'),
        ).rejects.toMatchObject({ code: 'REVISION_CHANGED' })
      } finally {
        await admin.autonomousRateVersion.update({
          where: { id: referenceRow.id },
          data: { original: referenceRow.original },
        })
      }

      const rollback = await service.importVersion(bytes, 'SYNTHETIC-ROLLBACK-TEST.xlsx', 'local-admin')
      const rollbackComparison = await service.getWorkspace(rollback.id, { page: 1 })
      await admin.$executeRawUnsafe(
        `CREATE FUNCTION autonomous_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated failure'; END; $$`,
      )
      await admin.$executeRawUnsafe(
        `CREATE TRIGGER autonomous_test_failure BEFORE UPDATE ON "AutonomousRateRegistry" FOR EACH ROW EXECUTE FUNCTION autonomous_test_failure()`,
      )
      try {
        await expect(
          service.publishVersion(rollback.id, rollbackComparison.snapshot, 'local-admin'),
        ).rejects.toThrow()
        expect(await prisma.autonomousRatePublication.count({ where: { versionId: rollback.id } })).toBe(0)
        expect(
          (await prisma.autonomousRateVersion.findUniqueOrThrow({ where: { id: rollback.id } })).publishedAt,
        ).toBeNull()
        expect(await prisma.autonomousRateRegistry.findUnique({ where: { id: 'autonomous-rates' } })).toEqual(
          registry,
        )
      } finally {
        await admin.$executeRawUnsafe(`DROP TRIGGER autonomous_test_failure ON "AutonomousRateRegistry"`)
        await admin.$executeRawUnsafe(`DROP FUNCTION autonomous_test_failure()`)
      }

      // Frozen v1/v2 drafts stay blocked; published autonomous references retain their own readers.
      const { readWorkbookVersion } = await import('../read-workbook')
      for (const readerVersion of [1, 2, 3]) {
        const legacyReading = readWorkbookVersion(bytes, readerVersion)
        const legacyFileHash = createHash('sha256').update(bytes).digest('hex')
        const legacyRevision = digest({ fileHash: legacyFileHash, reading: legacyReading })
        const createStoredReading = (id: string, name: string, publishedAt: Date | null) =>
          admin.autonomousRateVersion.create({
            data: {
              id,
              name,
              original: bytes,
              fileHash: legacyFileHash,
              revision: legacyRevision,
              reading: JSON.parse(JSON.stringify(legacyReading)),
              effectiveFrom: new Date(legacyReading.effectiveFrom!),
              createdBy: 'local-admin',
              ...(publishedAt ? { publishedAt } : {}),
            },
          })
        const outdatedDraft = await createStoredReading(
          `autonomous-rate-v${readerVersion}-draft-test`,
          `V${readerVersion}-DRAFT-TEST-ONLY.xlsx`,
          null,
        )
        const outdatedWorkspace = await service.getWorkspace(outdatedDraft.id, { page: 1 })
        expect(outdatedWorkspace.issues.some((i) => i.code === 'PARSER_VERSION_OUTDATED' && i.blocking)).toBe(
          true,
        )
        expect(outdatedWorkspace.canPublish).toBe(false)
        await expect(
          service.publishVersion(outdatedDraft.id, outdatedWorkspace.snapshot, 'local-admin'),
        ).rejects.toMatchObject({ code: 'BLOCKED' })

        const legacyReferenceId = `autonomous-rate-v${readerVersion}-published-test`
        const legacyReference = await createStoredReading(
          legacyReferenceId,
          `V${readerVersion}-PUBLISHED-REFERENCE-TEST-ONLY.xlsx`,
          new Date(),
        )
        await admin.$transaction(async (tx) => {
          await tx.autonomousRatePublication.create({
            data: {
              versionId: legacyReference.id,
              previousId: registry.versionId,
              actorId: 'local-admin',
              snapshot: { seededReaderVersion: readerVersion },
            },
          })
          await tx.autonomousRateRegistry.update({
            where: { id: 'autonomous-rates' },
            data: { versionId: legacyReference.id, generation: { increment: 1 } },
          })
        })
        const stableReference = await admin.autonomousRateVersion.findUniqueOrThrow({
          where: { id: legacyReference.id },
        })
        const currentCandidate = await service.importVersion(
          bytes,
          'V3-CANDIDATE-TEST-ONLY.xlsx',
          'local-admin',
        )
        const currentWorkspace = await service.getWorkspace(currentCandidate.id, { page: 1 })
        expect(currentWorkspace.reference?.id).toBe(legacyReference.id)
        expect(currentWorkspace.canPublish).toBe(true)
        expect(currentWorkspace.issues.filter((i) => i.blocking)).toHaveLength(0)
        await service.publishVersion(currentCandidate.id, currentWorkspace.snapshot, 'local-admin')
        expect(
          (await admin.autonomousRateRegistry.findUniqueOrThrow({ where: { id: 'autonomous-rates' } }))
            .versionId,
        ).toBe(currentCandidate.id)
        const afterReference = await admin.autonomousRateVersion.findUniqueOrThrow({
          where: { id: legacyReference.id },
        })
        expect(Buffer.from(afterReference.original).equals(bytes)).toBe(true)
        expect(afterReference.fileHash).toBe(stableReference.fileHash)
        expect(afterReference.revision).toBe(stableReference.revision)
        expect(digest(afterReference.reading)).toBe(digest(stableReference.reading))
        expect(
          (
            await admin.autonomousRatePublication.findUniqueOrThrow({
              where: { versionId: currentCandidate.id },
            })
          ).previousId,
        ).toBe(legacyReference.id)
      }

      // All new decisions use these same forbidden legacy tables/services and real PostgreSQL.
      const { saveDecision } = await import('../decision-service')
      const decisionRoute = await import('@/app/api/admin/baremes-autonome/versions/[id]/decisions/route')
      const reviewRoute =
        await import('@/app/api/admin/baremes-autonome/versions/[id]/reviews/[taskId]/route')
      const reportRoute = await import('@/app/api/admin/baremes-autonome/versions/[id]/report/route')
      const largeBook = XLSX.read(bytes, { type: 'buffer' })
      largeBook.Sheets.A_N_B_vol_plein.C12 = { ...largeBook.Sheets.A_N_B_vol_plein.C12, v: 160 }
      const large = await service.importVersion(
        Buffer.from(XLSX.write(largeBook, { type: 'buffer', bookType: 'xlsx' })),
        'SYNTHETIC-LARGE-TEST.xlsx',
        'local-admin',
      )
      const largeWorkspace = await service.getWorkspace(large.id, { page: 1 })
      expect(largeWorkspace.review?.pending).toBe(1)
      await expect(
        service.publishVersion(large.id, largeWorkspace.snapshot, 'local-admin'),
      ).rejects.toMatchObject({ code: 'BLOCKED' })
      const details = await service.getReviewDetails(large.id, largeWorkspace.review!.tasks[0].id)
      const input: import('../review-types').DecisionInput = {
        snapshot: details.snapshot,
        fingerprint: details.fingerprint,
        taskId: details.task.id,
        memberKeys: details.task.memberKeys,
        scopeDigest: details.task.scopeDigest,
        status: 'accepted',
        reason: 'Montant confirmé dans le nouveau fichier',
        checkedSources: true,
        documentaryOnly: true,
      }
      await expect(saveDecision(large.id, { ...input, memberKeys: [] }, 'local-admin')).rejects.toMatchObject(
        { code: 'INVALID_SCOPE' },
      )
      await expect(
        saveDecision(large.id, { ...input, checkedSources: false }, 'local-admin'),
      ).rejects.toMatchObject({ code: 'SOURCES_REQUIRED' })
      await expect(
        saveDecision(large.id, { ...input, reason: 'ACTIVA supprimé début 2027' }, 'local-admin'),
      ).rejects.toMatchObject({ code: 'OFFICIAL_SOURCE_REQUIRED' })
      await expect(
        saveDecision(
          large.id,
          {
            ...input,
            documentaryOnly: false,
            officialSource: 'https://example.test/official',
            regulatoryScope: {
              region: 'Wallonie',
              population: 'Recette fictive',
              newRequests: 'Recette fictive',
              existingCases: 'Recette fictive',
            },
          },
          'local-admin',
        ),
      ).rejects.toMatchObject({ code: 'OFFICIAL_SOURCE_REQUIRED' })
      const deferred = await saveDecision(
        large.id,
        { ...input, status: 'deferred', reason: 'Vérification complémentaire nécessaire' },
        'local-admin',
      )
      expect((await service.getWorkspace(large.id, { page: 1 })).canPublish).toBe(false)
      input.previousDecisionId = deferred.id
      const accepted = await saveDecision(large.id, input, 'local-admin')
      await expect(saveDecision(large.id, input, 'local-admin')).resolves.toEqual(accepted)
      await prisma.$disconnect()
      expect((await service.getWorkspace(large.id, { page: 1 })).canPublish).toBe(true)
      const revoked = await saveDecision(
        large.id,
        {
          ...input,
          status: 'revoked',
          reason: 'Une seconde vérification est nécessaire',
          previousDecisionId: accepted.id,
        },
        'local-admin',
      )
      expect((await service.getWorkspace(large.id, { page: 1 })).canPublish).toBe(false)
      await expect(saveDecision(large.id, input, 'local-admin')).rejects.toMatchObject({
        code: 'STALE_COMPARISON',
      })
      await saveDecision(large.id, { ...input, previousDecisionId: revoked.id }, 'local-admin')
      await service.publishVersion(large.id, largeWorkspace.snapshot, 'local-admin')
      await expect(
        saveDecision(
          large.id,
          { ...input, status: 'revoked', previousDecisionId: revoked.id },
          'local-admin',
        ),
      ).rejects.toMatchObject({ code: 'ALREADY_PUBLISHED' })
      expect(await prisma.autonomousRateDecision.count({ where: { candidateId: large.id } })).toBe(4)

      // A real branch withdrawal: only Wallonia, not all activation regimes.
      const removalBook = XLSX.read(
        Buffer.from(XLSX.write(largeBook, { type: 'buffer', bookType: 'xlsx' })),
        { type: 'buffer' },
      )
      for (const cell of Object.keys(removalBook.Sheets.Activering_Activation))
        if (
          !cell.startsWith('!') &&
          ['I', 'J'].includes(cell.replace(/\d/g, '')) &&
          Number(cell.replace(/\D/g, '')) >= 7 &&
          Number(cell.replace(/\D/g, '')) <= 15
        )
          delete removalBook.Sheets.Activering_Activation[cell]
      const removal = await service.importVersion(
        Buffer.from(XLSX.write(removalBook, { type: 'buffer', bookType: 'xlsx' })),
        'SYNTHETIC-WALLONIA-WITHDRAWAL-TEST.xlsx',
        'local-admin',
      )
      const removalWorkspace = await service.getWorkspace(removal.id, { page: 1 })
      expect(removalWorkspace.issues.filter((issue) => issue.blocking)).toEqual([])
      const removalTask = removalWorkspace.review!.tasks.find((task) => task.kind === 'removal')!
      expect(removalTask.memberCount).toBeGreaterThan(1)
      expect(removalTask.memberKeys.every((key) => key.startsWith('activation/activa_wallonia/'))).toBe(true)
      const withdrawal: import('../review-types').DecisionInput = {
        ...input,
        previousDecisionId: undefined,
        snapshot: removalWorkspace.snapshot,
        fingerprint: removalWorkspace.review!.fingerprint,
        taskId: removalTask.id,
        memberKeys: removalTask.memberKeys,
        scopeDigest: removalTask.scopeDigest,
        effectiveDate: removalWorkspace.candidate.effectiveFrom!.slice(0, 10),
        reason: 'Retrait documentaire constaté dans le nouveau fichier',
      }
      await expect(
        saveDecision(
          removal.id,
          { ...withdrawal, memberKeys: withdrawal.memberKeys.slice(0, 1) },
          'local-admin',
        ),
      ).rejects.toMatchObject({ code: 'INVALID_SCOPE' })
      await expect(
        saveDecision(removal.id, { ...withdrawal, reason: 'Fin du dispositif Activa' }, 'local-admin'),
      ).rejects.toMatchObject({ code: 'OFFICIAL_SOURCE_REQUIRED' })
      await saveDecision(removal.id, withdrawal, 'local-admin')
      expect((await service.getWorkspace(removal.id, { page: 1 })).canPublish).toBe(true)
      await service.publishVersion(removal.id, removalWorkspace.snapshot, 'local-admin')
      const withdrawn = await service.getWorkspace(removal.id, { page: 1, includeUnchanged: true })
      expect(withdrawn.counts.absent).toBe(removalTask.memberCount)
      const oldHistory = await service.getWorkspace(large.id, { page: 1, includeUnchanged: true })
      expect(oldHistory.counts.absent).toBe(0)
      expect(
        (await service.getComparisonReport(removal.id)).rows
          .filter((row) => row.kind === 'absent')
          .every((row) => row.after === null),
      ).toBe(true)
      expect((await service.getWorkspace(large.id, { page: 1 })).snapshot).toEqual(largeWorkspace.snapshot)
      const { REVIEW_POLICY } = await import('../review-policy')
      const savedPolicy = REVIEW_POLICY.percent
      try {
        REVIEW_POLICY.percent = '25'
        const historic = await service.getWorkspace(removal.id, { page: 1 })
        expect(historic.snapshot).toEqual(removalWorkspace.snapshot)
        expect(historic.review?.fingerprint).toBe(removalWorkspace.review!.fingerprint)
        expect(historic.review?.pending).toBe(0)
        expect(historic.review?.accepted).toBe(1)
        await expect(
          service.publishVersion(removal.id, removalWorkspace.snapshot, 'local-admin'),
        ).resolves.toEqual({ id: removal.id, published: true })
      } finally {
        REVIEW_POLICY.percent = savedPolicy
      }

      const { apiError } = await import('@/lib/api/response')
      await withAdminAuthTestOverride(
        async () => ({ isAuthorized: false, error: apiError(401, 'Unauthorized') }),
        async () => {
          expect((await routes.GET()).status).toBe(401)
          expect((await routes.POST(new Request('http://localhost/api', { method: 'POST' }))).status).toBe(
            401,
          )
          expect(
            (
              await publishRoute.POST(new Request('http://localhost/api', { method: 'POST' }), {
                params: Promise.resolve({ id: first.id }),
              })
            ).status,
          ).toBe(401)
          expect(
            (
              await sourceRoute.GET(new Request('http://localhost/api'), {
                params: Promise.resolve({ id: first.id }),
              })
            ).status,
          ).toBe(401)
          expect(
            (
              await decisionRoute.POST(new Request('http://localhost/api', { method: 'POST' }), {
                params: Promise.resolve({ id: large.id }),
              })
            ).status,
          ).toBe(401)
          expect(
            (
              await reviewRoute.GET(new Request('http://localhost/api'), {
                params: Promise.resolve({ id: large.id, taskId: input.taskId }),
              })
            ).status,
          ).toBe(401)
          expect(
            (
              await reportRoute.GET(new Request('http://localhost/api'), {
                params: Promise.resolve({ id: large.id }),
              })
            ).status,
          ).toBe(401)
        },
      )
      await withAdminAuthTestOverride(
        async () => ({ isAuthorized: false, error: apiError(403, 'Forbidden') }),
        async () => {
          expect((await routes.GET()).status).toBe(403)
          expect((await routes.POST(new Request('http://localhost/api', { method: 'POST' }))).status).toBe(
            403,
          )
          expect(
            (
              await publishRoute.POST(new Request('http://localhost/api', { method: 'POST' }), {
                params: Promise.resolve({ id: first.id }),
              })
            ).status,
          ).toBe(403)
          expect(
            (
              await sourceRoute.GET(new Request('http://localhost/api'), {
                params: Promise.resolve({ id: first.id }),
              })
            ).status,
          ).toBe(403)
        },
      )
      await withAdminAuthTestOverride(
        async () => ({
          isAuthorized: true,
          user: {
            id: 'local-admin',
            name: 'Local admin',
            email: 'admin@local.test',
            role: 'admin',
            status: 'active',
          },
        }),
        async () => {
          const crossSite = await routes.POST(
            new Request('http://localhost/api', {
              method: 'POST',
              headers: { origin: 'https://other.test' },
            }),
          )
          expect(crossSite.status).toBe(403)
          const spoofed = await decisionRoute.POST(
            new Request('http://localhost/api', {
              method: 'POST',
              headers: { origin: 'http://localhost', 'content-type': 'application/json' },
              body: JSON.stringify({ ...input, actorId: 'forged-admin' }),
            }),
            { params: Promise.resolve({ id: large.id }) },
          )
          expect(spoofed.status).toBe(400)
        },
      )
      expect(digest(await admin.baremeFile.findMany({ take: 100, orderBy: { id: 'asc' } }))).toBe(
        digest(before),
      )
      expect(await legacyState()).toEqual(legacyBefore)
      expect(blobAccess).not.toHaveBeenCalled()
      expect(cacheInvalidation).not.toHaveBeenCalled()
      console.info(
        JSON.stringify({
          realValues: initial.candidate.count,
          firstImport: true,
          syntheticChanges: comparison.counts,
          historicalTablesInaccessible: true,
          historicalDataUnchanged: true,
          sharedBlobUntouched: true,
          sharedCacheUntouched: true,
          concurrency: true,
          permissions: true,
        }),
      )
    } finally {
      await prisma.$disconnect()
      await admin.$disconnect()
    }
  }, 240000)
})
