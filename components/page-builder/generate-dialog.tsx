'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Sparkles, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import type { BlockProps } from '@/lib/page-builder/types'

interface GenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EXAMPLES = [
  'Une section qui explique comment s’inscrire au chômage après un licenciement',
  'Une FAQ sur les allocations de chômage et leurs conditions',
  'Une section d’introduction sur le rôle de l’ONEM avec un bouton vers le formulaire',
]

export function GenerateDialog({ open, onOpenChange }: GenerateDialogProps) {
  const [prompt, setPrompt] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const insertTemplate = usePageBuilderStore((s) => s.insertTemplate)

  const handleGenerate = async () => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      toast.error('Décris d’abord la section à générer')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/page-builder/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      })
      const data = await res.json()
      if (data?.aiDisabled) {
        toast.error('Assistant IA non configuré')
        return
      }
      if (!res.ok || data?.error) {
        toast.error(data?.error || 'Échec de la génération')
        return
      }
      const blocks = data?.blocks as BlockProps[] | undefined
      if (!Array.isArray(blocks) || blocks.length === 0) {
        toast.error('La génération est vide')
        return
      }
      insertTemplate(blocks)
      toast.success('Section générée et insérée')
      setPrompt('')
      onOpenChange(false)
    } catch {
      toast.error('Échec de la génération')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Générer une section (IA)
          </DialogTitle>
          <DialogDescription>
            Décris la page ou la section à créer. L’IA produit de vrais blocs
            éditables, ancrés dans la base de connaissances chômage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            disabled={loading}
            autoFocus
            placeholder="Décris la page/section à générer…"
            className="resize-none"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                void handleGenerate()
              }
            }}
          />

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Exemples
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={loading}
                  onClick={() => setPrompt(ex)}
                  className="rounded-full border bg-card px-2.5 py-1 text-left text-xs text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Génération…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 size-3.5" />
                Générer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
