'use client'

import React from 'react'
import {
  Heading,
  Type,
  Quote,
  Minus,
  ArrowUpDown,
  Image,
  Video,
  Images,
  Code,
  Square,
  Box,
  Columns3,
  Sparkles,
  Grid2x2,
  MousePointerClick,
  HelpCircle,
  MessageSquareQuote,
  BarChart3,
  Undo2,
  Redo2,
  Eye,
  Plus,
  Copy,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  BLOCKS_BY_CATEGORY,
  BLOCK_CATEGORY_LABELS,
} from '@/lib/page-builder/registry'
import type { BlockCategory } from '@/lib/page-builder/types'
import { usePageBuilderStore } from '@/lib/page-builder/store'

// Maps the registry `icon` string to a Lucide component (same set as block-picker).
const ICON_MAP: Record<string, LucideIcon> = {
  heading: Heading,
  type: Type,
  quote: Quote,
  minus: Minus,
  'arrow-up-down': ArrowUpDown,
  image: Image,
  video: Video,
  images: Images,
  code: Code,
  square: Square,
  box: Box,
  'columns-3': Columns3,
  sparkles: Sparkles,
  'grid-2x2': Grid2x2,
  'mouse-pointer-click': MousePointerClick,
  'help-circle': HelpCircle,
  'message-square-quote': MessageSquareQuote,
  'bar-chart-3': BarChart3,
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const addBlock = usePageBuilderStore((s) => s.addBlock)
  const openPicker = usePageBuilderStore((s) => s.openPicker)
  const undo = usePageBuilderStore((s) => s.undo)
  const redo = usePageBuilderStore((s) => s.redo)
  const togglePreviewMode = usePageBuilderStore((s) => s.togglePreviewMode)
  const duplicateBlock = usePageBuilderStore((s) => s.duplicateBlock)
  const removeBlock = usePageBuilderStore((s) => s.removeBlock)
  const selectedBlockId = usePageBuilderStore((s) => s.selectedBlockId)

  // Close the palette, then run the action (avoids the dialog stealing focus mid-action).
  const run = (action: () => void) => {
    onOpenChange(false)
    action()
  }

  // Order categories the same way block-picker does, falling back to the rest.
  const categories = React.useMemo(() => {
    const ordered: BlockCategory[] = [
      'text',
      'media',
      'layout',
      'marketing',
      'ui',
      'charts',
      'engagement',
      'navigation',
      'editorial',
      'docbel',
      'utility',
      'decorative',
      'education',
    ]
    return ordered.filter((cat) => BLOCKS_BY_CATEGORY[cat]?.length)
  }, [])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Palette de commandes"
      description="Insérer un bloc ou exécuter une action"
    >
      <Command>
        <CommandInput placeholder="Insérer un bloc, exécuter une action…" />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>

          <CommandGroup heading="Actions">
            <CommandItem
              value="annuler undo"
              onSelect={() => run(undo)}
            >
              <Undo2 />
              <span className="flex-1">Annuler</span>
              <CommandShortcut>⌘Z</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="rétablir redo"
              onSelect={() => run(redo)}
            >
              <Redo2 />
              <span className="flex-1">Rétablir</span>
              <CommandShortcut>⌘⇧Z</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="aperçu plein écran preview"
              onSelect={() => run(togglePreviewMode)}
            >
              <Eye />
              <span className="flex-1">Aperçu plein écran</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="insérer un bloc picker"
              onSelect={() => run(() => openPicker(selectedBlockId))}
            >
              <Plus />
              <span className="flex-1">Insérer un bloc…</span>
              <CommandShortcut>⌘/</CommandShortcut>
            </CommandItem>
            {selectedBlockId && (
              <>
                <CommandItem
                  value="dupliquer le bloc"
                  onSelect={() => run(() => duplicateBlock(selectedBlockId))}
                >
                  <Copy />
                  <span className="flex-1">Dupliquer</span>
                  <CommandShortcut>⌘D</CommandShortcut>
                </CommandItem>
                <CommandItem
                  value="supprimer le bloc"
                  onSelect={() => run(() => removeBlock(selectedBlockId))}
                >
                  <Trash2 />
                  <span className="flex-1">Supprimer</span>
                  <CommandShortcut>⌫</CommandShortcut>
                </CommandItem>
              </>
            )}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Insérer un bloc">
            {categories.map((cat) =>
              BLOCKS_BY_CATEGORY[cat].map((entry) => {
                const Icon = ICON_MAP[entry.icon] ?? Box
                return (
                  <CommandItem
                    key={entry.type}
                    value={`${entry.name} ${entry.description} ${entry.type}`}
                    onSelect={() =>
                      run(() => addBlock(entry.type, { insertAfter: selectedBlockId }))
                    }
                  >
                    <Icon />
                    <span className="flex-1 truncate">{entry.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {BLOCK_CATEGORY_LABELS[cat]}
                    </span>
                  </CommandItem>
                )
              })
            )}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
