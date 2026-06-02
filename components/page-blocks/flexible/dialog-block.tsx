'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { dialogBlockSchema as schema } from './schemas'

type Turn = z.infer<typeof schema>['turns'][number]

export const dialogBlock = defineBlock({
  type: 'dialogBlock',
  schema,
  defaults: {
    title: '',
    turns: [
      { speaker: 'Marie', message: 'Comment introduire ma demande ?', side: 'left' },
      { speaker: 'Conseiller', message: 'Voici la procédure étape par étape.', side: 'right' },
    ],
  },
  meta: {
    name: 'Conversation',
    description: 'Dialogue style chat',
    category: 'text',
    icon: 'message-circle',
    shortcuts: ['dialog', 'chat'],
  },
  Render: ({ props }) => {
    const { title, turns } = props
    return (
      <div className="my-2">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <div className="space-y-2">
          {turns.map((t, i) => {
            const right = t.side === 'right'
            return (
              <div key={i} className={cn('flex gap-2', right && 'justify-end')}>
                <div
                  className={cn(
                    'rounded-2xl px-4 py-2 max-w-[75%] text-sm',
                    right
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm'
                  )}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-0.5">
                    {t.speaker}
                  </div>
                  {t.message}
                </div>
              </div>
            )
          })}
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
      </Group>
      <Group title={`Tours (${props.turns.length})`} defaultOpen>
        <RepeaterList<Turn>
          items={props.turns}
          onChange={(turns) => onChange({ turns })}
          render={(it, set) => (
            <>
              <Input
                value={it.speaker}
                onChange={(e) => set({ speaker: e.target.value })}
                placeholder="Locuteur"
                className="h-8 text-xs"
              />
              <Textarea
                value={it.message}
                onChange={(e) => set({ message: e.target.value })}
                placeholder="Message"
                rows={2}
                className="text-xs resize-y"
              />
              <Pills
                value={it.side}
                onChange={(v) => set({ side: v as Turn['side'] })}
                options={[
                  { value: 'left', label: 'Gauche' },
                  { value: 'right', label: 'Droite' },
                ]}
              />
            </>
          )}
          addItem={() => ({ speaker: 'Personne', message: '', side: 'left' })}
        />
      </Group>
    </>
  ),
})
