'use client'

import React from 'react'
import { Outline } from './outline'
import { Canvas } from './canvas'
import { Inspector } from './inspector/inspector'
import { BlockPicker } from './block-picker'
import { CommandPalette } from './command-palette'
import { PreviewMode } from './preview-mode'
import { usePageBuilderStore } from '@/lib/page-builder/store'

export function Editor() {
  const [cmdkOpen, setCmdkOpen] = React.useState(false)
  const previewMode = usePageBuilderStore((s) => s.previewMode)
  const openPicker = usePageBuilderStore((s) => s.openPicker)
  const togglePreviewMode = usePageBuilderStore((s) => s.togglePreviewMode)
  const undo = usePageBuilderStore((s) => s.undo)
  const redo = usePageBuilderStore((s) => s.redo)
  const removeBlock = usePageBuilderStore((s) => s.removeBlock)
  const removeMany = usePageBuilderStore((s) => s.removeMany)
  const duplicateBlock = usePageBuilderStore((s) => s.duplicateBlock)
  const duplicateMany = usePageBuilderStore((s) => s.duplicateMany)
  const copyBlock = usePageBuilderStore((s) => s.copyBlock)
  const pasteBlock = usePageBuilderStore((s) => s.pasteBlock)
  const selectedBlockId = usePageBuilderStore((s) => s.selectedBlockId)
  const selectedIds = usePageBuilderStore((s) => s.selectedIds)
  const selectMany = usePageBuilderStore((s) => s.selectMany)
  const clearSelection = usePageBuilderStore((s) => s.clearSelection)
  const selectBlock = usePageBuilderStore((s) => s.selectBlock)
  const moveBlock = usePageBuilderStore((s) => s.moveBlock)
  const updateBlockLayoutLive = usePageBuilderStore((s) => s.updateBlockLayoutLive)
  const wrapInSection = usePageBuilderStore((s) => s.wrapInSection)
  const blocks = usePageBuilderStore((s) => s.blocks)

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const editing =
        tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable
      const meta = e.ctrlKey || e.metaKey

      // ⌘K → command palette
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdkOpen(true)
        return
      }
      // ⌘/  → block picker
      if (meta && e.key === '/') {
        e.preventDefault()
        openPicker(selectedBlockId)
        return
      }
      // ⌘P → preview
      if (meta && e.key.toLowerCase() === 'p' && !editing) {
        e.preventDefault()
        togglePreviewMode()
        return
      }
      // ⌘Z / ⌘⇧Z
      if (meta && e.key.toLowerCase() === 'z') {
        if (editing) return
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (meta && e.key.toLowerCase() === 'y') {
        if (editing) return
        e.preventDefault()
        redo()
        return
      }
      // ⌘A → select all top-level blocks
      if (meta && e.key.toLowerCase() === 'a' && !editing) {
        e.preventDefault()
        const rootIds = blocks.filter((b) => !b.parentId).map((b) => b.id)
        selectMany(rootIds)
        return
      }

      // Selection-dependent shortcuts
      if (!selectedBlockId || editing) return

      const hasMulti = selectedIds.length > 1
      const sel = blocks.find((b) => b.id === selectedBlockId)
      const isAbsolute = !!sel?.layout?.absolute

      // ⌘] / ⌘[ → z-index avant/arrière
      if (meta && (e.key === ']' || e.key === '[')) {
        e.preventDefault()
        const z = sel?.layout?.zIndex ?? 0
        updateBlockLayoutLive(selectedBlockId, {
          zIndex: e.key === ']' ? z + 1 : Math.max(0, z - 1),
        })
        return
      }

      // Flèches → nudge des blocs en position absolue (1px, 10px avec ⇧)
      if (
        isAbsolute &&
        !e.altKey &&
        !meta &&
        (e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight')
      ) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const left = sel?.layout?.left ?? 0
        const top = sel?.layout?.top ?? 0
        if (e.key === 'ArrowLeft')
          updateBlockLayoutLive(selectedBlockId, { left: Math.max(0, left - step) })
        else if (e.key === 'ArrowRight')
          updateBlockLayoutLive(selectedBlockId, { left: left + step })
        else if (e.key === 'ArrowUp')
          updateBlockLayoutLive(selectedBlockId, { top: Math.max(0, top - step) })
        else updateBlockLayoutLive(selectedBlockId, { top: top + step })
        return
      }

      // ⌘G → wrap selection in a section
      if (meta && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        wrapInSection(hasMulti ? selectedIds : [selectedBlockId])
        return
      }

      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (hasMulti) duplicateMany(selectedIds)
        else duplicateBlock(selectedBlockId)
        return
      }
      if (meta && e.key.toLowerCase() === 'c') {
        copyBlock(selectedBlockId)
        return
      }
      if (meta && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        copyBlock(selectedBlockId)
        removeBlock(selectedBlockId)
        return
      }
      if (meta && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        pasteBlock(selectedBlockId)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (hasMulti) removeMany(selectedIds)
        else removeBlock(selectedBlockId)
        return
      }
      if (e.key === 'ArrowUp' && e.altKey) {
        e.preventDefault()
        moveBlock(selectedBlockId, 'up')
        return
      }
      if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault()
        moveBlock(selectedBlockId, 'down')
        return
      }
      if (e.key === 'Escape') {
        clearSelection()
        return
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const idx = blocks.findIndex((b) => b.id === selectedBlockId)
        if (idx === -1) return
        const next = e.key === 'ArrowUp' ? idx - 1 : idx + 1
        if (next >= 0 && next < blocks.length) selectBlock(blocks[next].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    blocks,
    clearSelection,
    copyBlock,
    duplicateBlock,
    duplicateMany,
    moveBlock,
    updateBlockLayoutLive,
    openPicker,
    pasteBlock,
    redo,
    removeBlock,
    removeMany,
    selectBlock,
    selectMany,
    selectedBlockId,
    selectedIds,
    togglePreviewMode,
    undo,
    wrapInSection,
  ])

  if (previewMode) {
    return <PreviewMode />
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-muted/20">
      {/* Left: Outline */}
      <aside className="w-60 border-r bg-card shrink-0">
        <Outline />
      </aside>

      {/* Center: Canvas */}
      <Canvas />

      {/* Right: Inspector */}
      <aside className="w-[340px] border-l bg-card shrink-0 overflow-hidden">
        <Inspector />
      </aside>

      {/* Floating overlays */}
      <BlockPicker />
      <CommandPalette open={cmdkOpen} onOpenChange={setCmdkOpen} />
    </div>
  )
}
