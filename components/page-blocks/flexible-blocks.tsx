'use client'

/* eslint-disable @next/next/no-img-element */

import React from 'react'
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  Eye,
  ChevronDown,
  Info,
  Lightbulb,
  AlertTriangle,
  StickyNote,
  RotateCw,
  Volume2,
  X as XIcon,
  Type as TypeIcon,
  Contrast,
  Loader2,
  Check,
  Heart,
} from 'lucide-react'
import type {
  BentoGridProps,
  SplitSectionProps,
  StickyDuoProps,
  FlexContainerProps,
  MagazineColumnsProps,
  RadarChartProps,
  FunnelChartProps,
  GaugeProps,
  StackedBarProps,
  MultiLineProps,
  SpoilerProps,
  AsideProps,
  EditorNoteProps,
  DialogBlockProps,
  DiffViewerProps,
  MathLatexProps,
  FeedbackBarProps,
  SuggestionBoxProps,
  MultiStepFormProps,
  DonationProps,
  SalaireNetBEProps,
  PreavisCCT109Props,
  AllocationsFamilialesProps,
  PostalToCommuneProps,
  BceValidatorProps,
  GradientMeshProps,
  SectionDividerProps,
  GlassCardProps,
  TypewriterProps,
  KenBurnsProps,
  ParticlesProps,
  NewsTickerProps,
  FlashcardsProps,
  TtsButtonProps,
  A11yToolbarProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const CHART_COLORS = ['#C8102E', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

// ════════════════════════════════════════════════════════════════════
//  Layout-flex
// ════════════════════════════════════════════════════════════════════

const BENTO_COLS_CLASS: Record<NonNullable<BentoGridProps['cols']>, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  6: 'grid-cols-3 md:grid-cols-6',
}

export function BentoGridBlock({ title, cells, cols = 4 }: BentoGridProps) {
  return (
    <div className="my-2">
      {title && <h2 className="text-2xl font-bold tracking-tight mb-4">{title}</h2>}
      <div className={cn('grid gap-3 auto-rows-[140px]', BENTO_COLS_CLASS[cols])}>
        {cells.map((cell, i) => {
          const colSpan = cell.span.col ? `md:col-span-${cell.span.col}` : ''
          const rowSpan = cell.span.row ? `row-span-${cell.span.row}` : ''
          const Inner = (
            <div
              className={cn(
                'rounded-2xl border p-5 transition relative overflow-hidden',
                cell.variant === 'highlighted' && 'bg-primary text-primary-foreground border-primary',
                cell.variant === 'minimal' && 'bg-transparent border-dashed',
                !cell.variant || cell.variant === 'default' ? 'bg-card hover:shadow-md' : '',
                cell.href && 'cursor-pointer'
              )}
              style={{ backgroundColor: cell.bgColor }}
            >
              {cell.image && (
                <img
                  src={cell.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-40"
                />
              )}
              <div className="relative">
                {cell.title && <h3 className="font-semibold text-lg">{cell.title}</h3>}
                {cell.description && <p className="mt-1 text-sm opacity-80">{cell.description}</p>}
              </div>
            </div>
          )
          return (
            <div key={i} className={cn(colSpan, rowSpan)} style={{
              gridColumn: cell.span.col ? `span ${cell.span.col} / span ${cell.span.col}` : undefined,
              gridRow: cell.span.row ? `span ${cell.span.row} / span ${cell.span.row}` : undefined,
            }}>
              {cell.href ? <a href={cell.href} className="block h-full">{Inner}</a> : <div className="h-full">{Inner}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const SPLIT_RATIO_CLASS: Record<SplitSectionProps['ratio'], string> = {
  '50-50': 'md:grid-cols-2',
  '60-40': 'md:grid-cols-[3fr_2fr]',
  '40-60': 'md:grid-cols-[2fr_3fr]',
  '70-30': 'md:grid-cols-[7fr_3fr]',
  '30-70': 'md:grid-cols-[3fr_7fr]',
}

export function SplitSectionBlock({
  ratio,
  reverseOnMobile,
  children,
}: SplitSectionProps & { children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        'grid gap-6 my-2',
        SPLIT_RATIO_CLASS[ratio],
        reverseOnMobile && 'flex flex-col-reverse md:grid'
      )}
    >
      {children}
    </div>
  )
}

export function StickyDuoBlock({
  stickySide,
  topOffset = 80,
  children,
}: StickyDuoProps & { children?: React.ReactNode }) {
  // Children should be 2 elements; we wrap each according to sticky side.
  // Treats both columns as siblings rendered server-side.
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-2 items-start">
      {React.Children.map(children, (child, i) => (
        <div
          key={i}
          className={cn(
            (stickySide === 'left' && i === 0) || (stickySide === 'right' && i === 1)
              ? 'md:sticky'
              : ''
          )}
          style={{
            top:
              (stickySide === 'left' && i === 0) || (stickySide === 'right' && i === 1)
                ? topOffset
                : undefined,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  )
}

const FLEX_GAP: Record<NonNullable<FlexContainerProps['gap']>, string> = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-10',
}

export function FlexContainerBlock({
  direction,
  gap = 'md',
  align = 'start',
  justify = 'start',
  wrap = true,
  children,
}: FlexContainerProps & { children?: React.ReactNode }) {
  const flexDir = `flex-${direction}`
  const alignClass = `items-${align}`
  const justifyClass =
    justify === 'space-between'
      ? 'justify-between'
      : justify === 'space-around'
        ? 'justify-around'
        : `justify-${justify}`
  return (
    <div
      className={cn(
        'flex',
        flexDir,
        FLEX_GAP[gap],
        alignClass,
        justifyClass,
        wrap && 'flex-wrap',
        'my-2'
      )}
    >
      {children}
    </div>
  )
}

const MAG_COLS: Record<MagazineColumnsProps['columns'], string> = {
  2: 'columns-2',
  3: 'md:columns-3',
  4: 'md:columns-4',
}
const MAG_GAP: Record<NonNullable<MagazineColumnsProps['gap']>, string> = {
  sm: 'gap-x-4',
  md: 'gap-x-8',
  lg: 'gap-x-12',
}

export function MagazineColumnsBlock({ html, columns, gap = 'md' }: MagazineColumnsProps) {
  return (
    <div
      className={cn('text-base leading-relaxed my-2 [&_p]:mb-3 [&_p]:break-inside-avoid', MAG_COLS[columns], MAG_GAP[gap])}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ════════════════════════════════════════════════════════════════════
//  Charts-extra
// ════════════════════════════════════════════════════════════════════

export function RadarChartBlock({ title, data, color = '#C8102E', height = 300 }: RadarChartProps) {
  const chartData = data.map((d) => ({ subject: d.label, value: d.value, max: d.max ?? 100 }))
  return (
    <div className="my-2">
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadarChart data={chartData}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="subject" stroke="var(--muted-foreground)" fontSize={11} />
            <PolarRadiusAxis stroke="var(--muted-foreground)" fontSize={10} />
            <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.3} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function FunnelChartBlock({ title, stages, color = '#C8102E' }: FunnelChartProps) {
  const max = Math.max(...stages.map((s) => s.value), 1)
  return (
    <div className="my-2">
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      <div className="space-y-1.5 max-w-2xl mx-auto">
        {stages.map((s, i) => {
          const pct = (s.value / max) * 100
          const dropoff =
            i > 0 ? ((stages[i - 1].value - s.value) / stages[i - 1].value) * 100 : 0
          return (
            <div key={i} className="flex items-center gap-3">
              <div
                className="rounded-md py-3 text-center text-white font-medium text-sm transition-all"
                style={{
                  width: `${pct}%`,
                  minWidth: 100,
                  backgroundColor: color,
                  opacity: 1 - i * 0.12,
                  marginLeft: `${(100 - pct) / 2}%`,
                  marginRight: `${(100 - pct) / 2}%`,
                  marginInline: 'auto',
                }}
              >
                {s.value.toLocaleString('fr-FR')}
              </div>
              <div className="text-xs w-32 shrink-0">
                <div className="font-medium">{s.label}</div>
                {i > 0 && (
                  <div className="text-muted-foreground">-{dropoff.toFixed(0)}%</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GaugeBlock({ label, value, color = '#C8102E', showValue = true }: GaugeProps) {
  const v = Math.max(0, Math.min(100, value))
  const data = [{ name: 'value', value: v, fill: color }]
  return (
    <div className="my-2 inline-block w-48">
      {label && <div className="text-center text-xs font-medium text-muted-foreground mb-1">{label}</div>}
      <div className="relative" style={{ height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="65%"
            outerRadius="100%"
            data={data}
            startAngle={180}
            endAngle={0}
            cx="50%"
            cy="100%"
          >
            <RadialBar
              dataKey="value"
              cornerRadius={10}
              fill={color}
              background={{ fill: 'var(--muted)' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {showValue && (
          <div className="absolute inset-x-0 bottom-2 text-center text-2xl font-bold">{v}%</div>
        )}
      </div>
    </div>
  )
}

export function StackedBarBlock({ title, data, series, height = 300 }: StackedBarProps) {
  const chartData = data.map((d) => ({ label: d.label, ...d.values }))
  return (
    <div className="my-2">
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((key, i) => (
              <Bar key={key} dataKey={key} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function MultiLineBlock({ title, data, series, height = 300 }: MultiLineProps) {
  const chartData = data.map((d) => ({ label: d.label, ...d.values }))
  return (
    <div className="my-2">
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  Text-rich
// ════════════════════════════════════════════════════════════════════

export function SpoilerBlock({ summary, content, variant = 'default' }: SpoilerProps) {
  return (
    <details
      className={cn(
        'rounded-lg my-2 group',
        variant === 'subtle' ? 'border-l-4 border-primary pl-4 py-1' : 'border bg-card p-3'
      )}
    >
      <summary className="cursor-pointer font-medium flex items-center gap-2 list-none">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        <Eye className="size-4 text-muted-foreground" />
        {summary}
      </summary>
      <div className="mt-2 text-sm leading-relaxed">{content}</div>
    </details>
  )
}

const ASIDE_STYLES: Record<NonNullable<AsideProps['variant']>, { class: string; Icon: React.ElementType; label: string }> = {
  info: { class: 'border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-200', Icon: Info, label: 'Info' },
  tip: { class: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200', Icon: Lightbulb, label: 'Astuce' },
  warning: { class: 'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200', Icon: AlertTriangle, label: 'Attention' },
  note: { class: 'border-primary/30 bg-primary/5', Icon: StickyNote, label: 'Note' },
}

export function AsideBlock({ title, content, variant = 'info' }: AsideProps) {
  const style = ASIDE_STYLES[variant]
  const Icon = style.Icon
  return (
    <aside className={cn('rounded-lg border-l-4 p-4 my-2', style.class)}>
      <div className="flex items-start gap-3">
        <Icon className="size-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-sm uppercase tracking-wider">{title || style.label}</div>
          <p className="mt-1 text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    </aside>
  )
}

export function EditorNoteBlock({ content, signedBy }: EditorNoteProps) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 my-2 italic text-sm">
      <span className="font-semibold not-italic uppercase tracking-wider text-xs text-primary mr-2">
        Note de la rédaction
      </span>
      {content}
      {signedBy && <div className="mt-1 text-xs text-muted-foreground not-italic">— {signedBy}</div>}
    </div>
  )
}

export function DialogBlockBlock({ title, turns }: DialogBlockProps) {
  return (
    <div className="my-2">
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      <div className="space-y-2">
        {turns.map((t, i) => {
          const right = t.side === 'right'
          return (
            <div key={i} className={cn('flex gap-2', right && 'justify-end')}>
              <div
                className={cn(
                  'rounded-2xl px-4 py-2 max-w-[75%] text-sm',
                  right
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted rounded-bl-sm'
                )}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-0.5">
                  {t.speaker}
                </div>
                {t.message}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DiffViewerBlock({ before, after, language, filename }: DiffViewerProps) {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  // Naive line-by-line diff: same line = unchanged; different = added/removed
  const result: { type: 'add' | 'del' | 'eq'; text: string }[] = []
  const max = Math.max(beforeLines.length, afterLines.length)
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i]
    const a = afterLines[i]
    if (b === a) {
      result.push({ type: 'eq', text: a ?? '' })
    } else {
      if (b !== undefined) result.push({ type: 'del', text: b })
      if (a !== undefined) result.push({ type: 'add', text: a })
    }
  }
  return (
    <div className="rounded-lg border bg-zinc-950 text-zinc-200 my-2 overflow-hidden">
      {(filename || language) && (
        <div className="border-b border-zinc-800 px-3 py-2 text-xs flex items-center gap-2">
          {filename && <span className="font-mono">{filename}</span>}
          {language && <span className="text-zinc-500">{language}</span>}
        </div>
      )}
      <pre className="overflow-x-auto p-3 text-sm font-mono leading-relaxed">
        {result.map((line, i) => (
          <div
            key={i}
            className={cn(
              'block',
              line.type === 'add' && 'bg-emerald-500/15 text-emerald-300',
              line.type === 'del' && 'bg-red-500/15 text-red-300',
            )}
          >
            <span className="select-none w-4 inline-block">
              {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
            </span>
            {line.text || ' '}
          </div>
        ))}
      </pre>
    </div>
  )
}

export function MathLatexBlock({ formula, display = 'block' }: MathLatexProps) {
  // Very basic: just render the formula in a styled monospace block.
  // For real LaTeX, KaTeX would need to be installed.
  if (display === 'inline') {
    return <span className="font-mono italic mx-1">{formula}</span>
  }
  return (
    <div className="my-2 rounded-lg border bg-muted/50 px-6 py-4 text-center font-mono text-lg italic">
      {formula}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  Engagement-extra
// ════════════════════════════════════════════════════════════════════

export function FeedbackBarBlock({ question, thanksMessage = 'Merci !', endpoint }: FeedbackBarProps) {
  const [voted, setVoted] = React.useState<boolean | null>(null)

  const handleVote = async (helpful: boolean) => {
    setVoted(helpful)
    if (endpoint) {
      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ helpful, page: typeof window !== 'undefined' ? window.location.pathname : '' }),
        })
      } catch {
        // silent
      }
    }
  }

  if (voted !== null) {
    return (
      <div className="rounded-lg border bg-card p-4 my-2 text-center">
        <p className="text-sm text-muted-foreground">{thanksMessage}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4 my-2 flex flex-col sm:flex-row items-center gap-3 justify-center">
      <p className="text-sm font-medium">{question}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleVote(true)}
          className="rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 px-4 py-1.5 text-sm font-medium transition"
        >
          👍 Oui
        </button>
        <button
          type="button"
          onClick={() => handleVote(false)}
          className="rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-700 dark:text-red-300 px-4 py-1.5 text-sm font-medium transition"
        >
          👎 Non
        </button>
      </div>
    </div>
  )
}

export function SuggestionBoxBlock({
  title = 'Une idée à partager ?',
  placeholder = 'Votre suggestion…',
  endpoint,
}: SuggestionBoxProps) {
  const [text, setText] = React.useState('')
  const [submitted, setSubmitted] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    if (endpoint) {
      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suggestion: text }),
        })
      } catch {
        toast.error('Erreur — réessayez')
        return
      }
    }
    setSubmitted(true)
    toast.success('Merci pour votre suggestion !')
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border bg-card p-5 my-2 text-center text-sm">
        ✨ Merci, votre suggestion a été enregistrée.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-5 my-2">
      <h3 className="font-semibold mb-2">{title}</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="mt-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        Envoyer
      </button>
    </form>
  )
}

export function MultiStepFormBlock({
  title,
  steps,
  submitText,
  successMessage = 'Demande envoyée.',
  endpoint = '/api/messages',
}: MultiStepFormProps) {
  const [step, setStep] = React.useState(0)
  const [data, setData] = React.useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const isLast = step === steps.length - 1

  const next = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    const stepData: Record<string, unknown> = {}
    formData.forEach((v, k) => (stepData[k] = v))
    const merged = { ...data, ...stepData }
    setData(merged)
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }
    void (async () => {
      setSubmitting(true)
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        })
        if (res.ok) setDone(true)
        else toast.error('Erreur lors de l\'envoi')
      } catch {
        toast.error('Erreur réseau')
      } finally {
        setSubmitting(false)
      }
    })()
  }

  if (done) {
    return (
      <div className="rounded-2xl border bg-emerald-500/10 border-emerald-500/30 p-6 my-2 flex items-center gap-3">
        <Check className="size-5 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">{successMessage}</p>
      </div>
    )
  }

  const current = steps[step]

  return (
    <div className="rounded-2xl border bg-card p-6 my-2">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <div className="mt-2 mb-4 flex items-center gap-2 text-xs">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div
              className={cn(
                'flex size-7 items-center justify-center rounded-full font-bold transition',
                i < step ? 'bg-primary text-primary-foreground' : '',
                i === step ? 'bg-primary/20 text-primary border-2 border-primary' : '',
                i > step ? 'bg-muted text-muted-foreground' : ''
              )}
            >
              {i < step ? <Check className="size-3" /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-border" />}
          </React.Fragment>
        ))}
      </div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Étape {step + 1} / {steps.length}
      </p>
      <h4 className="mt-1 text-base font-semibold">{current.title}</h4>
      <form onSubmit={next} className="mt-4 space-y-3">
        {current.fields.map((field, i) => (
          <div key={i} className="space-y-1">
            <label className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                name={field.name}
                placeholder={field.placeholder}
                required={field.required}
                rows={3}
                className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            ) : field.type === 'select' ? (
              <select
                name={field.name}
                required={field.required}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">{field.placeholder || 'Choisir…'}</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                name={field.name}
                placeholder={field.placeholder}
                required={field.required}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            )}
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Précédent
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="ml-auto rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting && <Loader2 className="size-3.5 animate-spin" />}
            {isLast ? submitText : 'Suivant'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function DonationBlock({
  title = 'Soutenir le projet',
  description,
  presets,
  buttonText,
  link,
}: DonationProps) {
  const [amount, setAmount] = React.useState<number>(presets[0] ?? 10)
  const [custom, setCustom] = React.useState('')
  const finalAmount = custom ? Number(custom) : amount
  return (
    <div className="rounded-2xl border bg-card p-6 my-2 text-center">
      <Heart className="size-6 mx-auto text-primary mb-2" />
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setAmount(p)
              setCustom('')
            }}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition',
              amount === p && !custom ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary'
            )}
          >
            {p}€
          </button>
        ))}
        <input
          type="number"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Autre"
          className="w-24 rounded-full border px-4 py-2 text-sm text-center"
        />
      </div>
      <a
        href={link || '#'}
        className="mt-4 inline-block rounded-md bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90"
      >
        {buttonText} {finalAmount}€
      </a>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  DocBel calculators (Belgian admin)
// ════════════════════════════════════════════════════════════════════

export function SalaireNetBEBlock({ title = 'Salaire net estimé', defaultBrut = 3000, status = 'isolé' }: SalaireNetBEProps) {
  const [brut, setBrut] = React.useState(defaultBrut)
  const [stat, setStat] = React.useState<'isolé' | 'cohabitant' | 'famille'>(status)

  // Simplified BE income tax + ONSS calculation (rough approximation)
  // Real calc is much more complex (cohabitant, dépendants, etc.)
  const onss = brut * 0.1307 // employee social security ~13.07%
  const imposable = brut - onss
  let baseTax = 0
  // Belgian 2024 brackets (annualized then divided by 12)
  const annualImposable = imposable * 12
  if (annualImposable <= 15820) baseTax = annualImposable * 0.25
  else if (annualImposable <= 27920) baseTax = 15820 * 0.25 + (annualImposable - 15820) * 0.4
  else if (annualImposable <= 48320) baseTax = 15820 * 0.25 + (27920 - 15820) * 0.4 + (annualImposable - 27920) * 0.45
  else baseTax = 15820 * 0.25 + (27920 - 15820) * 0.4 + (48320 - 27920) * 0.45 + (annualImposable - 48320) * 0.5
  const monthlyTax = baseTax / 12
  // Quotient exempté approximatif
  const exonerationStat = stat === 'famille' ? 9700 : 9270
  const reduction = (exonerationStat / 12) * 0.25
  const netImposable = imposable - Math.max(0, monthlyTax - reduction)
  const net = Math.round(netImposable)

  return (
    <div className="rounded-2xl border bg-card p-6 my-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4">Estimation simplifiée — chiffres indicatifs</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Salaire brut mensuel</label>
          <div className="relative mt-1">
            <input
              type="number"
              value={brut}
              onChange={(e) => setBrut(Number(e.target.value))}
              className="w-full rounded-md border bg-background pl-3 pr-10 py-2 text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Situation</label>
          <select
            value={stat}
            onChange={(e) => setStat(e.target.value as 'isolé' | 'cohabitant' | 'famille')}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="isolé">Isolé sans enfants</option>
            <option value="cohabitant">Cohabitant</option>
            <option value="famille">Famille à charge</option>
          </select>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="text-xs text-muted-foreground uppercase">ONSS</div>
          <div className="mt-1 font-semibold tabular-nums">-{Math.round(onss)} €</div>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="text-xs text-muted-foreground uppercase">Impôt</div>
          <div className="mt-1 font-semibold tabular-nums">-{Math.round(monthlyTax - reduction)} €</div>
        </div>
        <div className="rounded-lg bg-primary/10 p-3 border-2 border-primary">
          <div className="text-xs text-primary uppercase font-semibold">Net</div>
          <div className="mt-1 text-xl font-bold text-primary tabular-nums">{net} €</div>
        </div>
      </div>
    </div>
  )
}

export function PreavisCCT109Block({ title = 'Calculateur de préavis (CCT 109)', defaultMonths = 24 }: PreavisCCT109Props) {
  const [months, setMonths] = React.useState(defaultMonths)

  // Simplification of CCT 109 / loi du 26 décembre 2013 schedule (employee dismissed by employer)
  // Source: SPF Emploi (approximations only)
  const calc = (m: number): number => {
    // First 4 months: 1 week / quarter started
    if (m < 3) return 1
    if (m < 6) return 3
    if (m < 9) return 6
    if (m < 12) return 7
    if (m < 15) return 8
    if (m < 18) return 9
    if (m < 21) return 10
    if (m < 24) return 11
    // Then +1 week per year
    const years = Math.floor(m / 12)
    if (years <= 21) return 12 + (years - 2) * 3 // approximate
    return 62 + (years - 20)
  }
  const weeks = calc(months)
  const years = Math.floor(months / 12)
  const remMonths = months % 12

  return (
    <div className="rounded-2xl border bg-card p-6 my-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Estimation pour licenciement par l&apos;employeur · CCT 109 / Loi du 26 décembre 2013
      </p>
      <div>
        <label className="text-sm font-medium">Ancienneté (en mois)</label>
        <input
          type="range"
          min={0}
          max={480}
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="mt-1 w-full"
        />
        <div className="text-xs text-muted-foreground tabular-nums mt-1">
          {years} an{years > 1 ? 's' : ''} {remMonths > 0 && `et ${remMonths} mois`}
        </div>
      </div>
      <div className="mt-5 rounded-xl bg-primary/10 p-5 text-center border-2 border-primary">
        <div className="text-xs uppercase tracking-wider text-primary font-semibold">Délai de préavis</div>
        <div className="mt-1 text-4xl font-bold text-primary tabular-nums">{weeks}</div>
        <div className="text-sm text-muted-foreground">semaines</div>
      </div>
    </div>
  )
}

export function AllocationsFamilialesBlock({ title = 'Allocations familiales', region = 'wallonie' }: AllocationsFamilialesProps) {
  const [r, setR] = React.useState(region)
  const [count, setCount] = React.useState(2)

  // Approximate base amounts per child per region (2024 figures, simplified)
  const RATES: Record<typeof region, number[]> = {
    wallonie: [167, 167, 167], // ~165€ per child + supplements
    bruxelles: [157, 157, 157],
    flandre: [184, 184, 184],
  }
  const total = Array.from({ length: count }, (_, i) => RATES[r][Math.min(i, 2)] || 0).reduce((a, b) => a + b, 0)

  return (
    <div className="rounded-2xl border bg-card p-6 my-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4">Estimation simplifiée — montants de base 2024</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Région</label>
          <select
            value={r}
            onChange={(e) => setR(e.target.value as typeof region)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="wallonie">Wallonie</option>
            <option value="bruxelles">Bruxelles</option>
            <option value="flandre">Flandre</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Nombre d&apos;enfants</label>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value))))}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="mt-5 rounded-xl bg-primary/10 p-4 text-center border-2 border-primary">
        <div className="text-xs uppercase text-primary font-semibold">Estimation mensuelle</div>
        <div className="mt-1 text-3xl font-bold text-primary tabular-nums">{total.toLocaleString('fr-FR')} €</div>
      </div>
    </div>
  )
}

const POSTAL_BE: Record<string, { commune: string; province: string }> = {
  '1000': { commune: 'Bruxelles', province: 'Bruxelles-Capitale' },
  '1050': { commune: 'Ixelles', province: 'Bruxelles-Capitale' },
  '1060': { commune: 'Saint-Gilles', province: 'Bruxelles-Capitale' },
  '1180': { commune: 'Uccle', province: 'Bruxelles-Capitale' },
  '4000': { commune: 'Liège', province: 'Liège' },
  '5000': { commune: 'Namur', province: 'Namur' },
  '6000': { commune: 'Charleroi', province: 'Hainaut' },
  '7000': { commune: 'Mons', province: 'Hainaut' },
  '8000': { commune: 'Bruges', province: 'Flandre-Occidentale' },
  '9000': { commune: 'Gand', province: 'Flandre-Orientale' },
  '2000': { commune: 'Anvers', province: 'Anvers' },
  '3000': { commune: 'Louvain', province: 'Brabant flamand' },
  '1300': { commune: 'Wavre', province: 'Brabant wallon' },
}

export function PostalToCommuneBlock({ title = 'Trouver ma commune', defaultCode = '1000' }: PostalToCommuneProps) {
  const [code, setCode] = React.useState(defaultCode)
  const result = POSTAL_BE[code]
  return (
    <div className="rounded-2xl border bg-card p-5 my-2">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="Code postal (ex. 1000)"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono"
          maxLength={4}
        />
      </div>
      {result ? (
        <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
          <div className="font-bold text-primary">{result.commune}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{result.province}</div>
        </div>
      ) : code.length === 4 ? (
        <p className="mt-3 text-xs text-muted-foreground italic">
          Code postal non trouvé dans la liste de démonstration. Essayez 1000, 4000, 9000…
        </p>
      ) : null}
    </div>
  )
}

export function BceValidatorBlock({ title = 'Vérifier un numéro BCE/KBO' }: BceValidatorProps) {
  const [num, setNum] = React.useState('')
  // BCE format: 0XXX.XXX.XXX or 1XXX.XXX.XXX (10 digits) — checksum: digit#1-8 mod 97 = 97 - check
  const cleaned = num.replace(/\D/g, '')
  const validFormat = /^[01]\d{9}$/.test(cleaned)
  let validChecksum = false
  if (validFormat) {
    const base = parseInt(cleaned.slice(0, 8), 10)
    const check = parseInt(cleaned.slice(8, 10), 10)
    validChecksum = 97 - (base % 97) === check
  }
  const formatted =
    cleaned.length >= 10
      ? `${cleaned.slice(0, 4)}.${cleaned.slice(4, 7)}.${cleaned.slice(7, 10)}`
      : cleaned
  return (
    <div className="rounded-2xl border bg-card p-5 my-2">
      <h3 className="font-semibold mb-3">{title}</h3>
      <input
        value={num}
        onChange={(e) => setNum(e.target.value)}
        placeholder="0XXX.XXX.XXX"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
      />
      {cleaned.length === 10 ? (
        <div
          className={cn(
            'mt-3 rounded-lg p-3 text-sm flex items-center gap-2',
            validChecksum
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-500/10 border border-red-500/30 text-red-900 dark:text-red-200'
          )}
        >
          {validChecksum ? <Check className="size-4" /> : <XIcon className="size-4" />}
          <div>
            <div className="font-medium">{formatted}</div>
            <div className="text-xs opacity-80">
              {validChecksum ? 'Numéro valide (checksum OK)' : 'Numéro invalide (checksum faux)'}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  Decorative
// ════════════════════════════════════════════════════════════════════

export function GradientMeshBlock({ colors, height = 300, animated }: GradientMeshProps) {
  // Multiple radial gradients layered for a "mesh" effect
  const bg = colors
    .map((c, i) => {
      const positions = ['10% 10%', '90% 20%', '20% 80%', '85% 85%', '50% 50%']
      const pos = positions[i % positions.length]
      return `radial-gradient(circle at ${pos}, ${c}aa, transparent 50%)`
    })
    .join(', ')
  return (
    <div
      className={cn('rounded-2xl my-2 overflow-hidden', animated && 'animate-pulse')}
      style={{ backgroundImage: bg, height, backgroundColor: colors[0] }}
    />
  )
}

const SECTION_DIVIDER_PATHS: Record<SectionDividerProps['variant'], string> = {
  wave: 'M0,80 C320,160 720,0 1440,80 L1440,160 L0,160 Z',
  curve: 'M0,160 C480,40 960,40 1440,160 L1440,160 L0,160 Z',
  angle: 'M0,160 L1440,0 L1440,160 Z',
  mountains: 'M0,160 L240,40 L480,120 L720,20 L960,100 L1200,30 L1440,120 L1440,160 Z',
  zigzag: 'M0,160 L120,40 L240,160 L360,40 L480,160 L600,40 L720,160 L840,40 L960,160 L1080,40 L1200,160 L1320,40 L1440,160 Z',
}

export function SectionDividerBlock({ variant, color = 'currentColor', flip, height = 80 }: SectionDividerProps) {
  return (
    <div className="w-full leading-[0]" style={{ transform: flip ? 'scaleY(-1)' : undefined, color }}>
      <svg
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        className="w-full"
        style={{ height, display: 'block' }}
      >
        <path d={SECTION_DIVIDER_PATHS[variant]} fill={color} />
      </svg>
    </div>
  )
}

export function GlassCardBlock({ title, description, blur = 12, bgImage }: GlassCardProps) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden my-2 p-6 min-h-[200px]"
      style={{
        backgroundImage: bgImage ? `url(${bgImage})` : 'linear-gradient(135deg, #C8102E 0%, #3B82F6 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div
        className="absolute inset-4 rounded-xl bg-white/20 dark:bg-black/30 border border-white/30 p-5 text-white"
        style={{ backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)` }}
      >
        {title && <h3 className="text-xl font-bold drop-shadow-md">{title}</h3>}
        {description && <p className="mt-2 text-sm opacity-90 drop-shadow">{description}</p>}
      </div>
    </div>
  )
}

export function TypewriterBlock({ texts, speed = 80, loop = true, cursor = true }: TypewriterProps) {
  const [textIdx, setTextIdx] = React.useState(0)
  const [displayed, setDisplayed] = React.useState('')
  const [phase, setPhase] = React.useState<'typing' | 'pause' | 'erasing'>('typing')

  React.useEffect(() => {
    if (texts.length === 0) return
    const current = texts[textIdx]
    let timer: ReturnType<typeof setTimeout>
    if (phase === 'typing') {
      if (displayed.length < current.length) {
        timer = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), speed)
      } else {
        timer = setTimeout(() => setPhase('pause'), 1500)
      }
    } else if (phase === 'pause') {
      timer = setTimeout(() => setPhase('erasing'), 800)
    } else {
      if (displayed.length > 0) {
        timer = setTimeout(() => setDisplayed(displayed.slice(0, -1)), speed / 2)
      } else {
        const next = (textIdx + 1) % texts.length
        if (!loop && next === 0) {
          // stop
        } else {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setTextIdx(next)
          setPhase('typing')
        }
      }
    }
    return () => clearTimeout(timer)
  }, [displayed, phase, textIdx, texts, speed, loop])

  return (
    <span className="font-medium">
      {displayed}
      {cursor && <span className="inline-block w-0.5 h-[1em] bg-current ml-0.5 align-middle animate-pulse" />}
    </span>
  )
}

export function KenBurnsBlock({ image, caption, duration = 20 }: KenBurnsProps) {
  if (!image) {
    return (
      <div className="aspect-video rounded-lg border border-dashed bg-muted flex items-center justify-center text-sm text-muted-foreground my-2">
        Configurez une image
      </div>
    )
  }
  return (
    <figure className="my-2 overflow-hidden rounded-2xl">
      <div className="aspect-video overflow-hidden">
        <img
          src={image}
          alt=""
          className="w-full h-full object-cover"
          style={{
            animation: `kenburns ${duration}s ease-in-out infinite alternate`,
          }}
        />
      </div>
      {caption && <figcaption className="mt-2 text-sm text-muted-foreground text-center">{caption}</figcaption>}
    </figure>
  )
}

export function ParticlesBlock({ count = 40, color = '#C8102E', speed = 'normal' }: ParticlesProps) {
  const [particles] = React.useState(() =>
    Array.from({ length: count }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 10,
      duration: 5 + Math.random() * (speed === 'slow' ? 15 : speed === 'fast' ? 5 : 10),
      tx: Math.random() * 40 - 20,
      ty: Math.random() * 40 - 20,
    }))
  )
  return (
    <div className="relative my-2 h-48 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 to-primary/20">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            opacity: 0.6,
            animation: `float-${i} ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      <style
        dangerouslySetInnerHTML={{
          __html: particles
            .map(
              (p, i) =>
                `@keyframes float-${i}{0%,100%{transform:translate(0,0)}50%{transform:translate(${p.tx}px,${p.ty}px)}}`
            )
            .join(''),
        }}
      />
    </div>
  )
}

const TICKER_DURATION: Record<NonNullable<NewsTickerProps['speed']>, string> = {
  slow: '60s',
  normal: '30s',
  fast: '15s',
}

export function NewsTickerBlock({ items, speed = 'normal' }: NewsTickerProps) {
  return (
    <div className="my-2 overflow-hidden border-y bg-card py-2">
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{ animation: `ticker ${TICKER_DURATION[speed]} linear infinite` }}
      >
        {[...items, ...items].map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-sm">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            {item.date && <span className="text-xs text-muted-foreground">{item.date}</span>}
            {item.href ? (
              <a href={item.href} className="hover:underline">
                {item.label}
              </a>
            ) : (
              <span>{item.label}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  Education / a11y
// ════════════════════════════════════════════════════════════════════

export function FlashcardsBlock({ title, items }: FlashcardsProps) {
  const [idx, setIdx] = React.useState(0)
  const [flipped, setFlipped] = React.useState(false)

  if (items.length === 0) return null
  const card = items[idx]

  const next = () => {
    setIdx((i) => (i + 1) % items.length)
    setFlipped(false)
  }
  const prev = () => {
    setIdx((i) => (i - 1 + items.length) % items.length)
    setFlipped(false)
  }

  return (
    <div className="my-2 max-w-md mx-auto">
      {title && <h3 className="text-lg font-semibold mb-3 text-center">{title}</h3>}
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="relative w-full aspect-[3/2] rounded-2xl border-2 bg-card hover:shadow-lg transition perspective-[1000px]"
        style={{ perspective: 1000 }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center text-2xl font-medium p-6 text-center transition-all duration-500"
          style={{
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
            backfaceVisibility: 'hidden',
          }}
        >
          {card.front}
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center text-base bg-primary/5 rounded-2xl p-6 text-center transition-all duration-500"
          style={{
            transform: flipped ? 'rotateY(0)' : 'rotateY(-180deg)',
            backfaceVisibility: 'hidden',
          }}
        >
          {card.back}
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button onClick={prev} className="text-muted-foreground hover:text-foreground">
          ← Précédent
        </button>
        <span className="font-medium tabular-nums">
          {idx + 1} / {items.length}
        </span>
        <button onClick={next} className="text-muted-foreground hover:text-foreground">
          Suivant →
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Cliquez sur la carte pour la retourner <RotateCw className="inline size-3 ml-1" />
      </p>
    </div>
  )
}

export function TtsButtonBlock({ text, label = 'Lire à voix haute', voice = 'fr-FR' }: TtsButtonProps) {
  const [speaking, setSpeaking] = React.useState(false)

  const speak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Synthèse vocale non disponible sur ce navigateur')
      return
    }
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const content =
      text ||
      document.querySelector('.page-content')?.textContent?.trim() ||
      'Aucun contenu à lire.'
    const utter = new SpeechSynthesisUtterance(content)
    utter.lang = voice
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utter)
    setSpeaking(true)
  }

  return (
    <button
      type="button"
      onClick={speak}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition my-1',
        speaking
          ? 'bg-primary text-primary-foreground border-primary'
          : 'hover:bg-muted'
      )}
    >
      <Volume2 className={cn('size-4', speaking && 'animate-pulse')} />
      {speaking ? 'Arrêter' : label}
    </button>
  )
}

export function A11yToolbarBlock({
  position = 'bottom-right',
  enableFontSizer = true,
  enableHighContrast = true,
  enableDyslexiaFont = true,
}: A11yToolbarProps) {
  const [open, setOpen] = React.useState(false)
  const [fontScale, setFontScale] = React.useState(1)
  const [contrast, setContrast] = React.useState(false)
  const [dyslexia, setDyslexia] = React.useState(false)

  React.useEffect(() => {
    document.documentElement.style.fontSize = `${16 * fontScale}px`
    document.documentElement.classList.toggle('high-contrast', contrast)
    document.documentElement.classList.toggle('dyslexia-font', dyslexia)
    return () => {
      document.documentElement.style.fontSize = ''
      document.documentElement.classList.remove('high-contrast')
      document.documentElement.classList.remove('dyslexia-font')
    }
  }, [fontScale, contrast, dyslexia])

  return (
    <>
      <div
        className={cn(
          'fixed z-50',
          position === 'top-right' ? 'top-4 right-4' : 'bottom-4 right-4'
        )}
      >
        {open ? (
          <div className="rounded-2xl border bg-card shadow-2xl p-4 w-64 animate-in fade-in-0 slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Accessibilité</h4>
              <button onClick={() => setOpen(false)} className="opacity-60 hover:opacity-100">
                <XIcon className="size-4" />
              </button>
            </div>
            {enableFontSizer && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground mb-1.5">Taille du texte</div>
                <div className="flex gap-1">
                  {[0.85, 1, 1.15, 1.3].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFontScale(s)}
                      className={cn(
                        'flex-1 rounded border py-1 text-xs',
                        fontScale === s ? 'border-primary bg-primary/10 text-primary' : ''
                      )}
                    >
                      {s === 1 ? 'A' : s < 1 ? 'A-' : s > 1.15 ? 'A++' : 'A+'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {enableHighContrast && (
              <button
                onClick={() => setContrast((c) => !c)}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-xs font-medium mb-2 flex items-center gap-2',
                  contrast && 'bg-primary/10 border-primary text-primary'
                )}
              >
                <Contrast className="size-4" />
                Contraste élevé
                {contrast && <Check className="size-3.5 ml-auto" />}
              </button>
            )}
            {enableDyslexiaFont && (
              <button
                onClick={() => setDyslexia((d) => !d)}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-xs font-medium flex items-center gap-2',
                  dyslexia && 'bg-primary/10 border-primary text-primary'
                )}
              >
                <TypeIcon className="size-4" />
                Police adaptée dyslexie
                {dyslexia && <Check className="size-3.5 ml-auto" />}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="size-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition flex items-center justify-center"
            title="Outils d'accessibilité"
          >
            <Eye className="size-5" />
          </button>
        )}
      </div>
    </>
  )
}
