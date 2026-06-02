'use client'

import { z } from 'zod'
import { Switch } from '@/components/ui/switch'
import {
  ColorControl,
  Field,
  Group,
  Pills,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { sectionDividerSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const PATHS: Record<Props['variant'], string> = {
  wave: 'M0,80 C320,160 720,0 1440,80 L1440,160 L0,160 Z',
  curve: 'M0,160 C480,40 960,40 1440,160 L1440,160 L0,160 Z',
  angle: 'M0,160 L1440,0 L1440,160 Z',
  mountains: 'M0,160 L240,40 L480,120 L720,20 L960,100 L1200,30 L1440,120 L1440,160 Z',
  zigzag:
    'M0,160 L120,40 L240,160 L360,40 L480,160 L600,40 L720,160 L840,40 L960,160 L1080,40 L1200,160 L1320,40 L1440,160 Z',
}

export const sectionDivider = defineBlock({
  type: 'sectionDivider',
  schema,
  defaults: { variant: 'wave', color: '#7C3AED', flip: false, height: 80 },
  meta: {
    name: 'Séparateur SVG',
    description: 'Vague, courbe, montagne…',
    category: 'decorative',
    icon: 'minus',
    shortcuts: ['divider', 'wave'],
  },
  Render: ({ props }) => {
    const { variant, color = 'currentColor', flip, height = 80 } = props
    return (
      <div
        className="w-full leading-[0]"
        style={{ transform: flip ? 'scaleY(-1)' : undefined, color }}
      >
        <svg
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
          className="w-full"
          style={{ height, display: 'block' }}
        >
          <path d={PATHS[variant]} fill={color} />
        </svg>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Forme">
        <Pills
          value={props.variant}
          onChange={(v) => onChange({ variant: v as Props['variant'] })}
          options={[
            { value: 'wave', label: 'Vague' },
            { value: 'curve', label: 'Courbe' },
            { value: 'angle', label: 'Angle' },
            { value: 'mountains', label: 'Montagnes' },
            { value: 'zigzag', label: 'Zigzag' },
          ]}
        />
      </Field>
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
      </Field>
      <Field label="Hauteur">
        <SliderControl
          value={props.height ?? 80}
          onChange={(v) => onChange({ height: v })}
          min={20}
          max={200}
          suffix="px"
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Inverser" className="flex-1">
          <span className="sr-only">flip</span>
        </Field>
        <Switch
          checked={props.flip ?? false}
          onCheckedChange={(v) => onChange({ flip: v })}
        />
      </div>
    </Group>
  ),
})
