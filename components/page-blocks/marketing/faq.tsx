'use client'

import { useState } from 'react'
import { z } from 'zod'
import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { faqSchema as schema } from './schemas'

type Props = z.infer<typeof schema>
type FaqItemData = Props['items'][number]

function FaqItem({
  question,
  answer,
  variant,
}: {
  question: string
  answer: string
  variant: NonNullable<Props['variant']>
}) {
  const [open, setOpen] = useState(false)
  const wrapper =
    variant === 'bordered'
      ? 'rounded-lg border bg-card'
      : variant === 'card'
        ? 'border-b last:border-b-0'
        : 'border-b last:border-b-0'

  return (
    <div className={wrapper}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 px-4 text-left hover:bg-muted/40 transition rounded-md"
      >
        <span className="font-medium">{question}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {answer}
        </div>
      )}
    </div>
  )
}

export const faq = defineBlock({
  type: 'faq',
  schema,
  defaults: {
    title: 'Questions fréquentes',
    items: [
      { question: 'Question 1 ?', answer: 'Réponse à la première question.' },
      { question: 'Question 2 ?', answer: 'Réponse à la deuxième question.' },
      { question: 'Question 3 ?', answer: 'Réponse à la troisième question.' },
    ],
    variant: 'simple',
  },
  meta: {
    name: 'FAQ',
    description: 'Questions / réponses',
    category: 'marketing',
    icon: 'help-circle',
    shortcuts: ['faq', 'questions'],
    variants: [
      { id: 'simple', name: 'Simple' },
      { id: 'bordered', name: 'Bordée' },
      { id: 'card', name: 'Carte' },
    ],
  },
  Render: ({ props }) => {
    const { title, items, variant = 'simple' } = props
    return (
      <div className="w-full py-12">
        <div className="mx-auto max-w-3xl px-6">
          {title && (
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-10">
              {title}
            </h2>
          )}
          <div
            className={cn(
              'space-y-2',
              variant === 'card' && 'rounded-2xl border bg-card p-2 shadow-sm space-y-0'
            )}
          >
            {items.map((item, idx) => (
              <FaqItem
                key={idx}
                question={item.question}
                answer={item.answer}
                variant={variant}
              />
            ))}
          </div>
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre de section">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
      </Group>
      <Group title={`Questions (${props.items.length})`} defaultOpen>
        <RepeaterList<FaqItemData>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Input
                value={item.question}
                onChange={(e) => set({ question: e.target.value })}
                placeholder="Question"
                className="h-8 text-xs"
              />
              <Textarea
                value={item.answer}
                onChange={(e) => set({ answer: e.target.value })}
                placeholder="Réponse"
                rows={2}
                className="resize-y text-xs"
              />
            </>
          )}
          addItem={() => ({ question: 'Nouvelle question ?', answer: 'Réponse…' })}
        />
      </Group>
    </>
  ),
})
