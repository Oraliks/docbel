'use client'

import { Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { prosConsSchema as schema } from './schemas'

export const prosCons = defineBlock({
  type: 'prosCons',
  schema,
  defaults: {
    pros: ['Avantage 1', 'Avantage 2', 'Avantage 3'],
    cons: ['Inconvénient 1', 'Inconvénient 2'],
    prosTitle: 'Avantages',
    consTitle: 'Inconvénients',
  },
  meta: {
    name: 'Pour / Contre',
    description: 'Liste avantages / inconvénients',
    category: 'text',
    icon: 'columns-3',
    shortcuts: ['proscons', 'pros'],
  },
  Render: ({ props }) => {
    const t = useTranslations('public.blocks')
    const { pros, cons, prosTitle, consTitle } = props
    const prosTitleResolved = prosTitle ?? t('prosCons.prosFallback')
    const consTitleResolved = consTitle ?? t('prosCons.consFallback')
    return (
      <div className="my-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-5">
          <h3 className="mb-3 font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <Check className="size-5" /> {prosTitleResolved}
          </h3>
          <ul className="space-y-2 text-sm">
            {pros.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="size-4 mt-0.5 text-emerald-600 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border-2 border-red-500/30 bg-red-500/5 p-5">
          <h3 className="mb-3 font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
            <X className="size-5" /> {consTitleResolved}
          </h3>
          <ul className="space-y-2 text-sm">
            {cons.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <X className="size-4 mt-0.5 text-red-600 shrink-0" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Avantages" defaultOpen>
        <Field label="Titre">
          <Input
            value={props.prosTitle ?? ''}
            onChange={(e) => onChange({ prosTitle: e.target.value })}
          />
        </Field>
        <Field label="Liste (un par ligne)">
          <Textarea
            value={props.pros.join('\n')}
            onChange={(e) =>
              onChange({ pros: e.target.value.split('\n').filter(Boolean) })
            }
            rows={5}
            className="resize-y text-xs"
          />
        </Field>
      </Group>
      <Group title="Inconvénients" defaultOpen>
        <Field label="Titre">
          <Input
            value={props.consTitle ?? ''}
            onChange={(e) => onChange({ consTitle: e.target.value })}
          />
        </Field>
        <Field label="Liste (un par ligne)">
          <Textarea
            value={props.cons.join('\n')}
            onChange={(e) =>
              onChange({ cons: e.target.value.split('\n').filter(Boolean) })
            }
            rows={5}
            className="resize-y text-xs"
          />
        </Field>
      </Group>
    </>
  ),
})
