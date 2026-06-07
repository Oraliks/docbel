'use client'

import React from 'react'
import { Braces, Plus, Trash2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import type { PageVariable } from '@/lib/page-builder/types'

interface VariablesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Keep keys to a safe identifier so the {{token}} always resolves and the
 *  API schema (`^[a-zA-Z][a-zA-Z0-9_]*$`) never rejects the autosave. */
function sanitizeKey(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, '').replace(/^[^a-zA-Z]+/, '')
}

export function VariablesDialog({ open, onOpenChange }: VariablesDialogProps) {
  const variables = usePageBuilderStore((s) => s.variables)
  const setVariables = usePageBuilderStore((s) => s.setVariables)

  const update = (next: PageVariable[]) => setVariables(next)

  const addRow = () => update([...variables, { key: '', value: '' }])

  const removeRow = (i: number) =>
    update(variables.filter((_, idx) => idx !== i))

  const setKey = (i: number, raw: string) =>
    update(
      variables.map((v, idx) => (idx === i ? { ...v, key: sanitizeKey(raw) } : v))
    )

  const setValue = (i: number, value: string) =>
    update(variables.map((v, idx) => (idx === i ? { ...v, value } : v)))

  const copyToken = (key: string) => {
    if (!key) return
    navigator.clipboard?.writeText(`{{${key}}}`)
    toast.success(`{{${key}}} copié`)
  }

  // Detect duplicate keys (last one wins at render — warn the user).
  const seen = new Map<string, number>()
  variables.forEach((v) => {
    if (v.key) seen.set(v.key, (seen.get(v.key) ?? 0) + 1)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Braces className="size-4" />
            Variables de la page
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-1">
          Définissez une valeur une fois, réutilisez-la partout en tapant{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">
            {'{{clé}}'}
          </code>{' '}
          dans n&apos;importe quel champ texte. Résolu à l&apos;affichage de la
          page publique.
        </p>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {variables.length === 0 && (
            <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Aucune variable. Ajoutez-en une pour commencer.
            </div>
          )}

          {variables.map((v, i) => {
            const dup = v.key.length > 0 && (seen.get(v.key) ?? 0) > 1
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-mono text-xs text-muted-foreground">
                    {'{{'}
                  </span>
                  <Input
                    value={v.key}
                    onChange={(e) => setKey(i, e.target.value)}
                    placeholder="clé"
                    aria-invalid={dup}
                    className={`h-8 w-32 font-mono text-xs ${
                      dup ? 'border-destructive' : ''
                    }`}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {'}}'}
                  </span>
                </div>
                <span className="text-muted-foreground">=</span>
                <Input
                  value={v.value}
                  onChange={(e) => setValue(i, e.target.value)}
                  placeholder="valeur"
                  className="h-8 flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  title="Copier le token"
                  onClick={() => copyToken(v.key)}
                  disabled={!v.key}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  title="Supprimer"
                  onClick={() => removeRow(i)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )
          })}
        </div>

        <div className="border-t pt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Sauvegardé automatiquement. Les clés en double sont ignorées.
          </p>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-3.5 mr-1" />
            Ajouter une variable
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
