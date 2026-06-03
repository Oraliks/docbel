'use client'

import React from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ContentTab } from './content-tab'
import { DesignTab } from './design-tab'
import { LayoutTab } from './layout-tab'
import { AdvancedTab } from './advanced-tab'
import { usePageBuilderStore, selectSelectedBlock } from '@/lib/page-builder/store'
import { mergeForDevice } from '@/lib/page-builder/block-styles'
import { cn } from '@/lib/utils'
import { FileText, Palette, Layout, Settings2 } from 'lucide-react'

const TABS = [
  { id: 'content', label: 'Contenu', icon: FileText },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'layout', label: 'Layout', icon: Layout },
  { id: 'advanced', label: 'Avancé', icon: Settings2 },
] as const
type TabId = (typeof TABS)[number]['id']

export function Inspector() {
  const block = usePageBuilderStore(selectSelectedBlock)
  const device = usePageBuilderStore((s) => s.device)
  const updateBlockProps = usePageBuilderStore((s) => s.updateBlockProps)
  const updateBlockStyle = usePageBuilderStore((s) => s.updateBlockStyle)
  const updateBlockLayout = usePageBuilderStore((s) => s.updateBlockLayout)
  const updateBlockAdvanced = usePageBuilderStore((s) => s.updateBlockAdvanced)
  const updateBlockResponsive = usePageBuilderStore((s) => s.updateBlockResponsive)

  const [tab, setTab] = React.useState<TabId>('content')

  // Reset to Content tab when selection changes
  const lastIdRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (block?.id !== lastIdRef.current) {
      setTab('content')
      lastIdRef.current = block?.id ?? null
    }
  }, [block?.id])

  if (!block) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="text-muted-foreground/40 text-4xl">⌖</div>
        <p className="text-sm font-medium">Aucun bloc sélectionné</p>
        <p className="text-xs text-muted-foreground max-w-[220px]">
          Cliquez sur un bloc dans le canvas ou les calques pour modifier ses propriétés.
        </p>
      </div>
    )
  }

  // On tablet/mobile, Design & Layout edit per-device overrides (responsive),
  // showing the merged values; Desktop edits the base (unchanged path).
  const isResponsive = device !== 'desktop'
  const merged = isResponsive ? mergeForDevice(block, device) : null
  const displayBlock = merged ? { ...block, style: merged.style, layout: merged.layout } : block
  const deviceLabel = device === 'tablet' ? 'Tablette' : 'Mobile'

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'group flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors border-b-2 -mb-px',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      <ScrollArea className="flex-1">
        {isResponsive && (tab === 'design' || tab === 'layout') && (
          <div className="m-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-primary">
            ✎ Vous éditez l’affichage <strong>{deviceLabel}</strong>. Ces réglages
            ne s’appliquent qu’à cet écran (le Desktop reste la base).
          </div>
        )}
        {tab === 'content' && (
          <ContentTab
            block={block}
            onPropChange={(props) => updateBlockProps(block.id, props)}
          />
        )}
        {tab === 'design' && (
          <DesignTab
            block={displayBlock}
            onChange={(s) =>
              isResponsive
                ? updateBlockResponsive(block.id, device as 'tablet' | 'mobile', { style: s })
                : updateBlockStyle(block.id, s)
            }
          />
        )}
        {tab === 'layout' && (
          <LayoutTab
            block={displayBlock}
            device={device}
            onChange={(l) =>
              isResponsive
                ? updateBlockResponsive(block.id, device as 'tablet' | 'mobile', { layout: l })
                : updateBlockLayout(block.id, l)
            }
          />
        )}
        {tab === 'advanced' && (
          <AdvancedTab block={block} onChange={(a) => updateBlockAdvanced(block.id, a)} />
        )}
      </ScrollArea>
    </div>
  )
}
