import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'
import type { CodeAnatomy } from '@/lib/lookup/parseOnemCode'

interface TableHint {
  slug: string
  labelFr: string
  prefix: string
}

interface Props {
  anatomy: CodeAnatomy
  activeTableSlug: string
  tablesInScope: TableHint[]
  onPickTable: (slug: string) => void
}

/**
 * Bandeau pédagogique qui décompose un code ONEM structuré (`01/43AA1`, `S04`,
 * `1000`). Propose les tables pertinentes pour pré-filtrer la recherche.
 */
export function AnatomyPanel({ anatomy, activeTableSlug, tablesInScope, onPickTable }: Props) {
  // Filtre les suggestions sur ce qui existe vraiment dans le scope (sinon le
  // bouton "Filtrer" ne ferait rien).
  const suggestions = anatomy.suggestedTables
    .map((slug) => tablesInScope.find((t) => t.slug === slug))
    .filter((t): t is TableHint => Boolean(t))

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="space-y-2 flex-1 min-w-0">
            <div className="text-xs font-medium">
              Anatomie du code <code className="font-mono">{anatomy.raw}</code>
              {anatomy.summary && (
                <span className="text-muted-foreground font-normal ml-2">· {anatomy.summary}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {anatomy.parts.map((part, i) => (
                <div
                  key={`${part.label}-${i}`}
                  className="flex flex-col gap-0.5 bg-background border rounded-md px-2.5 py-1.5"
                >
                  <span className="text-[10px] uppercase text-muted-foreground tracking-wider">
                    {part.label}
                  </span>
                  <span className="font-mono text-xs font-semibold">{part.value}</span>
                  {part.description && (
                    <span className="text-[11px] text-muted-foreground max-w-[200px]">
                      {part.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-muted-foreground">Tables suggérées :</span>
                {suggestions.map((t) => {
                  const isActive = activeTableSlug === t.slug
                  return (
                    <Button
                      key={t.slug}
                      size="sm"
                      variant={isActive ? 'default' : 'outline'}
                      type="button"
                      onClick={() => onPickTable(isActive ? '' : t.slug)}
                      className="h-7 text-[11px]"
                    >
                      <Badge variant="outline" className="font-mono text-[9px] mr-1.5">
                        {t.prefix}
                      </Badge>
                      {t.labelFr}
                    </Button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
