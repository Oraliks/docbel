'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { X, Pipette } from 'lucide-react'

// ─────────────────────────── Section row helpers ───────────────────────────

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      )}
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

export function Group({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {title}
        <span className={cn('text-muted-foreground transition-transform', open ? 'rotate-180' : '')}>
          ▾
        </span>
      </button>
      {open && <div className="px-4 pb-4 space-y-3 animate-in fade-in-0 duration-150">{children}</div>}
    </div>
  )
}

// ─────────────────────────── Number with suffix ───────────────────────────

export function NumberControl({
  value,
  onChange,
  min = 0,
  max = 200,
  step = 1,
  suffix = 'px',
  placeholder,
  className,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        placeholder={placeholder ?? '–'}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') onChange(undefined)
          else onChange(Number(v))
        }}
        className="h-8 pr-8"
      />
      <span className="absolute right-2 text-[11px] text-muted-foreground pointer-events-none">
        {suffix}
      </span>
    </div>
  )
}

// ─────────────────────────── Color picker ───────────────────────────

const SWATCHES = [
  '#000000', '#1A1A24', '#374151', '#6B7280', '#9CA3AF', '#FFFFFF',
  '#7C3AED', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#F9F9F7', '#FEF3C7', '#DBEAFE', '#D1FAE5', '#FCE7F3',
]

// ─────────────────────────── WCAG contrast helpers ───────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').trim()
  let r: number, g: number, b: number
  if (m.length === 3) {
    r = parseInt(m[0] + m[0], 16)
    g = parseInt(m[1] + m[1], 16)
    b = parseInt(m[2] + m[2], 16)
  } else if (m.length === 6 || m.length === 8) {
    r = parseInt(m.slice(0, 2), 16)
    g = parseInt(m.slice(2, 4), 16)
    b = parseInt(m.slice(4, 6), 16)
  } else return null
  return [r, g, b]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number | null {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return null
  const la = relativeLuminance(ra)
  const lb = relativeLuminance(rb)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export function ColorControl({
  value,
  onChange,
  allowClear = true,
  contrastWith,
}: {
  value: string | undefined
  onChange: (v: string | undefined) => void
  allowClear?: boolean
  /** When set, computes WCAG contrast ratio against this color and shows a badge. */
  contrastWith?: string
}) {
  const supportsEyeDropper =
    typeof window !== 'undefined' && typeof (window as unknown as { EyeDropper?: unknown }).EyeDropper === 'function'

  const handleEyedropper = async () => {
    try {
      const W = window as unknown as {
        EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> }
      }
      const ed = new W.EyeDropper()
      const result = await ed.open()
      onChange(result.sRGBHex)
    } catch {
      // user cancelled
    }
  }

  const ratio = value && contrastWith ? contrastRatio(value, contrastWith) : null
  const aaPass = ratio !== null && ratio >= 4.5
  const aaaPass = ratio !== null && ratio >= 7

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 rounded-md border border-input bg-transparent px-2 text-sm transition-colors hover:bg-muted/50"
        >
          <span
            className={cn(
              'inline-block h-5 w-5 rounded border shadow-sm shrink-0',
              !value && 'bg-[conic-gradient(from_0deg,red,yellow,lime,cyan,blue,magenta,red)] opacity-30'
            )}
            style={value ? { backgroundColor: value } : undefined}
          />
          <span className="flex-1 text-left text-xs font-mono">{value ?? 'Aucune'}</span>
          {ratio !== null && (
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                aaaPass
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : aaPass
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-red-500/15 text-red-700 dark:text-red-300'
              )}
              title={`Ratio de contraste ${ratio.toFixed(2)}:1 — AA ≥ 4.5, AAA ≥ 7`}
            >
              {ratio.toFixed(1)}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="grid grid-cols-6 gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className={cn(
                  'h-7 w-7 rounded border shadow-sm transition-transform hover:scale-110',
                  value === c && 'ring-2 ring-primary ring-offset-1'
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value ?? '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-9 cursor-pointer rounded border bg-transparent"
            />
            <Input
              value={value ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange(v.startsWith('#') || v === '' ? (v || undefined) : `#${v}`)
              }}
              placeholder="#000000"
              className="h-8 flex-1 font-mono text-xs"
            />
            {supportsEyeDropper && (
              <Button
                size="icon-sm"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleEyedropper}
                title="Pipette · piquer une couleur"
              >
                <Pipette className="size-3.5" />
              </Button>
            )}
            {allowClear && value && (
              <Button
                size="icon-sm"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => onChange(undefined)}
                title="Effacer"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
          {ratio !== null && (
            <div className="rounded-md bg-muted/50 p-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contraste WCAG</span>
                <span className="font-mono font-semibold">{ratio.toFixed(2)}:1</span>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-medium',
                    aaPass
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-500/15 text-red-700 dark:text-red-300'
                  )}
                >
                  AA {aaPass ? '✓' : '✗'}
                </span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-medium',
                    aaaPass
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  AAA {aaaPass ? '✓' : '✗'}
                </span>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────── Pill segmented control ───────────────────────────

export function Pills<T extends string | number>({
  value,
  onChange,
  options,
  className,
}: {
  value: T | undefined
  onChange: (v: T) => void
  options: Array<{ value: T; label: React.ReactNode; title?: string }>
  className?: string
}) {
  return (
    <div className={cn('inline-flex w-full rounded-md border bg-muted/50 p-0.5', className)}>
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.title}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-all',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────── Slider with number ───────────────────────────

export function SliderControl({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = '',
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Slider value={value} onChange={onChange} min={min} max={max} step={step} className="flex-1" />
      <div className="relative w-16">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 pr-7 text-xs"
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── Spacing 4-side input ───────────────────────────

export function SpacingControl({
  values,
  onChange,
}: {
  values: { top?: number; right?: number; bottom?: number; left?: number }
  onChange: (next: { top?: number; right?: number; bottom?: number; left?: number }) => void
}) {
  const [linked, setLinked] = React.useState(
    values.top !== undefined &&
      values.top === values.right &&
      values.top === values.bottom &&
      values.top === values.left
  )

  const update = (side: 'top' | 'right' | 'bottom' | 'left', v: number | undefined) => {
    if (linked) {
      onChange({ top: v, right: v, bottom: v, left: v })
    } else {
      onChange({ ...values, [side]: v })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-1.5">
        <button
          type="button"
          onClick={() => setLinked((l) => !l)}
          className={cn(
            'text-[10px] font-medium uppercase tracking-wider transition-colors',
            linked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {linked ? '🔗 Liés' : '⛓️‍💥 Indépendants'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberControl
          value={values.top}
          onChange={(v) => update('top', v)}
          placeholder="T"
          suffix="↑"
        />
        <NumberControl
          value={values.right}
          onChange={(v) => update('right', v)}
          placeholder="R"
          suffix="→"
        />
        <NumberControl
          value={values.bottom}
          onChange={(v) => update('bottom', v)}
          placeholder="B"
          suffix="↓"
        />
        <NumberControl
          value={values.left}
          onChange={(v) => update('left', v)}
          placeholder="L"
          suffix="←"
        />
      </div>
    </div>
  )
}
