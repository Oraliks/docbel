'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { RichTextInputProps } from './rich-text-input-editor'

/**
 * Wrapper léger autour de l'éditeur TipTap (RichTextInputEditor).
 *
 * TipTap (~250 Ko) ne sert QUE dans l'éditeur (panneaux `Fields` des blocs +
 * éditeur email messagerie). En le chargeant via `dynamic({ ssr:false })`, on
 * le sort du **bundle public** du page-builder : les blocs importent ce wrapper
 * (et son type, effacé à la compilation) au lieu de TipTap directement, donc le
 * rendu public d'une page (`app/[slug]`) n'embarque plus ProseMirror/TipTap.
 *
 * L'API publique (`RichTextInput` + `RichTextInputProps`) est inchangée → aucun
 * consommateur à modifier.
 */
const RichTextInputEditor = dynamic(
  () =>
    import('./rich-text-input-editor').then((m) => ({
      default: m.RichTextInputEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[140px] items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Chargement de l’éditeur…
      </div>
    ),
  }
)

export function RichTextInput(props: RichTextInputProps) {
  return <RichTextInputEditor {...props} />
}

export type { RichTextInputProps }
