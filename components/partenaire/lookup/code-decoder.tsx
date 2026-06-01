'use client'

import * as React from 'react'
import { Sparkles } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseOnemCode } from '@/lib/lookup/parseOnemCode'

interface Props {
  /** Valeur initiale optionnelle pour pré-remplir le champ. */
  defaultValue?: string
}

/**
 * Décodeur autonome de code ONEM. Décompose en live un code structuré
 * (`01/43AA1`, `S04`, `1000`…) en segments lisibles, sans appel réseau :
 * `parseOnemCode` est une fonction pure et client-safe.
 *
 * Réutilise visuellement les tuiles bordées de `AnatomyPanel`.
 */
export function CodeDecoder({ defaultValue = '' }: Props) {
  const [value, setValue] = React.useState(defaultValue)

  // Parsing à chaque rendu (fonction pure, pas de coût réseau).
  const trimmed = value.trim()
  const anatomy = trimmed ? parseOnemCode(trimmed) : null
  // Message doux uniquement quand l'utilisateur a vraiment commencé à taper.
  const showUnknown = trimmed.length >= 2 && anatomy === null

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium">Décoder un code ONEM</span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="code-decoder-input" className="sr-only">
            Code ONEM à décoder
          </Label>
          <Input
            id="code-decoder-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Collez un code, ex: 01/43AA1 ou S04 ou 1000"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </div>

        {anatomy && (
          <div className="space-y-2">
            {anatomy.summary && (
              <p className="text-xs text-muted-foreground">{anatomy.summary}</p>
            )}
            <div className="flex flex-wrap gap-3">
              {anatomy.parts.map((part, i) => (
                <div
                  key={`${part.label}-${i}`}
                  className="flex flex-col gap-0.5 rounded-md border bg-background px-2.5 py-1.5"
                >
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {part.label}
                  </span>
                  <span className="font-mono text-xs font-semibold">{part.value}</span>
                  {part.description && (
                    <span className="max-w-[200px] text-[11px] text-muted-foreground">
                      {part.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showUnknown && (
          <p className="text-xs text-muted-foreground">
            Code non reconnu — tente la recherche dans une table.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
