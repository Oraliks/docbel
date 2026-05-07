'use client'

import React from 'react'
import { Calendar, Check, X, FileText, Scale } from 'lucide-react'
import type {
  BelgianDateHelperProps,
  TarifsTableProps,
  EligibilityTestProps,
  LawCitationProps,
  CasePracticeProps,
  RequiredDocsProps,
  LegalDelayProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

// ─────────────────────────── Belgian holidays (2024-2027) ───────────────────────────

const BELGIAN_HOLIDAYS: string[] = [
  // 2024
  '2024-01-01', '2024-04-01', '2024-05-01', '2024-05-09', '2024-05-20',
  '2024-07-21', '2024-08-15', '2024-11-01', '2024-11-11', '2024-12-25',
  // 2025
  '2025-01-01', '2025-04-21', '2025-05-01', '2025-05-29', '2025-06-09',
  '2025-07-21', '2025-08-15', '2025-11-01', '2025-11-11', '2025-12-25',
  // 2026
  '2026-01-01', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25',
  '2026-07-21', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25',
  // 2027
  '2027-01-01', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-17',
  '2027-07-21', '2027-08-15', '2027-11-01', '2027-11-11', '2027-12-25',
]

function isBusinessDay(d: Date): boolean {
  const day = d.getDay()
  if (day === 0 || day === 6) return false
  const iso = d.toISOString().slice(0, 10)
  if (BELGIAN_HOLIDAYS.includes(iso)) return false
  return true
}

// ─────────────────────────── Belgian Date Helper ───────────────────────────

export function BelgianDateHelperBlock({
  startDate,
  daysToAdd,
  countWeekendsAndHolidays,
  label = 'Date de fin',
}: BelgianDateHelperProps) {
  const start = new Date(startDate)
  const end = new Date(start)

  if (countWeekendsAndHolidays === 'all') {
    end.setDate(end.getDate() + daysToAdd)
  } else {
    let added = 0
    while (added < daysToAdd) {
      end.setDate(end.getDate() + 1)
      if (isBusinessDay(end)) added++
    }
  }

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat('fr-BE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)

  return (
    <div className="rounded-2xl border bg-card p-5 my-2">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="size-4 text-primary" />
        <h3 className="font-semibold">{label}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Début</div>
          <div className="mt-0.5 font-medium">{formatDate(start)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Délai</div>
          <div className="mt-0.5 font-medium">
            +{daysToAdd} {countWeekendsAndHolidays === 'businessOnly' ? 'jours ouvrables' : 'jours'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Fin</div>
          <div className="mt-0.5 font-bold text-primary">{formatDate(end)}</div>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground italic">
        {countWeekendsAndHolidays === 'businessOnly'
          ? 'Jours ouvrables : hors weekends et jours fériés belges (Pâques, Toussaint, etc.)'
          : 'Jours calendrier : tous les jours comptés.'}
      </p>
    </div>
  )
}

// ─────────────────────────── Tarifs Table ───────────────────────────

export function TarifsTableBlock({ title, subtitle, rows, source }: TarifsTableProps) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden my-2">
      {(title || subtitle) && (
        <div className="border-b bg-muted/40 p-4">
          {title && <h3 className="font-semibold">{title}</h3>}
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Situation
            </th>
            <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Montant
            </th>
            <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Période
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn(i < rows.length - 1 && 'border-b')}>
              <td className="px-4 py-3">
                <div className="font-medium text-sm">{row.situation}</div>
                {row.remarque && (
                  <div className="text-xs text-muted-foreground mt-0.5">{row.remarque}</div>
                )}
              </td>
              <td className="px-4 py-3 text-right font-bold tabular-nums">{row.montant}</td>
              <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                {row.periode || ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {source && (
        <div className="border-t px-4 py-2 text-[10px] text-muted-foreground italic">
          Source : {source}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Eligibility Test ───────────────────────────

export function EligibilityTestBlock({
  title,
  introText,
  questions,
  rules,
}: EligibilityTestProps) {
  const [answers, setAnswers] = React.useState<(string | null)[]>(() =>
    questions.map(() => null)
  )
  const [done, setDone] = React.useState(false)

  const allAnswered = answers.every((a) => a !== null)

  const yesCount = answers.filter((a) => a === 'yes' || a === 'oui').length

  const passes = (() => {
    if (rules.allYes) return yesCount === questions.length
    if (rules.minYes !== undefined) return yesCount >= rules.minYes
    return true
  })()

  if (done) {
    return (
      <div
        className={cn(
          'rounded-2xl border-2 p-6 my-2',
          passes
            ? 'border-emerald-500 bg-emerald-500/5'
            : 'border-amber-500 bg-amber-500/5'
        )}
      >
        <div className="flex items-start gap-3">
          {passes ? (
            <Check className="size-6 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <X className="size-6 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className="font-bold text-lg">{passes ? 'Vous êtes éligible' : 'Non éligible'}</h3>
            <p className="mt-1 text-sm">{passes ? rules.resultIfPass : rules.resultIfFail}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setAnswers(questions.map(() => null))
            setDone(false)
          }}
          className="mt-4 text-sm font-medium underline-offset-2 hover:underline"
        >
          Refaire le test
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-card p-6 my-2">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      {introText && <p className="mt-1 text-sm text-muted-foreground">{introText}</p>}
      <div className="mt-5 space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="space-y-2">
            <p className="text-sm font-medium">
              <span className="text-primary mr-2">{i + 1}.</span>
              {q.question}
            </p>
            {q.type === 'yesno' ? (
              <div className="grid grid-cols-2 gap-2">
                {['Oui', 'Non'].map((opt) => {
                  const value = opt === 'Oui' ? 'yes' : 'no'
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setAnswers((a) => a.map((v, idx) => (idx === i ? value : v)))
                      }
                      className={cn(
                        'rounded-md border px-3 py-2 text-sm font-medium transition',
                        answers[i] === value
                          ? value === 'yes'
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300'
                          : 'border-input hover:border-muted-foreground'
                      )}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            ) : (
              <select
                value={answers[i] ?? ''}
                onChange={(e) =>
                  setAnswers((a) => a.map((v, idx) => (idx === i ? e.target.value : v)))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Choisir…</option>
                {q.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={!allAnswered}
        onClick={() => setDone(true)}
        className="mt-5 w-full rounded-md bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-50"
      >
        Voir le résultat
      </button>
    </div>
  )
}

// ─────────────────────────── Law Citation ───────────────────────────

export function LawCitationBlock({ reference, text, source, link }: LawCitationProps) {
  return (
    <figure className="rounded-2xl border-l-4 border-primary bg-primary/5 px-5 py-4 my-2">
      <div className="flex items-center gap-2 mb-2">
        <Scale className="size-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          {reference}
        </span>
      </div>
      <blockquote className="text-sm leading-relaxed italic">« {text} »</blockquote>
      {(source || link) && (
        <figcaption className="mt-2 text-xs text-muted-foreground">
          {source && <span>— {source}</span>}
          {link && (
            <>
              {source && ' · '}
              <a href={link} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Voir la source
              </a>
            </>
          )}
        </figcaption>
      )}
    </figure>
  )
}

// ─────────────────────────── Case Practice ───────────────────────────

export function CasePracticeBlock({ title, situation, steps, outcome }: CasePracticeProps) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden my-2">
      <div className="border-b bg-muted/40 px-5 py-3 flex items-center gap-2">
        <FileText className="size-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Cas pratique</span>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed">{situation}</p>
        <div className="mt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Démarche
          </h4>
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        {outcome && (
          <div className="mt-4 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Résultat :</span>{' '}
            {outcome}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── Required Docs ───────────────────────────

export function RequiredDocsBlock({ title, items }: RequiredDocsProps) {
  return (
    <div className="rounded-2xl border bg-card p-5 my-2">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <FileText className="size-4 text-primary" />
          <h3 className="font-semibold">{title}</h3>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((doc, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span
              className={cn(
                'mt-0.5 size-5 rounded-full border-2 flex items-center justify-center shrink-0',
                doc.required ? 'border-primary' : 'border-muted-foreground/40'
              )}
            >
              {doc.required && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <div className="flex-1">
              <span className="font-medium">{doc.name}</span>
              {!doc.required && (
                <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Optionnel
                </span>
              )}
              {doc.description && (
                <div className="mt-0.5 text-xs text-muted-foreground">{doc.description}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─────────────────────────── Legal Delay ───────────────────────────

export function LegalDelayBlock({ delay, context, variant = 'large' }: LegalDelayProps) {
  if (variant === 'inline') {
    return (
      <p className="my-2 inline-flex items-center gap-2 rounded-full border border-primary bg-primary/5 px-3 py-1 text-sm">
        <span className="font-bold text-primary">{delay}</span>
        <span className="text-muted-foreground">{context}</span>
      </p>
    )
  }
  return (
    <div className="rounded-2xl border-2 border-primary bg-primary/5 p-6 my-2 text-center">
      <div className="text-5xl md:text-6xl font-bold tracking-tight text-primary">{delay}</div>
      <p className="mt-2 text-sm text-muted-foreground">{context}</p>
    </div>
  )
}
