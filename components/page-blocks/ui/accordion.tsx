'use client'

import { z } from 'zod'
import {
  Accordion as AccordionPrimitive,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const itemSchema = z.object({
  title: z.string().max(500),
  content: z.string().max(5000),
})

const schema = z.object({
  items: z.array(itemSchema).max(50),
  type: z.enum(['single', 'multiple']).optional(),
  variant: z.enum(['default', 'bordered', 'separated']).optional(),
})

type Props = z.infer<typeof schema>

const WRAPPER_CLASS: Record<NonNullable<Props['variant']>, string> = {
  default: '',
  bordered: 'rounded-2xl border bg-card overflow-hidden',
  separated: 'space-y-2',
}

export const accordion = defineBlock({
  type: 'accordion',
  schema,
  defaults: {
    items: [
      { title: 'Section 1', content: 'Contenu de la première section.' },
      { title: 'Section 2', content: 'Contenu de la deuxième section.' },
    ],
    type: 'single',
    variant: 'default',
  },
  meta: {
    name: 'Accordéon',
    description: 'Sections dépliables',
    category: 'ui',
    icon: 'help-circle',
    shortcuts: ['accordion', 'accordeon'],
    variants: [
      { id: 'default', name: 'Standard' },
      { id: 'bordered', name: 'Bordée' },
      { id: 'separated', name: 'Séparée' },
    ],
  },
  Render: ({ props }) => {
    const { items, type = 'single', variant = 'default' } = props
    return (
      <div className={cn('w-full', WRAPPER_CLASS[variant])}>
        <AccordionPrimitive type={type} collapsible>
          {items.map((item, idx) => (
            <AccordionItem
              key={idx}
              value={`item-${idx}`}
              className={cn(variant === 'separated' && 'rounded-xl border bg-card px-4')}
            >
              <AccordionTrigger className="px-4">{item.title}</AccordionTrigger>
              <AccordionContent className="px-4">{item.content}</AccordionContent>
            </AccordionItem>
          ))}
        </AccordionPrimitive>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Comportement" defaultOpen>
        <Field label="Type">
          <Pills
            value={props.type ?? 'single'}
            onChange={(v) => onChange({ type: v as Props['type'] })}
            options={[
              { value: 'single', label: 'Un à la fois' },
              { value: 'multiple', label: 'Multiple' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Sections (${props.items.length})`} defaultOpen>
        <RepeaterList<Props['items'][number]>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Input
                value={item.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Titre"
                className="h-8 text-xs"
              />
              <Textarea
                value={item.content}
                onChange={(e) => set({ content: e.target.value })}
                placeholder="Contenu"
                rows={3}
                className="resize-y text-xs"
              />
            </>
          )}
          addItem={() => ({ title: 'Nouvelle section', content: '' })}
        />
      </Group>
    </>
  ),
})
