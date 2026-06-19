'use client'

// =====================================================================
//  eC3.2 — Section « Informations officielles » (présentationnel)
// ---------------------------------------------------------------------
//  Combine 3 sous-blocs visuellement séparés :
//   - #obligations : intro + 2 colonnes travailleurs / employeurs (puces Check)
//   - #pourquoi    : grille d'items + note en petit
//   - #aide        : paragraphes + disclaimer (encadré neutre)
//  Glass mauve, pleine largeur, responsive, accessible.
// =====================================================================

import { Check, HeartHandshake, Info, ListChecks } from 'lucide-react'
import type { Ec32Content } from '@/lib/ec32/schema'
import { Ec32Card, Ec32InfoBox, Ec32Section } from './ui'

/** Liste à puces avec icône Check (réutilisée pour les 2 colonnes obligations). */
function CheckList({ title, items }: { title?: string; items: string[] }) {
  const cleaned = items.filter((i) => i.trim().length > 0)
  if (cleaned.length === 0 && !title) return null
  return (
    <div className="space-y-3">
      {title && (
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
      )}
      <ul className="space-y-2" role="list">
        {cleaned.map((item, index) => (
          <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Ec32OfficialInfoSection({ content }: { content: Ec32Content }) {
  const { obligation, why, help } = content.officialInfo

  const whyItems = why.items.filter((i) => i.trim().length > 0)
  const helpBody = help.body.filter((p) => p.trim().length > 0)

  return (
    <div className="flex w-full flex-col gap-12">
      {/* ── Sous-bloc 1 : Obligations ────────────────────────────── */}
      <Ec32Section
        id="obligations"
        eyebrow="Vos obligations"
        icon={ListChecks}
        title={obligation.title}
        subtitle={obligation.intro}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Ec32Card>
            <CheckList title={obligation.workersTitle} items={obligation.workers} />
          </Ec32Card>
          <Ec32Card>
            <CheckList title={obligation.employersTitle} items={obligation.employers} />
          </Ec32Card>
        </div>
      </Ec32Section>

      {/* ── Sous-bloc 2 : Pourquoi ───────────────────────────────── */}
      {(why.title || whyItems.length > 0) && (
        <Ec32Section
          id="pourquoi"
          eyebrow="Le sens de la démarche"
          icon={Info}
          title={why.title}
          subtitle={why.subtitle}
        >
          {whyItems.length > 0 && (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {whyItems.map((item, index) => (
                <Ec32Card key={index} as="li" className="flex gap-3 p-4">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <p className="min-w-0 text-sm leading-relaxed text-foreground">{item}</p>
                </Ec32Card>
              ))}
            </ul>
          )}
          {why.note && (
            <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              {why.note}
            </p>
          )}
        </Ec32Section>
      )}

      {/* ── Sous-bloc 3 : Aide ───────────────────────────────────── */}
      {(help.title || helpBody.length > 0 || help.disclaimer) && (
        <Ec32Section
          id="aide"
          eyebrow="Besoin d’aide ?"
          icon={HeartHandshake}
          title={help.title}
        >
          <div className="max-w-3xl space-y-4">
            {helpBody.length > 0 && (
              <div className="space-y-3">
                {helpBody.map((paragraph, index) => (
                  <p key={index} className="text-sm leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
            {help.disclaimer && (
              <Ec32InfoBox tone="neutral">{help.disclaimer}</Ec32InfoBox>
            )}
          </div>
        </Ec32Section>
      )}
    </div>
  )
}
