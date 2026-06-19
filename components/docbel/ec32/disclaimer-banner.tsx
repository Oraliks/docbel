'use client'

// =====================================================================
//  eC3.2 — Bandeau « simulation pédagogique non officielle » (compact)
// ---------------------------------------------------------------------
//  Barre fine, rassurante : titre en pastille + points en ligne séparés
//  par des puces. Chaque point garde une icône (jamais l'information par
//  la seule couleur). Rien n'est envoyé à l'ONEM, données 100 % fictives.
// =====================================================================

import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Ec32Content } from '@/lib/ec32/schema'

export function Ec32DisclaimerBanner({ content }: { content: Ec32Content }) {
  const { disclaimer } = content
  const points = disclaimer.points.filter((p) => p.trim().length > 0)

  if (!disclaimer.title && points.length === 0) return null

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 rounded-2xl border border-primary/25 bg-primary/8 px-4 py-2.5',
        'text-sm dark:bg-primary/15',
      )}
      role="note"
    >
      {disclaimer.title && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
          <ShieldCheck className="size-3.5" aria-hidden />
          {disclaimer.title}
        </span>
      )}
      {points.map((point, index) => (
        <span key={index} className="inline-flex items-center gap-1.5 text-xs text-foreground/80">
          <span className="size-1 rounded-full bg-primary/50" aria-hidden />
          {point}
        </span>
      ))}
    </div>
  )
}
