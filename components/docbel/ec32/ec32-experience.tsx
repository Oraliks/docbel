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
import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Ec32Content } from '@/lib/ec32/schema'
import { Ec32DisclaimerBanner } from '@/components/docbel/ec32/disclaimer-banner'
import { Ec32Hero } from '@/components/docbel/ec32/hero'
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

  const { legal, builderMetadata } = content
  const legalPoints = [
    legal.simulationLabel,
    legal.noRealData,
    legal.noTransmission,
    legal.notReplacement,
    legal.useOfficial,
  ].filter((point) => point.trim().length > 0)

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
        return (
          <div className="flex flex-col gap-12">
            <Ec32LearningModes content={content} />
            <Ec32ScenarioCards
              content={content}
              onSelect={loadScenario}
              limit={4}
              onViewAll={() => goToTab('cas')}
              anchorId="cas-pratiques"
            />
          </div>
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
      <Ec32DisclaimerBanner content={content} />

      <Ec32Hero content={content} />

      {/* Élément principal : le simulateur, toujours visible. */}
      <Ec32InteractiveSimulator
        content={content}
        scenarioKey={scenarioKey}
        onScenarioConsumed={() => setScenarioKey(null)}
      />

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
      {(legalPoints.length > 0 || builderMetadata.lastReviewedNote) && (
        <footer className="w-full">
          <div className="flex w-full flex-col gap-4 rounded-[2rem] border border-white/60 bg-card/50 px-6 py-8 text-sm leading-relaxed text-muted-foreground shadow-sm backdrop-blur-sm md:px-10">
            {legalPoints.length > 0 && (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {legalPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">{point}</span>
                  </li>
                ))}
              </ul>
            )}
            {builderMetadata.lastReviewedNote && (
              <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground/80">
                {builderMetadata.lastReviewedNote}
                {builderMetadata.version ? ` · Version ${builderMetadata.version}` : ''}
              </p>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
