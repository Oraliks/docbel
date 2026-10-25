'use client'
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatDate, formatDateTime } from '@/lib/i18n/format'
import { useLocale } from 'next-intl'
import type { Locale } from '@/i18n/locales'
import type { Workspace } from '@/lib/baremes-autonome/types'
import type {
  DecisionStatus,
  ReviewDetails,
  ReviewTask,
  RegulatoryScope,
} from '@/lib/baremes-autonome/review-types'
import { DOCUMENTARY_REASONS } from '@/lib/baremes-autonome/decision-reasons'
import { ChangeValues, SourceDetails, useRateLabels } from './value-view'

export function ReviewDialog({
  task,
  workspace,
  onClose,
  onSaved,
}: {
  task: ReviewTask
  workspace: Workspace
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { t, e, label, number, unit, percent } = useRateLabels(),
    locale = useLocale() as Locale
  const [data, setData] = useState<ReviewDetails | null>(null),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0),
    [reason, setReason] = useState<string>(task.status === 'accepted' ? '' : DOCUMENTARY_REASONS[task.kind]),
    [checked, setChecked] = useState(false),
    [regulatory, setRegulatory] = useState(false),
    [official, setOfficial] = useState(''),
    [scope, setScope] = useState<RegulatoryScope>({
      region: '',
      population: '',
      newRequests: '',
      existingCases: '',
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/admin/baremes-autonome/versions/${workspace.candidate.id}/reviews/${task.id}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error()
        return response.json() as Promise<ReviewDetails>
      })
      .then(setData)
      .catch((cause) => {
        if (cause.name !== 'AbortError') setFailed(true)
      })
    return () => controller.abort()
  }, [workspace.candidate.id, task.id, attempt])
  const save = async (status: DecisionStatus, decisionReason = reason) => {
    if (!data || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/admin/baremes-autonome/versions/${workspace.candidate.id}/decisions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            snapshot: data.snapshot,
            fingerprint: data.fingerprint,
            taskId: task.id,
            memberKeys: data.task.memberKeys,
            scopeDigest: data.task.scopeDigest,
            status,
            reason: decisionReason,
            checkedSources: checked,
            documentaryOnly: !regulatory,
            ...(task.kind === 'removal'
              ? { effectiveDate: workspace.candidate.effectiveFrom?.slice(0, 10) }
              : {}),
            ...(regulatory ? { officialSource: official, regulatoryScope: scope } : {}),
            ...(data.task.decision ? { previousDecisionId: data.task.decision.id } : {}),
          }),
        },
      )
      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.code)
      }
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === 'STALE_COMPARISON'
          ? t('errors.stale')
          : e('decisionError'),
      )
      setBusy(false)
      return
    }
    // A committed decision is reported separately from a failed refresh.
    try {
      await onSaved()
      onClose()
    } catch {
      setError(e('savedRefreshError'))
    } finally {
      setBusy(false)
    }
  }
  const published = !!workspace.candidate.publishedAt,
    accepted = data?.task.status === 'accepted'
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-3xl">
        <DialogClose
          disabled={busy}
          aria-label={t('cancel')}
          render={<Button variant="ghost" size="icon-sm" className="absolute right-2 top-2" />}
        >
          <X className="size-4" />
        </DialogClose>
        <DialogHeader className="pr-8">
          <DialogTitle>
            {e(
              task.kind === 'removal'
                ? 'removalTitle'
                : task.kind === 'amount'
                  ? 'amountTitle'
                  : 'contextTitle',
            )}
          </DialogTitle>
          <DialogDescription>{e('reviewExplanation', { count: task.memberCount })}</DialogDescription>
        </DialogHeader>
        {failed ? (
          <div role="alert">
            <p>{e('detailError')}</p>
            <Button
              onClick={() => {
                setFailed(false)
                setAttempt(attempt + 1)
              }}
            >
              {e('retry')}
            </Button>
          </div>
        ) : !data ? (
          <p role="status">{t('loading')}</p>
        ) : (
          <>
            <p className="text-sm">
              {t('effectiveDate')}:{' '}
              {workspace.candidate.effectiveFrom
                ? formatDate(workspace.candidate.effectiveFrom, locale)
                : t('unknown')}
            </p>
            <p className="rounded-lg bg-muted p-3 text-sm">
              {e(task.kind === 'removal' ? 'removalEffect' : 'reviewEffect')}
            </p>
            <div className="space-y-4">
              {data.members.map((row) => (
                <section key={row.key} className="space-y-3 rounded-xl border p-4">
                  <h3 className="font-semibold">{label((row.after ?? row.before)!)}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('code')}: {(row.after ?? row.before)!.code}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(row.after ?? row.before)!.context.join(' · ')}
                  </p>
                  <ChangeValues row={row} />
                  {data.deltas[row.key] && (
                    <p className="text-sm">
                      {e('delta', {
                        delta: `${number(data.deltas[row.key].delta)} ${unit(row.before!)}`,
                        percent:
                          data.deltas[row.key].percent === null
                            ? e('zeroPercent')
                            : `${percent(data.deltas[row.key].percent!)} %`,
                      })}
                    </p>
                  )}
                  <SourceDetails row={row} workspace={workspace} />
                </section>
              ))}
            </div>
            {task.kind === 'removal' && (
              <details className="rounded-xl border p-4" open>
                <summary className="cursor-pointer font-medium">{e('absenceProof')}</summary>
                <p className="my-2 text-sm">
                  {e(data.evidence.state === 'absent' ? 'sheetAbsent' : 'regionRead', {
                    sheet: data.evidence.sheet,
                    region: data.evidence.region ?? '',
                  })}
                </p>
                {data.evidence.state === 'absent' ? (
                  <ul className="list-inside list-disc text-sm">
                    {data.evidence.presentSheets.map((sheet) => (
                      <li key={sheet}>{sheet}</li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {data.evidence.headers.map((header) => (
                      <li key={header.cell}>
                        {header.cell} · {header.raw}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {e('exactScope', { count: data.task.memberKeys.length })}
                </p>
              </details>
            )}
            {data.task.decision && (
              <div className="rounded-lg border p-3 text-sm">
                <p>{e(accepted ? 'accepted' : 'pending')}</p>
                <p>{data.task.decision.reason}</p>
                <p>
                  {e('decisionAudit', {
                    actor: data.task.decision.actorId,
                    date: formatDateTime(data.task.decision.createdAt, locale),
                  })}
                </p>
              </div>
            )}
            {!published && task.admissible && (
              <fieldset disabled={busy} className="space-y-4">
                <label className="block space-y-2 text-sm font-medium">
                  <span>{e('reason')}</span>
                  {regulatory || accepted ? (
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="w-full rounded-lg border bg-background p-3"
                    />
                  ) : (
                    <select
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="w-full rounded-lg border bg-background p-3"
                    >
                      <option value={DOCUMENTARY_REASONS[task.kind]}>
                        {e(`documentaryReasons.${task.kind}`)}
                      </option>
                    </select>
                  )}
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  {e('checkedSources')}
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={regulatory}
                    onChange={(event) => {
                      setRegulatory(event.target.checked)
                      setReason(event.target.checked ? '' : DOCUMENTARY_REASONS[task.kind])
                    }}
                  />
                  {e('regulatory')}
                </label>
                {regulatory && (
                  <>
                    <label className="block space-y-2 text-sm">
                      <span>{e('officialSource')}</span>
                      <Input
                        type="url"
                        value={official}
                        onChange={(event) => setOfficial(event.target.value)}
                      />
                    </label>
                    <fieldset className="space-y-3">
                      <legend className="mb-2 text-sm font-medium">{e('regulatoryScope')}</legend>
                      {(['region', 'population', 'newRequests', 'existingCases'] as const).map((field) => (
                        <label key={field} className="block space-y-1 text-sm">
                          <span>{e(`scopeFields.${field}`)}</span>
                          <Input
                            value={scope[field]}
                            maxLength={200}
                            onChange={(event) => setScope({ ...scope, [field]: event.target.value })}
                          />
                        </label>
                      ))}
                    </fieldset>
                  </>
                )}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {accepted ? (
                    <Button
                      variant="outline"
                      disabled={reason.trim().length < 8}
                      onClick={() => void save('revoked')}
                    >
                      {e('revoke')}
                    </Button>
                  ) : (
                    <>
                      <Button
                        disabled={
                          !checked ||
                          reason.trim().length < 8 ||
                          (regulatory &&
                            (!official || Object.values(scope).some((value) => value.trim().length < 3)))
                        }
                        onClick={() => void save('accepted')}
                      >
                        {e(task.kind === 'removal' ? 'acceptRemoval' : 'confirmAmount')}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={reason.trim().length < 8}
                        onClick={() =>
                          void save('deferred', 'Décision différée pour vérification complémentaire')
                        }
                      >
                        {e('defer')}
                      </Button>
                    </>
                  )}
                </div>
              </fieldset>
            )}
          </>
        )}
        <DialogClose disabled={busy} render={<Button variant="outline" />}>
          {t('cancel')}
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
