'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import { TablePicker } from './table-picker'
import type { PickableTable } from './types'

interface Props {
  q: string
  onQChange: (q: string) => void
  tablesInScope: PickableTable[]
  tableSlug: string
  onTableSlugChange: (slug: string) => void
}

/** Barre de filtres : recherche + module. */
export function FilterBar({
  q,
  onQChange,
  tablesInScope,
  tableSlug,
  onTableSlugChange,
}: Props) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Code ONEM, libellé… (min. 2 caractères) — ou sélectionne un module pour tout voir"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TablePicker
            tables={tablesInScope}
            value={tableSlug}
            onChange={onTableSlugChange}
            disabled={tablesInScope.length === 0}
          />
          {tableSlug && (
            <Button variant="ghost" size="sm" onClick={() => onTableSlugChange('')}>
              <X className="w-3 h-3 mr-1" />
              Réinitialiser
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
