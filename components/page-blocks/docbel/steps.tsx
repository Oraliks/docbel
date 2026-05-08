'use client'

import { z } from 'zod'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const itemSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(1000),
  icon: z.string().max(40).optional(),
  status: z.enum(['todo', 'current', 'done']).optional(),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  subtitle: z.string().max(500).optional(),
  items: z.array(itemSchema).max(20),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  variant: z.enum(['numbered', 'icons', 'compact']).optional(),
})

type Props = z.infer<typeof schema>
type Item = Props['items'][number]

export const steps = defineBlock({
  type: 'steps',
  schema,
  defaults: {
    title: 'Comment ça marche',
    subtitle: '',
    items: [
      { title: 'Étape 1', description: 'Description de la première étape.', icon: '1' },
      { title: 'Étape 2', description: 'Description de la deuxième étape.', icon: '2' },
      { title: 'Étape 3', description: 'Description de la troisième étape.', icon: '3' },
    ],
    orientation: 'horizontal',
    variant: 'numbered',
  },
  meta: {
    name: 'Étapes',
    description: 'Procédure pas à pas',
    category: 'docbel',
    icon: 'arrow-up-down',
    shortcuts: ['steps', 'etapes', 'procedure'],
    variants: [
      { id: 'numbered', name: 'Numérotée' },
      { id: 'icons', name: 'Avec icônes' },
      { id: 'compact', name: 'Compacte' },
    ],
  },
  Render: ({ props }) => {
    const { title, subtitle, items, orientation = 'horizontal' } = props
    return (
      <div className="w-full py-8">
        <div className="mx-auto max-w-5xl px-4">
          {(title || subtitle) && (
            <div className="mb-8 text-center max-w-2xl mx-auto">
              {title && <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>}
              {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          {orientation === 'vertical' ? (
            <ol className="relative space-y-6 border-l-2 border-border pl-6 ml-2">
              {items.map((step, idx) => (
                <li key={idx} className="relative">
                  <span
                    className={cn(
                      'absolute -left-[34px] flex size-8 items-center justify-center rounded-full text-sm font-semibold ring-4 ring-background',
                      step.status === 'done'
                        ? 'bg-primary text-primary-foreground'
                        : step.status === 'current'
                          ? 'bg-primary/20 text-primary border-2 border-primary'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {step.status === 'done' ? <Check className="size-4" /> : step.icon || idx + 1}
                  </span>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
              {items.map((step, idx) => (
                <div key={idx} className="relative text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold mb-3">
                    {step.icon || idx + 1}
                  </div>
                  {idx < items.length - 1 && (
                    <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-0.5 bg-border" />
                  )}
                  <h3 className="font-semibold relative">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground relative">{step.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Sous-titre">
          <Input
            value={props.subtitle ?? ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
          />
        </Field>
        <Field label="Orientation">
          <Pills
            value={props.orientation ?? 'horizontal'}
            onChange={(v) => onChange({ orientation: v as Props['orientation'] })}
            options={[
              { value: 'horizontal', label: 'Horizontale' },
              { value: 'vertical', label: 'Verticale' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Étapes (${props.items.length})`} defaultOpen>
        <RepeaterList<Item>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                <Input
                  value={item.icon ?? ''}
                  onChange={(e) => set({ icon: e.target.value })}
                  placeholder="Icône"
                  className="h-8 text-xs"
                />
                <div className="col-span-2">
                  <Input
                    value={item.title}
                    onChange={(e) => set({ title: e.target.value })}
                    placeholder="Titre"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <Textarea
                value={item.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="resize-y text-xs"
              />
              <Pills
                value={item.status ?? 'todo'}
                onChange={(v) => set({ status: v as Item['status'] })}
                options={[
                  { value: 'todo', label: 'À faire' },
                  { value: 'current', label: 'En cours' },
                  { value: 'done', label: 'Fait' },
                ]}
              />
            </>
          )}
          addItem={() => ({ title: 'Nouvelle étape', description: '' })}
        />
      </Group>
    </>
  ),
})
