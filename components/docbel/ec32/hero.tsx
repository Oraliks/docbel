'use client'

// =====================================================================
//  eC3.2 — Section d'accroche (hero)
// ---------------------------------------------------------------------
//  Présente la page pédagogique en deux colonnes : à gauche le badge,
//  le titre, le sous-titre, deux appels à l'action (ancres vers le
//  simulateur et les cas pratiques) et la mention « simulation non
//  officielle » en petit ; à droite l'illustration. Le hero repose
//  directement sur le fond de page (plus léger, plus ouvert), avec des
//  halos en dégradé purement décoratifs en arrière-plan.
// =====================================================================

import { ArrowRight, BookOpenCheck, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Ec32Eyebrow, Ec32InfoBox } from '@/components/docbel/ec32/ui'
import { Ec32HeroIllustration } from '@/components/docbel/ec32/ec32-hero-illustration'
import type { Ec32Content } from '@/lib/ec32/schema'

export function Ec32Hero({
  content,
  onSecondary,
}: {
  content: Ec32Content
  /** Action du CTA secondaire (ex. ouvrir l'onglet « Cas pratiques »). */
  onSecondary?: () => void
}) {
  const { hero } = content

  return (
    <section id="haut" className="relative w-full overflow-hidden scroll-mt-28">
      {/* Décor : halos en dégradé, purement décoratif, derrière les deux colonnes */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 size-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-16 top-12 size-[24rem] rounded-full bg-violet-400/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-[20rem] rounded-full bg-sky-300/10 blur-3xl" />
      </div>

      <div className="relative grid items-center gap-8 pb-8 md:gap-12 md:pb-12 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Colonne gauche : accroche + CTA */}
        <div className="flex flex-col items-start gap-6">
          {hero.badge && (
            <Ec32Eyebrow>
              <ShieldCheck className="size-3.5" aria-hidden />
              {hero.badge}
            </Ec32Eyebrow>
          )}

          {hero.title && (
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
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
            {hero.secondaryCta &&
              (onSecondary ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={onSecondary}
                >
                  <BookOpenCheck className="size-4" aria-hidden />
                  {hero.secondaryCta}
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                  render={<a href="#cas-pratiques" />}
                >
                  <BookOpenCheck className="size-4" aria-hidden />
                  {hero.secondaryCta}
                </Button>
              ))}
          </div>

          {hero.disclaimer && (
            <Ec32InfoBox tone="warning" className="max-w-2xl">
              {hero.disclaimer}
            </Ec32InfoBox>
          )}
        </div>

        {/* Colonne droite : illustration (sous le texte en mobile, à côté dès lg) */}
        <div className="w-full">
          <Ec32HeroIllustration />
        </div>
      </div>
    </section>
  )
}
