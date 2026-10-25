import { Prisma } from '@prisma/client'
import { digest } from './compare'
import { assertIntegrity, loadComparison, RateError, withRateMutation } from './service'
import { REVIEW_POLICY, taskRows } from './review-policy'
import type { DecisionInput } from './review-types'
import { DOCUMENTARY_REASONS, INSTITUTIONAL_DOMAINS } from './decision-reasons'

/** Append-only decisions: publications and old decisions are never rewritten. */
export async function saveDecision(id: string, input: DecisionInput, actorId: string) {
  return withRateMutation(async (tx) => {
    const { candidate, reference, workspace, rows } = await loadComparison(tx, id)
    if (candidate.publishedAt) throw new RateError('ALREADY_PUBLISHED', 409)
    const task = workspace.review!.tasks.find((task) => task.id === input.taskId)
    if (
      !task ||
      input.fingerprint !== workspace.review!.fingerprint ||
      digest(input.snapshot) !== digest(workspace.snapshot)
    )
      throw new RateError('STALE_COMPARISON', 409)
    if (!task.admissible) throw new RateError('BLOCKED')
    const keys = [...input.memberKeys].sort()
    if (
      new Set(keys).size !== keys.length ||
      digest(keys) !== task.scopeDigest ||
      input.scopeDigest !== task.scopeDigest
    )
      throw new RateError('INVALID_SCOPE', 400)
    if (input.reason.trim().length < 8 || input.reason.length > 1000)
      throw new RateError('INVALID_REASON', 400)
    if (input.status === 'accepted' && !input.checkedSources) throw new RateError('SOURCES_REQUIRED', 400)
    if (
      input.status === 'accepted' &&
      input.documentaryOnly &&
      (input.officialSource || input.regulatoryScope)
    )
      throw new RateError('INVALID_DECISION', 400)
    if (
      task.kind === 'removal' &&
      input.status === 'accepted' &&
      input.effectiveDate !== candidate.effectiveFrom?.toISOString().slice(0, 10)
    )
      throw new RateError('INVALID_EFFECTIVE_DATE', 400)
    if (
      input.status === 'accepted' &&
      input.documentaryOnly &&
      input.reason !== DOCUMENTARY_REASONS[task.kind]
    )
      throw new RateError('OFFICIAL_SOURCE_REQUIRED', 400)
    if (!input.documentaryOnly && input.status === 'accepted') {
      let url: URL
      try {
        url = new URL(input.officialSource ?? '')
      } catch {
        throw new RateError('OFFICIAL_SOURCE_REQUIRED', 400)
      }
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        !INSTITUTIONAL_DOMAINS.some(
          (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
        ) ||
        !input.regulatoryScope ||
        !(['region', 'population', 'newRequests', 'existingCases'] as const).every(
          (field) =>
            typeof input.regulatoryScope?.[field] === 'string' &&
            input.regulatoryScope[field].trim().length >= 2,
        )
      )
        throw new RateError('OFFICIAL_SOURCE_REQUIRED', 400)
    }
    const latest = task.decision
    if (
      latest?.status === input.status &&
      latest.actorId === actorId &&
      latest.reason === input.reason.trim() &&
      latest.officialSource === (input.officialSource || null) &&
      (latest.regulatoryScope ?? null) ===
        (input.regulatoryScope ? JSON.stringify(input.regulatoryScope) : null) &&
      latest.effectiveDate === (input.effectiveDate || null)
    )
      return { id: latest.id }
    if (input.previousDecisionId !== (latest?.id ?? undefined)) throw new RateError('STALE_COMPARISON', 409)
    if (input.status === 'revoked' && latest?.status !== 'accepted')
      throw new RateError('INVALID_DECISION', 400)
    assertIntegrity(candidate, reference)
    const members = taskRows(task, rows)
    const reading = candidate.reading as unknown as import('./types').Reading
    const evidence = {
      snapshot: workspace.snapshot,
      policy: REVIEW_POLICY,
      reader: reading.parserVersion,
      identity: reading.identityVersion ?? 1,
      memberKeys: keys,
      scopeDigest: task.scopeDigest,
      members,
      scope: reading.scope?.find((scope) => scope.sheet === task.sheet),
      checkedSources: input.checkedSources,
      documentaryOnly: input.documentaryOnly,
    }
    return tx.autonomousRateDecision.create({
      data: {
        candidateId: id,
        referenceId: reference?.id ?? null,
        fingerprint: input.fingerprint,
        taskId: task.id,
        kind: task.kind,
        status: input.status,
        reason: input.reason.trim(),
        officialSource: input.officialSource || null,
        regulatoryScope: input.regulatoryScope ? JSON.stringify(input.regulatoryScope) : null,
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
        evidence: evidence as unknown as Prisma.InputJsonValue,
        previousId: latest?.id ?? null,
        actorId,
      },
      select: { id: true },
    })
  })
}
