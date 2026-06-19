'use client'

// =====================================================================
//  eC3.2 — Bloc « Besoin d'aide ? » (officialInfo.help)
// ---------------------------------------------------------------------
//  Affiché dans l'onglet Ressources, en complément des liens utiles.
//  Docbel aide à comprendre, mais ne remplace ni l'ONEM ni l'organisme
//  de paiement. Tout le texte reste éditable dans le builder.
// =====================================================================

import { HeartHandshake } from 'lucide-react'
import type { Ec32Content } from '@/lib/ec32/schema'
import { Ec32InfoBox, Ec32Section } from './ui'

export function Ec32HelpBlock({ content }: { content: Ec32Content }) {
  const { help } = content.officialInfo
  const body = help.body.filter((p) => p.trim().length > 0)

  if (!help.title && body.length === 0 && !help.disclaimer) return null

  return (
    <Ec32Section id="aide" eyebrow="Besoin d’aide ?" icon={HeartHandshake} title={help.title}>
      <div className="max-w-3xl space-y-4">
        {body.length > 0 && (
          <div className="space-y-3">
            {body.map((paragraph, index) => (
              <p key={index} className="text-sm leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </div>
        )}
        {help.disclaimer && <Ec32InfoBox tone="neutral">{help.disclaimer}</Ec32InfoBox>}
      </div>
    </Ec32Section>
  )
}
