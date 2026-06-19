'use client'

// =====================================================================
//  eC3.2 — Section d'accroche (hero)
// ---------------------------------------------------------------------
//  Présente la page pédagogique : badge, titre, sous-titre, deux appels
//  à l'action (ancres vers le simulateur et les cas pratiques) et la
//  mention « simulation non officielle » en petit. Décor glass discret
//  (halos en dégradé) sans dépendance lourde.
// =====================================================================

import { ArrowRight, BookOpenCheck, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Ec32Eyebrow } from '@/components/docbel/ec32/ui'
import type { Ec32Content } from '@/lib/ec32/schema'

export function Ec32Hero({ content }: { content: Ec32Content }) {
  const { hero } = content

  return (
    <section id="haut" className="relative w-full overflow-hidden scroll-mt-28">
      {/* Décor glass : halos en dégradé, purement décoratif */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 size-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-16 top-12 size-[24rem] rounded-full bg-violet-400/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-[20rem] rounded-full bg-sky-300/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col items-start gap-6 rounded-[2rem] border border-white/60 bg-card/60 px-6 py-12 shadow-sm backdrop-blur-sm md:px-12 md:py-16">
        {hero.badge && (
          <Ec32Eyebrow>
            <ShieldCheck className="size-3.5" aria-hidden />
            {hero.badge}
          </Ec32Eyebrow>
        )}

        {hero.title && (
          <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
            {hero.title}
          </h1>
        )}

        {hero.subtitle && (
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {hero.subtitle}
          </p>
        )}

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          {hero.primaryCta && (
            <Button
              size="lg"
              className="w-full sm:w-auto"
              render={<a href="#simulateur" />}
            >
              {hero.primaryCta}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
          {hero.secondaryCta && (
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              render={<a href="#cas-pratiques" />}
            >
              <BookOpenCheck className="size-4" aria-hidden />
              {hero.secondaryCta}
            </Button>
          )}
        </div>

        {hero.disclaimer && (
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground/80">
            {hero.disclaimer}
          </p>
        )}
      </div>
    </section>
  )
}
