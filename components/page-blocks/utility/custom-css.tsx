'use client'

import { z } from 'zod'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({ css: z.string().max(50000).default('') })

/**
 * Le contenu est du CSS injecté dans une balise <style>, PAS du HTML : on ne
 * peut donc pas le passer dans un sanitiseur HTML (cela casserait le CSS).
 * Le seul vecteur d'injection réel ici est une séquence `</style>` qui
 * fermerait prématurément la balise et permettrait d'injecter du HTML/JS
 * derrière. On neutralise donc toute fermeture `</style>`.
 * NB : décision produit en attente — voir rapport (cf. aussi `@import` /
 * `url(javascript:…)` qui restent du ressort d'une politique CSP).
 */
function sanitizeStyleContent(css: string): string {
  if (!css) return ''
  return css.replace(/<\/\s*style/gi, '<\\/style')
}

export const customCss = defineBlock({
  type: 'customCss',
  schema,
  defaults: { css: '/* Votre CSS ici */' },
  meta: {
    name: 'CSS custom',
    description: 'CSS appliqué à la page',
    category: 'utility',
    icon: 'code',
    shortcuts: ['css'],
  },
  Render: ({ props }) => (
    <style dangerouslySetInnerHTML={{ __html: sanitizeStyleContent(props.css) }} />
  ),
  Fields: ({ props, onChange }) => (
    <Group title="CSS" defaultOpen>
      <Field label="Code CSS" hint="Appliqué à toute la page">
        <Textarea
          value={props.css}
          onChange={(e) => onChange({ css: e.target.value })}
          rows={10}
          className="font-mono text-xs resize-y"
        />
      </Field>
    </Group>
  ),
})
