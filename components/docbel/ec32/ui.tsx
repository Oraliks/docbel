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
  Flag,
  Hourglass,
  Info,
  Palmtree,
  ShieldAlert,
  Sparkles,
  Square,
  Stethoscope,
  Tag,
  Triangle,
  TriangleAlert,
  UserPlus,
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
  headerAside,
  children,
  className,
}: {
  id?: string
  eyebrow?: string
  title?: string
  subtitle?: string
  icon?: ComponentType<{ className?: string }>
  /** Élément décoratif/complémentaire affiché à droite de l'en-tête (≥ lg). */
  headerAside?: ReactNode
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
        <header
          className={cn(
            'mb-6',
            headerAside
              ? 'flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between'
              : 'max-w-3xl',
          )}
        >
          <div className={cn(headerAside && 'min-w-0 max-w-3xl flex-1')}>
            {eyebrow && (
              <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--glass-accent-deep)]">
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
          </div>
          {headerAside && (
            <div className="hidden shrink-0 lg:block">{headerAside}</div>
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
    wrap: 'border-[color:var(--glass-info-border)] bg-[color:var(--glass-info-surface)] text-[color:var(--glass-info-ink)]',
    icon: Info,
    iconCls: 'text-[color:var(--glass-info)]',
  },
  warning: {
    wrap: 'border-[color:var(--glass-warning-border)] bg-[color:var(--glass-warning-surface)] text-[color:var(--glass-warning-ink)]',
    icon: TriangleAlert,
    iconCls: 'text-[color:var(--glass-warning)]',
  },
  success: {
    wrap: 'border-[color:var(--glass-success-border)] bg-[color:var(--glass-success-surface)] text-[color:var(--glass-success-ink)]',
    icon: Sparkles,
    iconCls: 'text-[color:var(--glass-success)]',
  },
  neutral: {
    wrap: 'border-border bg-muted/50 text-foreground',
    icon: Info,
    iconCls: 'text-muted-foreground',
  },
  legal: {
    wrap: 'border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]',
    icon: ShieldAlert,
    iconCls: 'text-[color:var(--destructive)]',
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
    chip: 'border-[color:var(--chart-4)]/40 bg-[color:var(--chart-4)]/15 text-[color:var(--chart-4)]',
    cell: 'bg-[color:var(--chart-4)]/12',
    dot: 'bg-[color:var(--glass-surface-strong)] ring-1 ring-[color:var(--chart-4)]',
    accent: 'text-[color:var(--chart-4)]',
  },
  work_own_employer: {
    icon: Briefcase,
    chip: 'border-[color:var(--primary)]/40 bg-[color:var(--primary)]/15 text-[color:var(--primary)]',
    cell: 'bg-[color:var(--primary)]/20',
    dot: 'bg-[color:var(--primary)]',
    accent: 'text-[color:var(--primary)]',
  },
  // Axe secondaire « travail ailleurs » — icônes glyphes (■ carré plein).
  work_elsewhere_usual_day: {
    icon: Square,
    chip: 'border-[color:var(--chart-2)]/40 bg-[color:var(--chart-2)]/15 text-[color:var(--chart-2)]',
    cell: 'bg-[color:var(--chart-2)]/20',
    dot: 'bg-[color:var(--chart-2)]',
    accent: 'text-[color:var(--chart-2)]',
  },
  // ▲ triangle plein.
  work_elsewhere_non_usual_day: {
    icon: Triangle,
    chip: 'border-[color:var(--chart-3)]/40 bg-[color:var(--chart-3)]/15 text-[color:var(--chart-3)]',
    cell: 'bg-[color:var(--chart-3)]/20',
    dot: 'bg-[color:var(--chart-3)]',
    accent: 'text-[color:var(--chart-3)]',
  },
  // 👥 autre employeur fixe.
  work_other_regular_employer: {
    icon: UserPlus,
    chip: 'border-[color:var(--glass-accent-b)]/40 bg-[color:var(--glass-accent-b)]/15 text-[color:var(--glass-accent-b)]',
    cell: 'bg-[color:var(--glass-accent-b)]/20',
    dot: 'bg-[color:var(--glass-accent-b)]',
    accent: 'text-[color:var(--glass-accent-b)]',
  },
  incapacity: {
    icon: Stethoscope,
    chip: 'border-[color:var(--chart-5)]/40 bg-[color:var(--chart-5)]/15 text-[color:var(--chart-5)]',
    cell: 'bg-[color:var(--chart-5)]/20',
    dot: 'bg-[color:var(--chart-5)]',
    accent: 'text-[color:var(--chart-5)]',
  },
  vacation: {
    icon: Palmtree,
    chip: 'border-primary/40 bg-primary/15 text-primary',
    cell: 'bg-[color:var(--primary)]/12',
    dot: 'bg-primary',
    accent: 'text-primary',
  },
  other: {
    icon: Tag,
    chip: 'border-[color:var(--chart-1)]/40 bg-[color:var(--chart-1)]/15 text-[color:var(--chart-1)]',
    cell: 'bg-[color:var(--chart-1)]/20',
    dot: 'bg-[color:var(--chart-1)]',
    accent: 'text-[color:var(--chart-1)]',
  },
  not_applicable: {
    icon: Ban,
    chip: 'border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-faint)]',
    cell: 'bg-[color:var(--glass-surface)]',
    dot: 'bg-[color:var(--glass-ink-faint)]',
    accent: 'text-[color:var(--glass-ink-faint)]',
  },
  first_effective_unemployment_day: {
    icon: Flag,
    chip: 'border-[color:var(--glass-success-border)] bg-[color:var(--glass-success-surface)] text-[color:var(--glass-success-ink)]',
    cell: 'bg-[color:var(--glass-success-surface)]',
    dot: 'bg-[color:var(--glass-success)]',
    accent: 'text-[color:var(--glass-success)]',
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
