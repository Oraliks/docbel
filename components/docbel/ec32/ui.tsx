'use client'

// =====================================================================
//  eC3.2 — Kit UI partagé (glass Docbel)
// ---------------------------------------------------------------------
//  Primitives visuelles réutilisées par toutes les sections et par le
//  simulateur, pour une cohérence stricte (sections, cartes, encadrés,
//  badges) + la table des correspondances "situation → icône/couleur".
//  Palette Docbel (violet/bleu doux) — JAMAIS l'orange officiel ONEM.
// =====================================================================

import type { ComponentType, ReactNode } from 'react'
import {
  Ban,
  Briefcase,
  Building,
  Building2,
  Flag,
  Hourglass,
  Info,
  Layers,
  Palmtree,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Tag,
  TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Ec32SituationType } from '@/lib/ec32/types'

// ─────────────────────────── Section & cartes ───────────────────────────

export function Ec32Section({
  id,
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: {
  id?: string
  eyebrow?: string
  title?: string
  subtitle?: string
  icon?: ComponentType<{ className?: string }>
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn('w-full scroll-mt-28', className)}
      aria-labelledby={id && title ? `${id}-title` : undefined}
    >
      {(eyebrow || title || subtitle) && (
        <header className="mb-6 max-w-3xl">
          {eyebrow && (
            <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--glass-accent-deep,#5B46E5)]">
              {Icon && <Icon className="size-3.5" />}
              {eyebrow}
            </div>
          )}
          {title && (
            <h2
              id={id ? `${id}-title` : undefined}
              className="text-2xl font-bold leading-tight tracking-tight text-foreground md:text-3xl"
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">{subtitle}</p>
          )}
        </header>
      )}
      {children}
    </section>
  )
}

export function Ec32Card({
  children,
  className,
  interactive = false,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  interactive?: boolean
  as?: 'div' | 'article' | 'li'
}) {
  return (
    <Tag
      className={cn(
        // Carte premium « blanche » : surface opaque (≈ #FAF7FF), hairline violet
        // discret et ombre douce élevée. Plus de glass translucide lourd.
        'rounded-3xl border border-primary/10 bg-card p-5',
        'shadow-[0_1px_3px_rgba(26,26,36,0.05),0_16px_38px_-22px_rgba(91,70,229,0.24)]',
        interactive &&
          'transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_2px_8px_rgba(26,26,36,0.07),0_26px_52px_-26px_rgba(91,70,229,0.34)] focus-within:-translate-y-0.5',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function Ec32Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary',
        className,
      )}
    >
      {children}
    </span>
  )
}

// ─────────────────────────── Encadré pédagogique ───────────────────────────

type InfoTone = 'info' | 'warning' | 'success' | 'neutral' | 'legal'

const INFO_TONES: Record<
  InfoTone,
  { wrap: string; icon: ComponentType<{ className?: string }>; iconCls: string }
> = {
  info: {
    wrap: 'border-sky-300/50 bg-sky-50/70 text-sky-900 dark:border-sky-400/30 dark:bg-sky-950/40 dark:text-sky-100',
    icon: Info,
    iconCls: 'text-sky-600 dark:text-sky-300',
  },
  warning: {
    wrap: 'border-orange-400/70 bg-orange-100/80 text-orange-950 dark:border-orange-500/40 dark:bg-orange-950/50 dark:text-orange-100',
    icon: TriangleAlert,
    iconCls: 'text-orange-600 dark:text-orange-300',
  },
  success: {
    wrap: 'border-emerald-300/50 bg-emerald-50/70 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100',
    icon: Sparkles,
    iconCls: 'text-emerald-600 dark:text-emerald-300',
  },
  neutral: {
    wrap: 'border-border bg-muted/50 text-foreground',
    icon: Info,
    iconCls: 'text-muted-foreground',
  },
  legal: {
    wrap: 'border-red-400/70 bg-red-100/80 text-red-950 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-100',
    icon: ShieldAlert,
    iconCls: 'text-red-600 dark:text-red-300',
  },
}

export function Ec32InfoBox({
  tone = 'info',
  title,
  children,
  className,
  icon: IconOverride,
}: {
  tone?: InfoTone
  title?: ReactNode
  children?: ReactNode
  className?: string
  icon?: ComponentType<{ className?: string }>
}) {
  const t = INFO_TONES[tone]
  const Icon = IconOverride ?? t.icon
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed', t.wrap, className)}>
      <Icon className={cn('mt-0.5 size-5 shrink-0', t.iconCls)} aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-[0.92rem] opacity-90">{children}</div>}
      </div>
    </div>
  )
}

// ─────────────────────────── Situations : icônes & couleurs ───────────────────────────

export interface SituationVisual {
  icon: ComponentType<{ className?: string }>
  /** Pastille (légende, badge). */
  chip: string
  /** Fond de case du calendrier quand le jour porte cette situation. */
  cell: string
  /** Point coloré compact. */
  dot: string
  /** Couleur d'accent (texte/icône). */
  accent: string
}

/**
 * Correspondance situation → visuel. Palette Docbel violet/bleu doux,
 * chaque situation a une teinte distincte (jamais l'orange officiel ONEM).
 * Utilisée par le calendrier, le sélecteur, la légende et la vue liste.
 */
export const SITUATION_VISUALS: Record<Ec32SituationType, SituationVisual> = {
  temporary_unemployment: {
    icon: Hourglass,
    chip: 'border-violet-300/60 bg-violet-100/70 text-violet-800 dark:border-violet-400/30 dark:bg-violet-950/50 dark:text-violet-200',
    cell: 'bg-violet-100/60 dark:bg-violet-900/30',
    dot: 'bg-white ring-1 ring-violet-400 dark:ring-violet-300',
    accent: 'text-violet-600 dark:text-violet-300',
  },
  work_own_employer: {
    icon: Briefcase,
    chip: 'border-indigo-300/60 bg-indigo-100/70 text-indigo-800 dark:border-indigo-400/30 dark:bg-indigo-950/50 dark:text-indigo-200',
    cell: 'bg-indigo-200/70 dark:bg-indigo-800/40',
    dot: 'bg-indigo-500',
    accent: 'text-indigo-600 dark:text-indigo-300',
  },
  work_elsewhere_usual_day: {
    icon: Building2,
    chip: 'border-sky-300/60 bg-sky-100/70 text-sky-800 dark:border-sky-400/30 dark:bg-sky-950/50 dark:text-sky-200',
    cell: 'bg-sky-200/70 dark:bg-sky-800/40',
    dot: 'bg-sky-500',
    accent: 'text-sky-600 dark:text-sky-300',
  },
  work_elsewhere_non_usual_day: {
    icon: Building,
    chip: 'border-cyan-300/60 bg-cyan-100/70 text-cyan-800 dark:border-cyan-400/30 dark:bg-cyan-950/50 dark:text-cyan-200',
    cell: 'bg-cyan-200/70 dark:bg-cyan-800/40',
    dot: 'bg-cyan-500',
    accent: 'text-cyan-600 dark:text-cyan-300',
  },
  work_other_regular_employer: {
    icon: Layers,
    chip: 'border-fuchsia-300/60 bg-fuchsia-100/70 text-fuchsia-800 dark:border-fuchsia-400/30 dark:bg-fuchsia-950/50 dark:text-fuchsia-200',
    cell: 'bg-fuchsia-200/70 dark:bg-fuchsia-800/40',
    dot: 'bg-fuchsia-500',
    accent: 'text-fuchsia-600 dark:text-fuchsia-300',
  },
  incapacity: {
    icon: Stethoscope,
    chip: 'border-rose-300/60 bg-rose-100/70 text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/50 dark:text-rose-200',
    cell: 'bg-rose-200/70 dark:bg-rose-800/40',
    dot: 'bg-rose-500',
    accent: 'text-rose-600 dark:text-rose-300',
  },
  vacation: {
    icon: Palmtree,
    chip: 'border-primary/40 bg-primary/15 text-primary',
    cell: 'bg-violet-100/60 dark:bg-violet-900/30',
    dot: 'bg-primary',
    accent: 'text-primary',
  },
  other: {
    icon: Tag,
    chip: 'border-amber-300/60 bg-amber-100/70 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/50 dark:text-amber-200',
    cell: 'bg-amber-200/70 dark:bg-amber-800/40',
    dot: 'bg-amber-500',
    accent: 'text-amber-600 dark:text-amber-300',
  },
  not_applicable: {
    icon: Ban,
    chip: 'border-slate-300/60 bg-slate-100/70 text-slate-600 dark:border-slate-500/30 dark:bg-slate-800/50 dark:text-slate-300',
    cell: 'bg-slate-200/50 dark:bg-slate-800/40',
    dot: 'bg-slate-400',
    accent: 'text-slate-500 dark:text-slate-400',
  },
  first_effective_unemployment_day: {
    icon: Flag,
    chip: 'border-emerald-300/60 bg-emerald-100/70 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-200',
    cell: 'bg-emerald-200/70 dark:bg-emerald-800/40',
    dot: 'bg-emerald-500',
    accent: 'text-emerald-600 dark:text-emerald-300',
  },
}

/** Pastille de légende/badge pour une situation. */
export function Ec32SituationChip({
  situation,
  label,
  className,
}: {
  situation: Ec32SituationType
  label: string
  className?: string
}) {
  const v = SITUATION_VISUALS[situation]
  const Icon = v.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        v.chip,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}
