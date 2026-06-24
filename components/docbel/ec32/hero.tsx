'use client'

import { BookOpenCheck, CheckCircle2, Lock, Play, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Ec32HeroIllustration } from '@/components/docbel/ec32/ec32-hero-illustration'
import type { Ec32Content } from '@/lib/ec32/schema'

const TRUST_ITEMS = [
  { icon: ShieldCheck, labelKey: 'hero.trust.secureEnv' },
  { icon: Lock, labelKey: 'hero.trust.noRealData' },
  { icon: CheckCircle2, labelKey: 'hero.trust.basedOnOnem' },
] as const

export function Ec32Hero({
  content,
  onSecondary,
}: {
  content: Ec32Content
  onSecondary?: () => void
}) {
  const t = useTranslations('public.ec32')
  const { hero } = content

  return (
    <section id="haut" className="relative w-full overflow-hidden scroll-mt-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 size-[22rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-16 top-8 size-[20rem] rounded-full bg-violet-400/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-[16rem] rounded-full bg-sky-300/10 blur-3xl" />
      </div>

      <div className="relative grid items-center gap-6 pb-4 md:gap-8 md:pb-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Colonne gauche */}
        <div className="flex flex-col items-start gap-5">
          {hero.title && (
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground md:text-[2.75rem]">
              {hero.title}
            </h1>
          )}

          {hero.subtitle && (
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
              {hero.subtitle}
            </p>
          )}

          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
            {hero.primaryCta && (
              <Button size="default" className="w-full sm:w-auto" render={<a href="#simulateur" />}>
                <Play className="size-3.5 fill-current" aria-hidden />
                {hero.primaryCta}
              </Button>
            )}
            {hero.secondaryCta &&
              (onSecondary ? (
                <Button size="default" variant="outline" className="w-full sm:w-auto" onClick={onSecondary}>
                  <BookOpenCheck className="size-3.5" aria-hidden />
                  {hero.secondaryCta}
                </Button>
              ) : (
                <Button size="default" variant="outline" className="w-full sm:w-auto" render={<a href="#cas-pratiques" />}>
                  <BookOpenCheck className="size-3.5" aria-hidden />
                  {hero.secondaryCta}
                </Button>
              ))}
          </div>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            {TRUST_ITEMS.map(({ icon: Icon, labelKey }) => (
              <li key={labelKey} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
                {t(labelKey as Parameters<typeof t>[0])}
              </li>
            ))}
          </ul>
        </div>

        {/* Colonne droite : illustration (masquée sur très petits écrans). */}
        <div className="hidden w-full sm:block">
          <Ec32HeroIllustration />
        </div>
      </div>
    </section>
  )
}
