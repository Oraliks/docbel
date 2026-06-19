'use client'

// =====================================================================
//  eC3.2 — Bandeau « simulation pédagogique non officielle »
// ---------------------------------------------------------------------
//  Avertissement bien visible, rassurant et sérieux : rien n'est envoyé
//  à l'ONEM, données 100 % fictives. Chaque point est accompagné d'une
//  icône (jamais d'information par la seule couleur).
// =====================================================================

import { Info, ShieldCheck } from 'lucide-react'
import { Ec32InfoBox } from '@/components/docbel/ec32/ui'
import type { Ec32Content } from '@/lib/ec32/schema'

export function Ec32DisclaimerBanner({ content }: { content: Ec32Content }) {
  const { disclaimer } = content

  if (!disclaimer.title && disclaimer.points.length === 0) return null

  return (
    <div className="w-full">
      <Ec32InfoBox tone="legal" icon={ShieldCheck} title={disclaimer.title || undefined}>
        {disclaimer.points.length > 0 && (
          <ul className="mt-1 space-y-2">
            {disclaimer.points.map((point, index) => (
              <li key={index} className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
      </Ec32InfoBox>
    </div>
  )
}
