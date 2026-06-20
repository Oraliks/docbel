'use client'

// =====================================================================
//  eC3.2 — Illustration d'accroche (décorative)
// ---------------------------------------------------------------------
//  Composition « cartes flottantes connectées » : trois cartes-atouts
//  (Sans risque / Aucune donnée réelle / Cas guidés) reliées par des
//  traits pointillés à un mock de fenêtre « Simulateur eC3.2 ».
//  100 % décoratif (aria-hidden), aucun logo officiel — palette Docbel.
// =====================================================================

import type { ComponentType } from 'react'
import { ArrowRight, BookOpen, Lock, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

type Accent = 'violet' | 'orange' | 'emerald'

const ACCENT: Record<Accent, { bg: string; text: string }> = {
  violet: { bg: 'bg-primary/10', text: 'text-primary' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-500' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
}

function FeatureCard({
  icon: Icon,
  accent,
  title,
  description,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  accent: Accent
  title: string
  description: string
  className?: string
}) {
  const a = ACCENT[accent]
  return (
    <div
      className={cn(
        'absolute flex items-start gap-3 rounded-2xl border border-primary/10 bg-card/95 p-3.5 shadow-[0_8px_24px_-14px_rgba(26,26,36,0.18),0_30px_60px_-40px_rgba(91,70,229,0.4)] backdrop-blur-sm',
        className,
      )}
    >
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', a.bg)}>
        <Icon className={cn('size-[1.15rem]', a.text)} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.8rem] font-bold leading-tight text-foreground">{title}</span>
        <span className="mt-1 block text-[0.7rem] leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </div>
  )
}

/** Mock de fenêtre « Simulateur eC3.2 » (squelette stylisé). */
function BrowserMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'absolute rounded-2xl border border-primary/10 bg-card/95 p-3.5 shadow-[0_10px_30px_-14px_rgba(26,26,36,0.2),0_44px_80px_-44px_rgba(91,70,229,0.5)] backdrop-blur-sm',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[0.7rem] font-bold text-foreground">Simulateur eC3.2</span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-rose-400" />
          <span className="size-1.5 rounded-full bg-amber-400" />
          <span className="size-1.5 rounded-full bg-emerald-400" />
        </span>
      </div>
      <div className="space-y-2">
        <span className="block h-2 w-3/5 rounded-full bg-primary/40" />
        <span className="block h-2 w-full rounded-full bg-muted" />
        <span className="block h-2 w-11/12 rounded-full bg-muted" />
        <span className="block h-2 w-4/5 rounded-full bg-muted" />
        <span className="mt-1 block h-2 w-2/3 rounded-full bg-muted" />
      </div>
      <div className="mt-3 flex justify-start">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-lg bg-primary px-3">
          <span className="h-1.5 w-8 rounded-full bg-primary-foreground/60" />
          <ArrowRight className="size-3 text-primary-foreground" />
        </span>
      </div>
    </div>
  )
}

export function Ec32HeroIllustration({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('relative mx-auto w-full max-w-[36rem] select-none', className)}
    >
      {/* Halo doux derrière la composition */}
      <div className="pointer-events-none absolute inset-0 -z-10 scale-110 rounded-[3rem] bg-gradient-to-br from-primary/12 via-violet-300/10 to-transparent blur-2xl" />

      <div className="relative aspect-[7/6] w-full">
        {/* Traits pointillés connecteurs + points colorés. */}
        <svg
          viewBox="0 0 560 480"
          fill="none"
          className="absolute inset-0 size-full"
          preserveAspectRatio="none"
        >
          <path
            d="M300 110 C 380 130, 420 170, 452 210"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="2 8"
            strokeLinecap="round"
            className="text-primary/30"
          />
          <path
            d="M300 235 C 360 235, 400 235, 446 240"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="2 8"
            strokeLinecap="round"
            className="text-orange-400/40"
          />
          <path
            d="M300 365 C 380 350, 420 310, 452 268"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="2 8"
            strokeLinecap="round"
            className="text-emerald-400/40"
          />
          <circle cx="356" cy="138" r="4" className="fill-primary/60" />
          <circle cx="372" cy="237" r="4" className="fill-orange-400/70" />
          <circle cx="360" cy="342" r="4" className="fill-emerald-400/70" />
        </svg>

        {/* Cartes-atouts (gauche, étagées). */}
        <FeatureCard
          className="left-[6%] top-[2%] w-[56%]"
          icon={ShieldCheck}
          accent="violet"
          title="Sans risque"
          description="Un environnement de test fidèle à la réalité."
        />
        <FeatureCard
          className="left-0 top-[42%] w-[53%]"
          icon={Lock}
          accent="orange"
          title="Aucune donnée réelle"
          description="Aucune donnée n’est demandée ni transmise à l’ONEM."
        />
        <FeatureCard
          className="bottom-[3%] left-[5%] w-[56%]"
          icon={BookOpen}
          accent="emerald"
          title="Cas guidés"
          description="Des scénarios concrets pour comprendre chaque étape."
        />

        {/* Mock fenêtre simulateur (droite, centrée). */}
        <BrowserMock className="right-0 top-1/2 w-[44%] -translate-y-1/2" />
      </div>
    </div>
  )
}
