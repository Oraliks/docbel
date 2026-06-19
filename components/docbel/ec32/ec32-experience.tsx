'use client'

// =====================================================================
//  eC3.2 — Composition de la page interactive (racine CLIENT)
// ---------------------------------------------------------------------
//  Assemble toutes les sections pédagogiques + le simulateur dans
//  l'ordre attendu, en pleine largeur (aucun max-w/container sur la
//  racine). Détient le seul état partagé : la clé du cas pratique
//  sélectionné, transmise au simulateur puis consommée (remise à null).
//
//  Sélectionner un cas pratique (Ec32ScenarioCards.onSelect) :
//    1. fixe scenarioKey ;
//    2. fait défiler en douceur vers #simulateur.
//  Le simulateur applique le préréglage puis appelle onScenarioConsumed.
// =====================================================================

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { Ec32Content } from '@/lib/ec32/schema'
import { Ec32DisclaimerBanner } from '@/components/docbel/ec32/disclaimer-banner'
import { Ec32Hero } from '@/components/docbel/ec32/hero'
import { Ec32LearningModes } from '@/components/docbel/ec32/learning-modes'
import { Ec32InteractiveSimulator } from '@/components/docbel/ec32/ec32-interactive-simulator'
import { Ec32ScenarioCards } from '@/components/docbel/ec32/scenario-cards'
import { Ec32MistakesSection } from '@/components/docbel/ec32/mistakes-section'
import { Ec32OfficialInfoSection } from '@/components/docbel/ec32/official-info-section'
import { Ec32DerogationsSection } from '@/components/docbel/ec32/derogations-section'
import { Ec32FaqSection } from '@/components/docbel/ec32/faq-section'
import { Ec32ResourcesSection } from '@/components/docbel/ec32/resources-section'

export function Ec32Experience({ content }: { content: Ec32Content }) {
  // Clé du cas pratique chargé dans le simulateur (null = aucun).
  const [scenarioKey, setScenarioKey] = useState<string | null>(null)

  const { legal, builderMetadata } = content

  const legalPoints = [
    legal.simulationLabel,
    legal.noRealData,
    legal.noTransmission,
    legal.notReplacement,
    legal.useOfficial,
  ].filter((point) => point.trim().length > 0)

  return (
    <div className="flex w-full flex-col gap-16 md:gap-20">
      <Ec32DisclaimerBanner content={content} />

      <Ec32Hero content={content} />

      <Ec32LearningModes content={content} />

      <Ec32InteractiveSimulator
        content={content}
        scenarioKey={scenarioKey}
        onScenarioConsumed={() => setScenarioKey(null)}
      />

      <Ec32ScenarioCards
        content={content}
        onSelect={(key) => {
          setScenarioKey(key)
          if (typeof document !== 'undefined') {
            document
              .getElementById('simulateur')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        }}
      />

      <Ec32MistakesSection content={content} />

      <Ec32OfficialInfoSection content={content} />

      <Ec32DerogationsSection content={content} />

      <Ec32FaqSection content={content} />

      <Ec32ResourcesSection content={content} />

      {/* ── Bande légale finale ──────────────────────────────────── */}
      {(legalPoints.length > 0 || builderMetadata.lastReviewedNote) && (
        <footer className="w-full">
          <div className="flex w-full flex-col gap-4 rounded-[2rem] border border-white/60 bg-card/50 px-6 py-8 text-sm leading-relaxed text-muted-foreground shadow-sm backdrop-blur-sm md:px-10">
            {legalPoints.length > 0 && (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {legalPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <ShieldCheck
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span className="min-w-0">{point}</span>
                  </li>
                ))}
              </ul>
            )}
            {builderMetadata.lastReviewedNote && (
              <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground/80">
                {builderMetadata.lastReviewedNote}
                {builderMetadata.version
                  ? ` · Version ${builderMetadata.version}`
                  : ''}
              </p>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
