// =====================================================================
//  BlockWrapper — pointer-interaction hooks (canvas editor).
//  Extracted verbatim from block-wrapper.tsx so the wrapper component
//  stays focused on layout/menus. Behaviour is unchanged.
// =====================================================================

import React from 'react'
import type { BlockLayout, DeviceType } from '@/lib/page-builder/types'

interface ResizeParams {
  canResize: boolean
  blockId: string
  wrapperRef: React.RefObject<HTMLDivElement | null>
  innerRef: React.RefObject<HTMLDivElement | null>
  width: string | undefined
  align: string | undefined
  device: DeviceType
  pushHistoryCheckpoint: () => void
  updateBlockLayoutLive: (id: string, layout: Partial<BlockLayout>) => void
}

/**
 * Right-edge width resize handle for simple (non-container) blocks.
 * Tracks the handle's X position (measured from the rendered block) and a
 * live width percentage while dragging, snapping to common fractions.
 */
export function useBlockResize({
  canResize,
  blockId,
  wrapperRef,
  innerRef,
  width,
  align,
  device,
  pushHistoryCheckpoint,
  updateBlockLayoutLive,
}: ResizeParams) {
  const [handleX, setHandleX] = React.useState<number | null>(null)
  const [liveWidthPct, setLiveWidthPct] = React.useState<number | null>(null)
  const resizeStart = React.useRef<{ availPx: number; wrapLeft: number } | null>(null)

  React.useLayoutEffect(() => {
    if (!canResize) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHandleX(null)
      return
    }
    const measure = () => {
      const wrap = wrapperRef.current
      const inner = innerRef.current?.firstElementChild as HTMLElement | null
      if (!wrap || !inner) return
      const wrapRect = wrap.getBoundingClientRect()
      const blockRect = inner.getBoundingClientRect()
      setHandleX(blockRect.right - wrapRect.left)
    }
    measure()
    const wrap = wrapperRef.current
    if (!wrap || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [canResize, width, align, device, wrapperRef, innerRef])

  function onResizePointerDown(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const wrap = wrapperRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    resizeStart.current = { availPx: rect.width, wrapLeft: rect.left }
    pushHistoryCheckpoint()
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }
  function onResizePointerMove(e: React.PointerEvent) {
    const start = resizeStart.current
    if (!start) return
    let pct = Math.round(((e.clientX - start.wrapLeft) / start.availPx) * 100)
    pct = Math.max(10, Math.min(100, pct))
    for (const snap of [25, 33, 50, 66, 75, 100]) {
      if (Math.abs(pct - snap) <= 2) {
        pct = snap
        break
      }
    }
    setLiveWidthPct(pct)
    updateBlockLayoutLive(blockId, {
      width: pct >= 100 ? '100%' : `${pct}%`,
      align: 'left',
    })
  }
  function onResizePointerUp(e: React.PointerEvent) {
    if (!resizeStart.current) return
    resizeStart.current = null
    setLiveWidthPct(null)
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  return { handleX, liveWidthPct, onResizePointerDown, onResizePointerMove, onResizePointerUp }
}

interface FreeMoveParams {
  freeAbsolute: boolean
  isLocked: boolean
  blockId: string
  left: number | undefined
  top: number | undefined
  pushHistoryCheckpoint: () => void
  updateBlockLayoutLive: (id: string, layout: Partial<BlockLayout>) => void
}

/**
 * Drag-to-move for free (absolute-positioned) blocks — mirrors the resize
 * handler. Snaps to an 8px grid and pushes a single undo step per drag.
 */
export function useBlockFreeMove({
  freeAbsolute,
  isLocked,
  blockId,
  left,
  top,
  pushHistoryCheckpoint,
  updateBlockLayoutLive,
}: FreeMoveParams) {
  const moveStart = React.useRef<{
    x: number
    y: number
    left: number
    top: number
    moved: boolean
  } | null>(null)
  const [movePos, setMovePos] = React.useState<{ left: number; top: number } | null>(null)

  function onMovePointerDown(e: React.PointerEvent) {
    if (!freeAbsolute || isLocked) return
    // Only when pressing the block body itself (overlay controls are children).
    if (e.target !== e.currentTarget) return
    moveStart.current = {
      x: e.clientX,
      y: e.clientY,
      left: left ?? 0,
      top: top ?? 0,
      moved: false,
    }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }
  function onMovePointerMove(e: React.PointerEvent) {
    const s = moveStart.current
    if (!s) return
    if (!s.moved) {
      if (Math.abs(e.clientX - s.x) < 3 && Math.abs(e.clientY - s.y) < 3) return
      s.moved = true
      pushHistoryCheckpoint() // one undo step per drag, only once movement starts
    }
    // Snap to an 8px grid for tidy alignment.
    const nextLeft = Math.max(0, Math.round((s.left + (e.clientX - s.x)) / 8) * 8)
    const nextTop = Math.max(0, Math.round((s.top + (e.clientY - s.y)) / 8) * 8)
    setMovePos({ left: nextLeft, top: nextTop })
    updateBlockLayoutLive(blockId, { left: nextLeft, top: nextTop })
  }
  function onMovePointerUp(e: React.PointerEvent) {
    if (!moveStart.current) return
    moveStart.current = null
    setMovePos(null)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  return { movePos, onMovePointerDown, onMovePointerMove, onMovePointerUp }
}
