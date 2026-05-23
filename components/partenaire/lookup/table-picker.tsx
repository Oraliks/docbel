'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, Search } from 'lucide-react'
import { getModuleInfo, type ModuleInfo } from '@/lib/lookup/modules'
import { cleanTableLabel } from '@/lib/lookup/cleanTableLabel'
import type { PickableTable } from './types'

interface Props {
  tables: PickableTable[]
  value: string
  onChange: (slug: string) => void
  disabled: boolean
}

interface ModuleGroup {
  module: ModuleInfo
  tables: PickableTable[]
}

/**
 * Popover de sélection. Les tables sont groupées par **module ONEM** (S01, S02…)
 * — plus logique pour le partenaire qui pense en termes d'écrans du logiciel
 * ONEM. Recherche libre traverse tous les groupes.
 */
export function TablePicker({ tables, value, onChange, disabled }: Props) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = tables.find((t) => t.slug === value)
  const label = selected
    ? `${selected.prefix} · ${cleanTableLabel(selected.labelFr, selected.prefix)}`
    : 'Tous les modules'

  // Filtre les tables vides (shells jamais importés du seed manuel) — elles
  // n'apportent rien au partenaire et bruitent le picker.
  const nonEmpty = tables.filter((t) => t.entriesCount > 0)
  const filtered = search.trim()
    ? nonEmpty.filter((t) =>
        `${t.prefix} ${t.labelFr} ${t.group ?? ''} ${t.categoryLabel ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase().trim())
      )
    : nonEmpty

  const groups = groupByModule(filtered)

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setTimeout(() => inputRef.current?.focus(), 50)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" type="button" disabled={disabled}>
          <span className="text-xs">Module : </span>
          <span className="font-medium ml-1 truncate max-w-[280px]" title={label}>
            {label}
          </span>
          <ChevronDown className="w-3 h-3 ml-1.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-2">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            ref={inputRef}
            placeholder="Rechercher dans tous les modules…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs border rounded-md pl-7 pr-2 py-1.5 bg-background"
          />
        </div>
        <button
          onClick={() => onChange('')}
          className={`w-full text-left text-xs rounded px-2 py-1.5 hover:bg-muted ${
            !value ? 'bg-muted font-medium' : ''
          }`}
        >
          Tous les modules
        </button>
        <div className="max-h-[420px] overflow-y-auto">
          {groups.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              Aucun résultat
            </div>
          ) : (
            groups.map((g) => (
              <ModuleSection
                key={g.module.prefix}
                group={g}
                activeSlug={value}
                onPick={onChange}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ModuleSection({
  group,
  activeSlug,
  onPick,
}: {
  group: ModuleGroup
  activeSlug: string
  onPick: (slug: string) => void
}) {
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 px-2 py-1 sticky top-0 bg-background z-10 border-b">
        <Badge variant="outline" className="font-mono text-[9px] shrink-0">
          {group.module.prefix}
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold truncate">{group.module.label}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {group.module.description}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {group.tables.length}
        </span>
      </div>
      {group.tables.map((t) => {
        const display = cleanTableLabel(t.labelFr, t.prefix)
        return (
          <button
            key={t.slug}
            onClick={() => onPick(t.slug)}
            className={`w-full text-left text-xs rounded px-2 py-1.5 hover:bg-muted flex items-start justify-between gap-2 ${
              activeSlug === t.slug ? 'bg-muted font-medium' : ''
            }`}
          >
            <span className="truncate flex-1 min-w-0" title={display}>
              {display}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
              {t.entriesCount}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Groupe les tables par leur module (S01, S04, G, etc.) et trie les modules
 * via leur `order` (S01-S52 d'abord, puis A27/DMFA/.../G en fin).
 */
function groupByModule(tables: PickableTable[]): ModuleGroup[] {
  const map = new Map<string, ModuleGroup>()
  for (const t of tables) {
    const moduleInfo = getModuleInfo(t.prefix)
    const existing = map.get(moduleInfo.prefix)
    if (existing) existing.tables.push(t)
    else map.set(moduleInfo.prefix, { module: moduleInfo, tables: [t] })
  }
  // Tri des tables à l'intérieur de chaque module : nb d'entrées décroissant.
  for (const g of map.values()) {
    g.tables.sort((a, b) => b.entriesCount - a.entriesCount)
  }
  return [...map.values()].sort((a, b) => a.module.order - b.module.order)
}
