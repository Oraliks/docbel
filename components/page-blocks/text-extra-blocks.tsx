'use client'

import React from 'react'
import { Check, X, Copy } from 'lucide-react'
import type {
  CodeBlockProps,
  PullQuoteProps,
  DropCapProps,
  DefinitionListProps,
  HighlightProps,
  ProsConsProps,
  ChecklistProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─────────────────────────── Code Block ───────────────────────────

export function CodeBlockBlock({ code, language, filename, showLineNumbers }: CodeBlockProps) {
  const lines = code.split('\n')
  const handleCopy = () => {
    navigator.clipboard?.writeText(code).then(
      () => toast.success('Code copié'),
      () => toast.error('Erreur copie'),
    )
  }
  return (
    <div className="rounded-lg overflow-hidden border bg-zinc-950 text-zinc-200 my-2">
      {(filename || language) && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 text-xs">
          <div className="flex items-center gap-2">
            {filename && <span className="font-mono text-zinc-300">{filename}</span>}
            {language && <span className="text-zinc-500">{language}</span>}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded px-2 py-1 hover:bg-zinc-800 transition flex items-center gap-1.5"
          >
            <Copy className="size-3" />
            Copier
          </button>
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              {showLineNumbers && (
                <span className="select-none pr-4 text-zinc-600 text-right w-8 shrink-0">
                  {i + 1}
                </span>
              )}
              <span className="flex-1">{line || ' '}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  )
}

// ─────────────────────────── Pull Quote ───────────────────────────

export function PullQuoteBlock({ text, author, align = 'center' }: PullQuoteProps) {
  return (
    <blockquote
      className={cn(
        'my-8 px-6',
        align === 'left' && 'text-left border-l-4 border-primary pl-6',
        align === 'right' && 'text-right border-r-4 border-primary pr-6',
        align === 'center' && 'text-center',
      )}
    >
      <p className="text-2xl md:text-3xl lg:text-4xl font-medium leading-tight italic">
        “{text}”
      </p>
      {author && (
        <cite className="mt-4 block text-sm font-medium not-italic text-muted-foreground">
          — {author}
        </cite>
      )}
    </blockquote>
  )
}

// ─────────────────────────── Drop Cap ───────────────────────────

export function DropCapBlock({ html, capColor }: DropCapProps) {
  // Extract first character and wrap it
  const stripped = html.replace(/<[^>]+>/g, '').trim()
  const first = stripped.charAt(0)
  const rest = stripped.slice(1)
  return (
    <div className="prose-tight max-w-none my-3">
      <p className="text-base leading-relaxed">
        <span
          className="float-left text-6xl md:text-7xl font-bold leading-none mr-3 mt-1"
          style={{ color: capColor || 'currentColor', lineHeight: '0.85' }}
        >
          {first}
        </span>
        {rest}
      </p>
    </div>
  )
}

// ─────────────────────────── Definition List ───────────────────────────

export function DefinitionListBlock({ items }: DefinitionListProps) {
  return (
    <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 my-2">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <dt className="font-semibold md:col-span-1">{item.term}</dt>
          <dd className="text-sm text-muted-foreground md:col-span-2 leading-relaxed">
            {item.definition}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

// ─────────────────────────── Highlight ───────────────────────────

const HIGHLIGHT_COLORS: Record<NonNullable<HighlightProps['color']>, string> = {
  yellow: 'bg-yellow-200 dark:bg-yellow-500/30',
  green: 'bg-emerald-200 dark:bg-emerald-500/30',
  pink: 'bg-pink-200 dark:bg-pink-500/30',
  blue: 'bg-blue-200 dark:bg-blue-500/30',
  orange: 'bg-orange-200 dark:bg-orange-500/30',
}

export function HighlightBlock({ text, color = 'yellow' }: HighlightProps) {
  return (
    <p className="my-2">
      <mark className={cn('px-1.5 py-0.5 rounded', HIGHLIGHT_COLORS[color])}>{text}</mark>
    </p>
  )
}

// ─────────────────────────── Pros / Cons ───────────────────────────

export function ProsConsBlock({
  pros,
  cons,
  prosTitle = 'Avantages',
  consTitle = 'Inconvénients',
}: ProsConsProps) {
  return (
    <div className="my-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-5">
        <h3 className="mb-3 font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check className="size-5" /> {prosTitle}
        </h3>
        <ul className="space-y-2 text-sm">
          {pros.map((p, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="size-4 mt-0.5 text-emerald-600 shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border-2 border-red-500/30 bg-red-500/5 p-5">
        <h3 className="mb-3 font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
          <X className="size-5" /> {consTitle}
        </h3>
        <ul className="space-y-2 text-sm">
          {cons.map((c, i) => (
            <li key={i} className="flex items-start gap-2">
              <X className="size-4 mt-0.5 text-red-600 shrink-0" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─────────────────────────── Checklist ───────────────────────────

export function ChecklistBlock({ title, items, interactive = true }: ChecklistProps) {
  // Local interactive state — not persisted
  const [checked, setChecked] = React.useState<boolean[]>(() => items.map((it) => !!it.checked))
  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)))

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(items.map((it) => !!it.checked))
  }, [items])

  const completed = checked.filter(Boolean).length

  return (
    <div className="rounded-2xl border bg-card p-5 my-2">
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">
            {completed} / {items.length}
          </span>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => interactive && toggle(i)}
              disabled={!interactive}
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition',
                checked[i]
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input hover:border-muted-foreground',
                !interactive && 'cursor-default'
              )}
            >
              {checked[i] && <Check className="size-3" />}
            </button>
            <span
              className={cn(
                'text-sm leading-snug',
                checked[i] && 'line-through text-muted-foreground'
              )}
            >
              {it.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
