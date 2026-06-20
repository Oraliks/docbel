'use client'

// =====================================================================
//  eC3.2 — Illustration d'accroche (décorative)
// ---------------------------------------------------------------------
//  Aperçu stylisé et NON officiel d'une « app » de carte de contrôle :
//  fenêtre flottante avec mini-calendrier, pastille « eC3.2 » et coche
//  violette. 100 % décoratif (aria-hidden), aucune donnée, aucun logo
//  officiel — palette Docbel (violet/bleu doux), jamais l'orange ONEM.
// =====================================================================

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Teintes douces des cases (echo de la palette des situations). */
const CELL_TONES = [
  'bg-violet-200/70',
  'bg-card',
  'bg-sky-200/70',
  'bg-card',
  'bg-card',
  'bg-rose-200/70',
  'bg-card',
  'bg-emerald-200/70',
  'bg-card',
  'bg-violet-200/70',
  'bg-card',
  'bg-card',
  'bg-card',
  'bg-amber-200/70',
  'bg-card',
] as const

export function Ec32HeroIllustration({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('relative mx-auto w-full max-w-md select-none', className)}
    >
      {/* Halo doux derrière la fenêtre */}
      <div className="pointer-events-none absolute inset-0 -z-10 scale-110 rounded-[2.5rem] bg-gradient-to-br from-primary/15 via-violet-300/10 to-sky-300/10 blur-2xl" />

      {/* Fenêtre flottante */}
      <div className="relative rounded-[1.75rem] border border-primary/10 bg-card/95 p-5 shadow-[0_8px_24px_-12px_rgba(26,26,36,0.18),0_40px_80px_-40px_rgba(91,70,229,0.45)] backdrop-blur-sm">
        {/* Barre de fenêtre (3 points) */}
        <div className="mb-4 flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-300/80" />
          <span className="size-2.5 rounded-full bg-amber-300/80" />
          <span className="size-2.5 rounded-full bg-emerald-300/80" />
          <span className="ml-2 h-2 w-20 rounded-full bg-muted" />
        </div>

        <div className="flex gap-4">
          {/* Colonne latérale stylisée */}
          <div className="hidden w-16 shrink-0 flex-col gap-2 sm:flex">
            <span className="h-2.5 w-full rounded-full bg-primary/25" />
            <span className="h-2 w-10 rounded-full bg-muted" />
            <span className="h-2 w-12 rounded-full bg-muted" />
            <span className="h-2 w-9 rounded-full bg-muted" />
            <span className="mt-2 h-8 w-full rounded-xl bg-primary/10" />
          </div>

          {/* Mini-calendrier */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="h-2.5 w-24 rounded-full bg-foreground/15" />
              <span className="h-5 w-14 rounded-full bg-primary/12" />
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {CELL_TONES.map((tone, i) => (
                <span
                  key={i}
                  className={cn(
                    'aspect-square rounded-lg border border-primary/10',
                    tone,
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pastille « eC3.2 » flottante */}
      <div className="absolute -right-3 -top-3 rotate-3 rounded-2xl bg-primary px-3.5 py-1.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30">
        eC3.2
      </div>

      {/* Coche de validation flottante */}
      <div className="absolute -bottom-4 -right-2 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/40 ring-4 ring-card">
        <Check className="size-7" strokeWidth={3} />
      </div>

      {/* Petits points décoratifs */}
      <span className="absolute -left-4 top-1/3 size-2 rounded-full bg-primary/40" />
      <span className="absolute -left-1 bottom-8 size-1.5 rounded-full bg-sky-400/50" />
      <span className="absolute right-10 -bottom-6 size-1.5 rounded-full bg-violet-400/50" />
    </div>
  )
}
