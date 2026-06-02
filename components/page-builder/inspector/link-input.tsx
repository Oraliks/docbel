'use client'

import React from 'react'
import { Link2, Loader2, Search, ExternalLink } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface LinkableItem {
  group: string
  label: string
  url: string
}

interface LinkInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

// Cache module-level : les items changent rarement et plusieurs LinkInput
// peuvent être montés en même temps (repeaters). On évite de re-fetch à chaque
// ouverture / chaque instance.
let cachedItems: LinkableItem[] | null = null
let inflight: Promise<LinkableItem[]> | null = null

async function loadLinkableItems(): Promise<LinkableItem[]> {
  if (cachedItems) return cachedItems
  if (inflight) return inflight
  inflight = fetch('/api/page-builder/links')
    .then(async (r) => {
      if (!r.ok) throw new Error('Failed')
      const data = await r.json()
      return Array.isArray(data?.items) ? (data.items as LinkableItem[]) : []
    })
    .then((items) => {
      cachedItems = items
      return items
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function LinkInput({ value, onChange, placeholder }: LinkInputProps) {
  const [open, setOpen] = React.useState(false)
  const [items, setItems] = React.useState<LinkableItem[]>(() => cachedItems ?? [])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [query, setQuery] = React.useState('')

  // Charge paresseusement au premier ouverture (sauf si déjà en cache).
  React.useEffect(() => {
    if (!open || cachedItems) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(false)
    loadLinkableItems()
      .then((data) => {
        if (active) setItems(data)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open])

  const groups = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? items.filter(
          (it) =>
            it.label.toLowerCase().includes(q) || it.url.toLowerCase().includes(q)
        )
      : items
    const byGroup = new Map<string, LinkableItem[]>()
    for (const it of filtered) {
      const list = byGroup.get(it.group) ?? []
      list.push(it)
      byGroup.set(it.group, list)
    }
    return Array.from(byGroup.entries())
  }, [items, query])

  const pick = (url: string) => {
    onChange(url)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="flex items-stretch gap-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '/cible ou https://…'}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon-sm"
            variant="outline"
            className="h-8 w-8 shrink-0"
            title="Choisir une page ou une actualité"
          >
            <Link2 className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="end">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une page…"
                className="h-7 pl-7 text-xs"
                autoFocus
              />
            </div>
            <ScrollArea className="h-56 -mx-1">
              <div className="px-1">
                {loading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                ) : error ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Impossible de charger les liens.
                  </div>
                ) : groups.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    {query ? `Aucun résultat pour « ${query} »` : 'Aucune page publiée'}
                  </div>
                ) : (
                  groups.map(([group, list]) => (
                    <div key={group} className="mb-2 last:mb-0">
                      <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {group}
                      </div>
                      <div className="space-y-0.5">
                        {list.map((it) => (
                          <button
                            key={`${it.group}-${it.url}`}
                            type="button"
                            onClick={() => pick(it.url)}
                            title={it.url}
                            className={cn(
                              'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition hover:bg-muted',
                              value === it.url && 'bg-primary/10'
                            )}
                          >
                            <span className="text-xs font-medium leading-tight line-clamp-1 w-full">
                              {it.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground leading-tight line-clamp-1 w-full">
                              {it.url}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <ExternalLink className="size-3" />
              Vous pouvez aussi taper une URL libre dans le champ.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
