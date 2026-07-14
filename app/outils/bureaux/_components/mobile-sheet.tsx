// app/outils/bureaux/_components/mobile-sheet.tsx
'use client'
import { useRef, useState, useCallback, type ReactNode } from 'react'

const SNAPS = [0.22, 0.55, 0.9] as const // peek / half / full (ratio de la hauteur parent)

export function MobileSheet({ children, header }: { children: ReactNode; header: ReactNode }) {
  const [ratio, setRatio] = useState<number>(SNAPS[1])
  const sheetRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startRatio: number } | null>(null)

  const parentH = () => sheetRef.current?.parentElement?.clientHeight ?? 800

  const onMove = useCallback((e: PointerEvent) => {
    if (!drag.current) return
    const dy = e.clientY - drag.current.startY
    const next = drag.current.startRatio - dy / parentH()
    setRatio(Math.max(0.12, Math.min(0.95, next)))
  }, [])

  const onUp = useCallback(() => {
    drag.current = null
    window.removeEventListener('pointermove', onMove)
    setRatio((r) => SNAPS.reduce((best, s) => (Math.abs(s - r) < Math.abs(best - r) ? s : best), SNAPS[1]))
  }, [onMove])

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      drag.current = { startY: e.clientY, startRatio: ratio }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp, { once: true })
    },
    [ratio, onMove, onUp],
  )

  return (
    <div
      ref={sheetRef}
      className="absolute left-0 right-0 bottom-0 z-20 bg-background rounded-t-3xl shadow-[0_-8px_30px_rgba(20,16,40,.16)] flex flex-col overflow-hidden motion-safe:transition-[height] motion-safe:duration-200"
      style={{ height: `${Math.round(ratio * 100)}%` }}
    >
      <div
        onPointerDown={onDown}
        className="flex-none pt-2.5 pb-2 cursor-grab touch-none flex flex-col items-center gap-2"
      >
        <span className="w-10 h-1.5 rounded-full bg-border" />
        {header}
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-5">{children}</div>
    </div>
  )
}
