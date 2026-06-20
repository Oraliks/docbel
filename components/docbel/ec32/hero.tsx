'use client'

// =====================================================================
//  eC3.2 — Section d'accroche (hero)
// ---------------------------------------------------------------------
//  Deux colonnes : à gauche le grand titre, le sous-titre, deux appels à
//  l'action (Lancer la simulation / Voir les cas pratiques) et une rangée
//  de 3 garanties (sécurisé / aucune donnée réelle / basé sur l'ONEM) ;
//  à droite l'illustration « cartes connectées + simulateur ». Halos en
//  dégradé décoratifs en arrière-plan. Palette Docbel (jamais l'orange ONEM).
// =====================================================================

import { BookOpenCheck, CheckCircle2, Lock, Play, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Ec32HeroIllustration } from '@/components/docbel/ec32/ec32-hero-illustration'
import type { Ec32Content } from '@/lib/ec32/schema'

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: 'Environnement sécurisé' },
  { icon: Lock, label: 'Aucune donnée réelle' },
  { icon: CheckCircle2, label: 'Basé sur les démarches ONEM' },
] as const

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
        <div className="absolute -left-24 -top-24 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-16 top-12 size-[26rem] rounded-full bg-violet-400/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-[20rem] rounded-full bg-sky-300/10 blur-3xl" />
      </div>

      <div className="relative grid items-center gap-10 pb-8 md:gap-12 md:pb-12 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Colonne gauche : accroche + CTA */}
        <div className="flex flex-col items-start gap-7">
          {hero.title && (
            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground md:text-6xl">
              {hero.title}
            </h1>
          )}

          {hero.subtitle && (
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
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
                <Play className="size-4 fill-current" aria-hidden />
                {hero.primaryCta}
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

          {/* Garanties : 3 points avec icône. */}
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"
              >
                <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Colonne droite : illustration (masquée sur très petits écrans où la
            composition flottante se chevauche ; visible dès sm). */}
        <div className="hidden w-full sm:block">
          <Ec32HeroIllustration />
        </div>
      </div>
    </section>
  )
}
