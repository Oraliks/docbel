'use client'

import { FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { casePracticeSchema as schema } from './schemas'

export const casePractice = defineBlock({
  type: 'casePractice',
  schema,
  defaults: {
    title: 'Cas pratique',
    situation:
      'Marie, 35 ans, vient de perdre son emploi après 8 ans dans la même entreprise.',
    steps: [
      'Marie se rend au CPAS de sa commune.',
      'Elle introduit une demande d\'allocations de chômage.',
      'Le CPAS examine sa situation sous 30 jours.',
    ],
    outcome: 'Marie reçoit ses premières allocations le mois suivant.',
  },
  meta: {
    name: 'Cas pratique',
    description: 'Situation concrète + démarche',
    category: 'docbel',
    icon: 'file-text',
    shortcuts: ['cas', 'casepractice'],
  },
  Render: ({ props }) => {
    const { title, situation, steps, outcome } = props
    return (
      <div className="rounded-2xl border bg-card overflow-hidden my-2">
        <div className="border-b bg-muted/40 px-5 py-3 flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Cas pratique
          </span>
        </div>
        <div className="p-5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed">{situation}</p>
          <div className="mt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Démarche
            </h4>
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          {outcome && (
            <div className="mt-4 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                Résultat :
              </span>{' '}
              {outcome}
            </div>
          )}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre">
        <Input value={props.title} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>
      <Field label="Situation">
        <Textarea
          value={props.situation}
          onChange={(e) => onChange({ situation: e.target.value })}
          rows={3}
          className="resize-y"
        />
      </Field>
      <Field label="Étapes (une par ligne)">
        <Textarea
          value={props.steps.join('\n')}
          onChange={(e) =>
            onChange({ steps: e.target.value.split('\n').filter(Boolean) })
          }
          rows={5}
          className="text-xs resize-y"
        />
      </Field>
      <Field label="Résultat">
        <Textarea
          value={props.outcome ?? ''}
          onChange={(e) => onChange({ outcome: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
    </Group>
  ),
})
