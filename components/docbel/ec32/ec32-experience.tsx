'use client'

// =====================================================================
//  eC3.2 — Composition de la page interactive (racine CLIENT)
// ---------------------------------------------------------------------
//  Page COMPACTE et centrée sur le simulateur :
//    1. bandeau disclaimer fin
//    2. hero court
//    3. SIMULATEUR (élément principal, toujours visible)
//    4. explorateur à ONGLETS — un seul contenu affiché à la fois :
//       Démo · Cas pratiques · Erreurs · Règles · FAQ · Ressources
//    5. bande légale
//  Les contenus longs vivent dans des accordéons (onglet « Règles »),
//  en COMPLÉMENT du simulateur (pas de doublon intégral).
//
//  État partagé : la clé du cas pratique chargé dans le simulateur, et
//  l'onglet actif (pour les boutons « voir tout »).
// =====================================================================

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, ShieldCheck, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Ec32Content } from '@/lib/ec32/schema'
import { Ec32LearningModes } from '@/components/docbel/ec32/learning-modes'
import { Ec32InteractiveSimulator } from '@/components/docbel/ec32/ec32-interactive-simulator'
import { Ec32ScenarioCards } from '@/components/docbel/ec32/scenario-cards'
import { Ec32MistakesSection } from '@/components/docbel/ec32/mistakes-section'
import { Ec32RulesSection } from '@/components/docbel/ec32/ec32-rules-section'
import { Ec32FaqSection } from '@/components/docbel/ec32/faq-section'
import { Ec32ResourcesSection } from '@/components/docbel/ec32/resources-section'
import { Ec32HelpBlock } from '@/components/docbel/ec32/ec32-help-block'

/** Les 6 erreurs les plus importantes (mises en avant dans l'onglet Erreurs). */
const KEY_MISTAKES = [
  'oublier-indiquer-travail-avant',
  'choisir-mauvais-employeur',
  'oublier-de-sauvegarder',
  'corriger-sans-explication',
  'pas-inscrit-organisme-paiement',
  'confondre-ec32-et-ec3',
]

const TABS: Array<{ value: string; label: string }> = [
  { value: 'demo', label: 'Démo' },
  { value: 'cas', label: 'Cas pratiques' },
  { value: 'erreurs', label: 'Erreurs à éviter' },
  { value: 'regles', label: 'Règles importantes' },
  { value: 'faq', label: 'FAQ' },
  { value: 'ressources', label: 'Ressources' },
]

export function Ec32Experience({ content }: { content: Ec32Content }) {
  const [scenarioKey, setScenarioKey] = useState<string | null>(null)
  const [tab, setTab] = useState<string>('demo')
  // Incrémenté par « Mode guidé pas à pas » pour démarrer le simulateur à la connexion.
  const [guidedTick, setGuidedTick] = useState(0)

  const { legal } = content
  const legalChecks = [legal.noRealData, legal.noTransmission, legal.useOfficial].filter(
    (point) => point.trim().length > 0,
  )
  const hasLegal = Boolean(
    legal.simulationLabel.trim() || legal.notReplacement.trim() || legalChecks.length,
  )

  const scrollTo = (id: string) => {
    if (typeof document !== 'undefined') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const loadScenario = (key: string) => {
    setScenarioKey(key)
    scrollTo('simulateur')
  }

  const goToTab = (value: string) => {
    setTab(value)
    scrollTo('explorer')
  }

  const activeTabLabel = TABS.find((t) => t.value === tab)?.label ?? ''

  const renderPanel = (): ReactNode => {
    switch (tab) {
      case 'demo':
        // Les cas pratiques ont leur propre onglet ; on ne les répète pas ici
        // (le mode « Cas pratiques » ci-dessous y renvoie).
        return (
          <Ec32LearningModes
            content={content}
            onAction={(key) => {
              if (key === 'scenarios') goToTab('cas')
              else if (key === 'guided') {
                setGuidedTick((t) => t + 1)
                scrollTo('simulateur')
              } else scrollTo('simulateur')
            }}
          />
        )
      case 'cas':
        return <Ec32ScenarioCards content={content} onSelect={loadScenario} />
      case 'erreurs':
        return (
          <Ec32MistakesSection content={content} priorityKeys={KEY_MISTAKES} collapseRest />
        )
      case 'regles':
        return <Ec32RulesSection content={content} />
      case 'faq':
        return <Ec32FaqSection content={content} limit={5} />
      case 'ressources':
        return (
          <div className="flex flex-col gap-12">
            <Ec32ResourcesSection content={content} />
            <Ec32HelpBlock content={content} />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex w-full flex-col gap-8 md:gap-10">
      {/* Élément principal : le simulateur, toujours visible. */}
      <Ec32InteractiveSimulator
        content={content}
        scenarioKey={scenarioKey}
        onScenarioConsumed={() => setScenarioKey(null)}
        startLoginSignal={guidedTick}
      />

      {/* Sous-système : donner accès à un proche (page distincte). */}
      <Link
        href="/onem/ec32/acces"
        className="group flex flex-col items-start gap-3 rounded-3xl border border-primary/15 bg-primary/[0.04] p-5 transition-colors hover:border-primary/30 hover:bg-primary/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:gap-5"
      >
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"
          aria-hidden
        >
          <UserPlus className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            Donner accès à un proche (mandat)
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
            Vous pouvez autoriser un proche à remplir votre carte de chômage
            temporaire à votre place. Découvrez en simulation la gestion des
            accès et la demande de mandat.
          </span>
        </span>
        <span
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-transform group-hover:translate-x-0.5"
          aria-hidden
        >
          Ouvrir
          <ArrowRight className="size-4" />
        </span>
      </Link>

      {/* Explorateur à onglets — un seul contenu à la fois (rendu conditionnel
          pour garantir qu'un seul panneau est monté/visible). La barre base-ui
          assure la navigation clavier + l'état actif. */}
      <section id="explorer" className="w-full scroll-mt-24">
        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <div className="overflow-x-auto pb-1">
            <TabsList variant="line" className="w-max min-w-full justify-start gap-1">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="flex-none whitespace-nowrap px-3 py-1.5"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <div
          role="tabpanel"
          aria-label={`Onglet : ${activeTabLabel}`}
          className="mt-8 focus-visible:outline-none"
        >
          {renderPanel()}
        </div>
      </section>

      {/* ── Bande légale finale ──────────────────────────────────── */}
      {hasLegal && (
        <footer className="w-full">
          <div className="flex w-full flex-col gap-6 rounded-[2rem] border border-primary/12 bg-primary/[0.04] px-6 py-8 shadow-[0_1px_3px_rgba(26,26,36,0.04),0_16px_38px_-24px_rgba(91,70,229,0.18)] md:px-10">
            <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-center">
              {/* Intro : bouclier + titre + description */}
              <div className="flex items-start gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary"
                  aria-hidden
                >
                  <ShieldCheck className="size-5" />
                </span>
                <div className="min-w-0">
                  {legal.simulationLabel.trim() && (
                    <p className="text-sm font-semibold text-foreground">{legal.simulationLabel}</p>
                  )}
                  {legal.notReplacement.trim() && (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {legal.notReplacement}
                    </p>
                  )}
                </div>
              </div>

              {/* Garanties : 3 points cochés */}
              {legalChecks.length > 0 && (
                <ul className="grid grid-cols-1 gap-2.5">
                  {legalChecks.map((point, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                        aria-hidden
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      <span className="min-w-0">{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
