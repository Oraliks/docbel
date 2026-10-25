'use client'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/i18n/format'
import type { Locale } from '@/i18n/locales'
import type { Difference, RateValue, Workspace } from '@/lib/baremes-autonome/types'

export function useRateLabels() {
  const t = useTranslations('admin.autonomousRates'),
    e = useTranslations('admin.autonomousRates.employee'),
    locale = useLocale()
  const label = (value: RateValue) =>
    value.category && /^(?:MIN|[1-9]\d*)$/.test(value.label)
      ? value.label === 'MIN'
        ? t('minimum')
        : t('salaryBand', { code: value.label })
      : value.table === 'activation_allowances'
        ? value.context[0]
        : value.source.sheet === 'Loonschijven_Tranches salariale' && value.unit === 'EUR/day'
          ? t('salaryBand', { code: value.code })
          : value.label
  const number = (raw: string) => {
    if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return raw
    const [integer, fraction] = raw.split('.'),
      parts = new Intl.NumberFormat(locale).formatToParts(1.1)
    return (
      (integer === '-0' ? '-' : '') +
      new Intl.NumberFormat(locale).format(BigInt(integer)) +
      (fraction ? `${parts.find((part) => part.type === 'decimal')?.value ?? ','}${fraction}` : '')
    )
  }
  const unit = (value: RateValue) =>
    e(
      `units.${value.unit.replaceAll('/', '_') as 'EUR_day' | 'EUR_month' | 'EUR_hour' | 'EUR_year' | 'EUR_half-day' | 'EUR' | 'ratio' | 'number'}`,
    )
  const amount = (value: RateValue | null) => {
    if (!value) return e('absent')
    if (value.valueKind) return value.value
    const [integer, fraction = ''] = value.value.split('.')
    const raw = value.unit.startsWith('EUR') ? `${integer}.${fraction.padEnd(2, '0')}` : value.value
    return `${number(raw)} ${unit(value)}`
  }
  const percent = (raw: string) => {
    const negative = raw.startsWith('-'),
      [integer, fraction = ''] = raw.replace(/^-/, '').split('.')
    const hundred = BigInt(100),
      zero = BigInt(0)
    let scaled = BigInt(integer) * hundred + BigInt((fraction + '00').slice(0, 2))
    if (Number(fraction[2] ?? 0) >= 5) scaled++
    if (scaled === zero && /[1-9]/.test(raw)) return number(raw)
    return number(
      `${negative && scaled !== zero ? '-' : ''}${scaled / hundred}.${String(scaled % hundred).padStart(2, '0')}`,
    )
  }
  return { t, e, label, number, unit, amount, percent }
}
export function ChangeValues({ row }: { row: Difference }) {
  const { t, amount } = useRateLabels()
  return (
    <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div>
        <span className="mb-1 block text-xs text-muted-foreground">{t('oldValue')}</span>
        <span className="break-words font-medium tabular-nums">{amount(row.before)}</span>
      </div>
      <span aria-hidden className="hidden text-muted-foreground sm:block">
        →
      </span>
      <div>
        <span className="mb-1 block text-xs text-muted-foreground">{t('newValue')}</span>
        <span className="break-words font-semibold tabular-nums">{amount(row.after)}</span>
      </div>
    </div>
  )
}
export function SourceDetails({ row, workspace }: { row: Difference; workspace: Workspace }) {
  const { t, e, number } = useRateLabels(),
    locale = useLocale() as Locale
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer font-medium">{e('sources')}</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {(['before', 'after'] as const).map((side) => {
          const value = row[side],
            version = side === 'before' ? workspace.reference : workspace.candidate
          return (
            <section key={side} className="min-w-0 space-y-2 break-words text-sm">
              <h3 className="font-semibold">{t(side)}</h3>
              {value && version ? (
                <>
                  <p>{version.name}</p>
                  <p>
                    {t('source')}: {value.source.sheet} · {value.source.cell}
                  </p>
                  <p>
                    {t('effectiveDate')}:{' '}
                    {value.effectiveFrom || version.effectiveFrom
                      ? formatDate(value.effectiveFrom ?? version.effectiveFrom!, locale)
                      : t('unknown')}
                  </p>
                  <SourceDownload id={version.id} name={version.name} />
                  <details>
                    <summary className="cursor-pointer text-muted-foreground">{e('technical')}</summary>
                    <p className="break-all font-mono text-xs">
                      {t('code')}: {value.code}
                      <br />
                      {t('revision')}: {version.revision}
                      <br />
                      {t('formula')}: {value.source.formula ?? t('noFormula')}
                    </p>
                    {value.indexation && (
                      <p>
                        {t('indexationMultiplier')}: {number(value.indexation.value)} (
                        {value.indexation.source.sheet} · {value.indexation.source.cell})
                      </p>
                    )}
                  </details>
                </>
              ) : (
                <p>{e('absent')}</p>
              )}
            </section>
          )
        })}
      </div>
    </details>
  )
}
function SourceDownload({ id, name }: { id: string; name: string }) {
  const { t, e } = useRateLabels(),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false)
  const download = async () => {
    setBusy(true)
    setError(false)
    try {
      const response = await fetch(`/api/admin/baremes-autonome/versions/${id}/source`, { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <Button variant="outline" disabled={busy} onClick={() => void download()}>
        {error ? e('retry') : t('downloadSource')}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {e('sourceError')}
        </p>
      )}
    </div>
  )
}
