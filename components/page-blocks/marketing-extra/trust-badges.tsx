'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { IconPicker, renderIcon } from '@/components/page-builder/inspector/icon-picker'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const badgeSchema = z.object({
  icon: z.string().max(40).optional(),
  label: z.string().max(120),
})

const schema = z.object({
  badges: z.array(badgeSchema).max(20),
  align: z.enum(['left', 'center']).optional(),
})

type Props = z.infer<typeof schema>
type Badge = Props['badges'][number]

export const trustBadges = defineBlock({
  type: 'trustBadges',
  schema,
  defaults: {
    badges: [
      { icon: 'lock', label: 'Paiement sécurisé' },
      { icon: 'shield', label: 'Données protégées' },
      { icon: 'check', label: 'Garantie 30 jours' },
    ],
    align: 'center',
  },
  meta: {
    name: 'Badges de confiance',
    description: 'SSL, paiement, certifs',
    category: 'marketing',
    icon: 'shield',
    shortcuts: ['trust', 'badges'],
  },
  Render: ({ props }) => (
    <div
      className={cn(
        'w-full py-4 flex flex-wrap gap-x-6 gap-y-3',
        (props.align ?? 'center') === 'center' && 'justify-center'
      )}
    >
      {props.badges.map((b, i) => (
        <div key={i} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          {b.icon && <span className="text-primary">{renderIcon(b.icon, 'size-4')}</span>}
          {b.label}
        </div>
      ))}
    </div>
  ),
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Affichage" defaultOpen>
        <Field label="Alignement">
          <Pills
            value={props.align ?? 'center'}
            onChange={(v) => onChange({ align: v as Props['align'] })}
            options={[
              { value: 'left', label: 'Gauche' },
              { value: 'center', label: 'Centre' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Badges (${props.badges.length})`} defaultOpen>
        <RepeaterList<Badge>
          items={props.badges}
          onChange={(badges) => onChange({ badges })}
          render={(it, set) => (
            <>
              <Input
                value={it.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="Texte"
                className="h-8 text-xs"
              />
              <IconPicker value={it.icon ?? ''} onChange={(icon) => set({ icon })} />
            </>
          )}
          addItem={() => ({ label: 'Nouveau badge', icon: 'shield' })}
        />
      </Group>
    </>
  ),
})
