'use client'

import { useTranslations } from 'next-intl'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, SliderControl } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { sanitizeEmbedHtml } from '@/lib/sanitize-html'
import { embedSchema as schema } from './schemas'

export const embed = defineBlock({
  type: 'embed',
  schema,
  defaults: { html: '', height: 400 },
  meta: {
    name: 'Embed',
    description: 'iframe ou code HTML',
    category: 'media',
    icon: 'code',
    shortcuts: ['embed', 'iframe'],
  },
  Render: ({ props }) => {
    const t = useTranslations('public.blocks')
    const { html, height = 400 } = props
    if (!html) {
      return (
        <div
          className="flex items-center justify-center bg-muted text-muted-foreground rounded-lg border border-dashed"
          style={{ height }}
        >
          {t('embed.empty')}
        </div>
      )
    }
    return (
      <div
        className="w-full overflow-hidden rounded-lg"
        style={{ minHeight: height }}
        dangerouslySetInnerHTML={{ __html: sanitizeEmbedHtml(html) }}
      />
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field
        label="HTML / iframe"
        hint="⚠️ Code injecté tel quel — utilisez uniquement des sources de confiance."
      >
        <Textarea
          value={props.html}
          onChange={(e) => onChange({ html: e.target.value })}
          rows={8}
          className="resize-y font-mono text-[11px]"
          placeholder='<iframe src="…"></iframe>'
        />
      </Field>
      <Field label="Hauteur minimum">
        <SliderControl
          value={props.height ?? 400}
          onChange={(v) => onChange({ height: v })}
          min={100}
          max={1200}
          suffix="px"
        />
      </Field>
    </Group>
  ),
})
