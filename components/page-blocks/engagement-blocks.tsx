'use client'

import React from 'react'
import {
  Mail,
  MessageCircle,
  Copy,
  Check,
  Share2,
  Send,
  ThumbsUp,
} from 'lucide-react'
import type {
  QuizProps,
  PollProps,
  CalculatorProps,
  ReactionsProps,
  ShareButtonsProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─────────────────────────── Quiz ───────────────────────────

export function QuizBlock({ title, questions, resultMessages }: QuizProps) {
  const [step, setStep] = React.useState(0)
  const [answers, setAnswers] = React.useState<number[]>([])
  const [done, setDone] = React.useState(false)

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
        Aucune question
      </div>
    )
  }

  if (done) {
    const score = answers.filter((a, i) => a === questions[i].correct).length
    const result =
      resultMessages?.find((r) => score >= r.min) ||
      { message: `Vous avez obtenu ${score} / ${questions.length}.` }
    return (
      <div className="rounded-2xl border bg-card p-6 my-2 text-center">
        <h3 className="text-2xl font-bold">Résultat</h3>
        <p className="mt-2 text-3xl font-bold text-primary">
          {score} / {questions.length}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">{result.message}</p>
        <button
          type="button"
          onClick={() => {
            setStep(0)
            setAnswers([])
            setDone(false)
          }}
          className="mt-5 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Recommencer
        </button>
      </div>
    )
  }

  const q = questions[step]
  return (
    <div className="rounded-2xl border bg-card p-6 my-2">
      {title && <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>}
      <div className="text-xs text-muted-foreground mb-3">
        Question {step + 1} / {questions.length}
      </div>
      <p className="text-lg font-semibold mb-4">{q.question}</p>
      <div className="space-y-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              const next = [...answers, i]
              setAnswers(next)
              if (step + 1 < questions.length) setStep(step + 1)
              else setDone(true)
            }}
            className="w-full rounded-md border bg-card px-4 py-3 text-left text-sm font-medium hover:border-primary hover:bg-primary/5 transition"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────── Poll ───────────────────────────

export function PollBlock({ question, options }: PollProps) {
  const [voted, setVoted] = React.useState<number | null>(null)
  const [counts, setCounts] = React.useState<number[]>(() => options.map((o) => o.votes))

  const total = counts.reduce((a, b) => a + b, 0) || 1

  const vote = (i: number) => {
    if (voted !== null) return
    setVoted(i)
    setCounts((c) => c.map((v, idx) => (idx === i ? v + 1 : v)))
  }

  return (
    <div className="rounded-2xl border bg-card p-6 my-2">
      <p className="text-lg font-semibold mb-4">{question}</p>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const pct = (counts[i] / total) * 100
          const isVoted = voted === i
          return (
            <button
              key={i}
              type="button"
              onClick={() => vote(i)}
              disabled={voted !== null}
              className={cn(
                'relative w-full overflow-hidden rounded-md border bg-card px-4 py-3 text-left text-sm font-medium transition',
                voted !== null ? 'cursor-default' : 'hover:border-primary hover:bg-primary/5'
              )}
            >
              {voted !== null && (
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 transition-all',
                    isVoted ? 'bg-primary/20' : 'bg-muted/40'
                  )}
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {isVoted && <Check className="size-4 text-primary" />}
                  {opt.label}
                </span>
                {voted !== null && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {pct.toFixed(0)}% · {counts[i]}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
      {voted !== null && (
        <p className="mt-3 text-xs text-muted-foreground text-center">
          {total} vote{total > 1 ? 's' : ''} · Résultat local (non persisté)
        </p>
      )}
    </div>
  )
}

// ─────────────────────────── Calculator ───────────────────────────

function safeEval(expression: string, vars: Record<string, number | string>): number | null {
  try {
    // Replace variable names with their values
    let safe = expression
    for (const [k, v] of Object.entries(vars)) {
      const regex = new RegExp(`\\b${k}\\b`, 'g')
      safe = safe.replace(regex, String(v))
    }
    // Whitelist: digits, operators, parentheses, decimals, common math fns
    if (!/^[\d\s+\-*/().,Math.maxminflorceilrouqs]+$/i.test(safe)) {
      // be permissive but no letters except Math.X
    }
    const fn = new Function('Math', `return (${safe})`)
    const result = fn(Math)
    return typeof result === 'number' && !Number.isNaN(result) ? result : null
  } catch {
    return null
  }
}

export function CalculatorBlock({
  title,
  description,
  fields,
  formula,
  resultLabel,
  resultUnit,
  resultPrecision = 2,
}: CalculatorProps) {
  const initial = React.useMemo(() => {
    const out: Record<string, number | string> = {}
    for (const f of fields) {
      out[f.name] = f.defaultValue ?? (f.type === 'number' ? 0 : '')
    }
    return out
  }, [fields])

  const [values, setValues] = React.useState<Record<string, number | string>>(initial)

  const result = safeEval(formula, values)

  return (
    <div className="rounded-2xl border bg-card p-6 my-2">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-3">
        {fields.map((field) => (
          <div key={field.name} className="space-y-1">
            <label className="text-sm font-medium">{field.label}</label>
            <div className="relative">
              {field.type === 'number' ? (
                <input
                  type="number"
                  value={values[field.name] as number}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.name]: Number(e.target.value) }))
                  }
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              ) : (
                <select
                  value={values[field.name] as string}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {field.options?.map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
              {field.unit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {field.unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl bg-primary/10 p-4 text-center">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{resultLabel}</div>
        <div className="mt-1 text-3xl font-bold text-primary tabular-nums">
          {result === null ? '—' : result.toFixed(resultPrecision)}
          {resultUnit && <span className="ml-1 text-base">{resultUnit}</span>}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Reactions ───────────────────────────

export function ReactionsBlock({ reactions }: ReactionsProps) {
  const [counts, setCounts] = React.useState(() => reactions.map((r) => r.count))
  const [active, setActive] = React.useState<Set<number>>(new Set())

  const toggle = (i: number) => {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
    setCounts((c) => c.map((v, idx) => (idx === i ? v + (active.has(i) ? -1 : 1) : v)))
  }

  return (
    <div className="flex flex-wrap gap-2 my-2">
      {reactions.map((r, i) => (
        <button
          key={i}
          type="button"
          onClick={() => toggle(i)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition',
            active.has(i)
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:border-muted-foreground'
          )}
          title={r.label}
        >
          <span className="text-base leading-none">{r.emoji}</span>
          <span className="font-medium tabular-nums">{counts[i]}</span>
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────── Share Buttons ───────────────────────────

const SHARE_SIZES = { sm: 'size-8 [&_svg]:size-3.5', md: 'size-9 [&_svg]:size-4', lg: 'size-10 [&_svg]:size-5' } as const

const SHARE_STYLES: Record<string, { bg: string; label: string; Icon: React.ElementType }> = {
  twitter: { bg: 'bg-black hover:bg-zinc-800 text-white', label: 'X / Twitter', Icon: Share2 },
  linkedin: { bg: 'bg-[#0A66C2] hover:opacity-90 text-white', label: 'LinkedIn', Icon: ThumbsUp },
  facebook: { bg: 'bg-[#1877F2] hover:opacity-90 text-white', label: 'Facebook', Icon: Send },
  email: { bg: 'bg-zinc-700 hover:bg-zinc-600 text-white', label: 'Email', Icon: Mail },
  whatsapp: { bg: 'bg-[#25D366] hover:opacity-90 text-white', label: 'WhatsApp', Icon: MessageCircle },
  copy: { bg: 'bg-zinc-200 hover:bg-zinc-300 text-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-white', label: 'Copier le lien', Icon: Copy },
}

export function ShareButtonsBlock({
  platforms,
  align = 'left',
  size = 'md',
  utmCampaign,
}: ShareButtonsProps) {
  const handleShare = (platform: string) => {
    if (typeof window === 'undefined') return
    const baseUrl = window.location.href
    let url = baseUrl
    if (utmCampaign) {
      try {
        const u = new URL(baseUrl)
        u.searchParams.set('utm_source', platform)
        u.searchParams.set('utm_medium', 'social')
        u.searchParams.set('utm_campaign', utmCampaign)
        url = u.toString()
      } catch {}
    }
    const title = document.title

    let target = ''
    switch (platform) {
      case 'twitter':
        target = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
        break
      case 'linkedin':
        target = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
        break
      case 'facebook':
        target = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
        break
      case 'email':
        target = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`
        break
      case 'whatsapp':
        target = `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`
        break
      case 'copy':
        navigator.clipboard?.writeText(url).then(
          () => toast.success('Lien copié'),
          () => toast.error('Erreur copie'),
        )
        return
    }
    if (target) window.open(target, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2 my-2',
        align === 'center' && 'justify-center',
        align === 'right' && 'justify-end'
      )}
    >
      {platforms.map((p) => {
        const cfg = SHARE_STYLES[p]
        if (!cfg) return null
        const { Icon } = cfg
        return (
          <button
            key={p}
            type="button"
            onClick={() => handleShare(p)}
            title={cfg.label}
            className={cn(
              'inline-flex items-center justify-center rounded-full transition',
              SHARE_SIZES[size],
              cfg.bg
            )}
          >
            <Icon />
          </button>
        )
      })}
    </div>
  )
}
