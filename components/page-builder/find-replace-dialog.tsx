'use client'

import React from 'react'
import { Replace } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePageBuilderStore } from '@/lib/page-builder/store'

interface FindReplaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Editorial text keys — MUST stay in sync with `TEXT_KEYS` in
 * `lib/page-builder/store.ts`. Find & replace only touches strings sitting under
 * one of these keys, so structural strings (url, link, src, icon…) are left alone.
 */
const TEXT_KEYS = [
  'text',
  'title',
  'subtitle',
  'description',
  'content',
  'quote',
  'caption',
  'label',
  'answer',
  'question',
  'html',
]
const TEXT_KEY_SET = new Set<string>(TEXT_KEYS)

/**
 * Counts literal (non-regex), case-sensitive occurrences of `find` inside strings
 * whose parent object key is an editorial text key — walking arrays and plain
 * objects recursively. Mirrors the store's `deepReplaceText` scoping EXACTLY so the
 * preview count matches the number of replacements `replaceText` will perform.
 * `parentKey` is the key of the property being visited (undefined at the root and
 * for array elements, which inherit their array's key via the recursion).
 */
function countOccurrences(value: unknown, find: string, parentKey?: string): number {
  if (!find) return 0
  if (typeof value === 'string') {
    if (parentKey === undefined || !TEXT_KEY_SET.has(parentKey)) return 0
    return value.split(find).length - 1
  }
  if (Array.isArray(value)) {
    let total = 0
    for (const item of value) total += countOccurrences(item, find, parentKey)
    return total
  }
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value)
    if (proto === Object.prototype || proto === null) {
      let total = 0
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        total += countOccurrences(child, find, key)
      }
      return total
    }
  }
  return 0
}

export function FindReplaceDialog({ open, onOpenChange }: FindReplaceDialogProps) {
  const blocks = usePageBuilderStore((s) => s.blocks)
  const replaceText = usePageBuilderStore((s) => s.replaceText)

  const [find, setFind] = React.useState('')
  const [replace, setReplace] = React.useState('')

  // Wrap the parent handler so closing the dialog clears the fields for next time.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setFind('')
      setReplace('')
    }
    onOpenChange(next)
  }

  const count = React.useMemo(() => {
    if (!find) return 0
    let total = 0
    for (const b of blocks) total += countOccurrences(b.props, find)
    return total
  }, [blocks, find])

  const canReplace = find.length > 0 && count > 0

  const handleReplaceAll = () => {
    if (!canReplace) return
    const n = count
    replaceText(find, replace)
    toast.success(`${n} remplacement${n > 1 ? 's' : ''}`)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Replace className="size-4" />
            Rechercher et remplacer
          </DialogTitle>
        </DialogHeader>

        <p className="-mt-1 text-xs text-muted-foreground">
          Remplace le texte dans tous les blocs de la page. Sensible à la casse.
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="find-replace-find" className="text-xs">
              Rechercher
            </Label>
            <Input
              id="find-replace-find"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Texte à rechercher…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleReplaceAll()
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="find-replace-replace" className="text-xs">
              Remplacer par
            </Label>
            <Input
              id="find-replace-replace"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              placeholder="Texte de remplacement…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleReplaceAll()
                }
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {find.length === 0
              ? 'Saisissez un texte à rechercher.'
              : count === 0
                ? 'Aucune occurrence trouvée.'
                : `${count} occurrence${count > 1 ? 's' : ''} trouvée${
                    count > 1 ? 's' : ''
                  }.`}
          </p>
          <Button size="sm" onClick={handleReplaceAll} disabled={!canReplace}>
            Tout remplacer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
