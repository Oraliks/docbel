'use client'

// =====================================================================
//  "Save block as snippet" dialog — extracted from block-wrapper.tsx.
//  Owns its own name/description/saving state; the parent only controls
//  open/onOpenChange and passes the block to persist.
// =====================================================================

import React from 'react'
import { BookmarkPlus } from 'lucide-react'
import { toast } from 'sonner'
import type { BlockProps } from '@/lib/page-builder/types'
import { BLOCK_REGISTRY } from '@/lib/page-builder/registry'
import { saveSnippet } from '@/lib/page-builder/snippets'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface BlockSnippetDialogProps {
  block: BlockProps
  onOpenChange: (open: boolean) => void
}

/**
 * Mounted only while open (see BlockWrapper) so the lazy `useState` initializer
 * seeds the name from the block's registry label on each open — no effect needed.
 */
export function BlockSnippetDialog({ block, onOpenChange }: BlockSnippetDialogProps) {
  const [name, setName] = React.useState(() => BLOCK_REGISTRY[block.type]?.name ?? '')
  const [description, setDescription] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const handleSave = React.useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Un nom est requis')
      return
    }
    setSaving(true)
    try {
      await saveSnippet(trimmed, block, description.trim() || undefined)
      toast.success('Snippet enregistré')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }, [name, description, block, onOpenChange])

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Enregistrer comme snippet</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="snippet-name">Nom</Label>
            <Input
              id="snippet-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !saving) {
                  e.preventDefault()
                  void handleSave()
                }
              }}
              placeholder="Nom du snippet"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="snippet-description">Description (optionnel)</Label>
            <Textarea
              id="snippet-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="À quoi sert ce bloc réutilisable ?"
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <BookmarkPlus className="mr-2 size-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
