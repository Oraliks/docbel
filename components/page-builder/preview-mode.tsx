'use client'

import React from 'react'
import { X, Monitor, Tablet, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Pills } from './inspector/controls'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import { BlockRenderer } from './block-renderer'
import { cn } from '@/lib/utils'

const DEVICE_WIDTH = { desktop: 1280, tablet: 768, mobile: 390 } as const

export function PreviewMode() {
  const enabled = usePageBuilderStore((s) => s.previewMode)
  const setPreviewMode = usePageBuilderStore((s) => s.setPreviewMode)
  const blocks = usePageBuilderStore((s) => s.blocks)
  const device = usePageBuilderStore((s) => s.device)
  const setDevice = usePageBuilderStore((s) => s.setDevice)

  React.useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, setPreviewMode])

  if (!enabled) return null

  const isDesktop = device === 'desktop'
  const targetWidth = DEVICE_WIDTH[device]

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-in fade-in-0 duration-200">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-card/80 backdrop-blur">
        <div className="text-sm font-semibold">Aperçu plein écran</div>
        <div className="flex items-center gap-2">
          <Pills
            value={device}
            onChange={setDevice}
            options={[
              { value: 'desktop', label: <Monitor className="size-3.5" /> },
              { value: 'tablet', label: <Tablet className="size-3.5" /> },
              { value: 'mobile', label: <Smartphone className="size-3.5" /> },
            ]}
            className="w-auto min-w-[180px]"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPreviewMode(false)}
            className="gap-1.5"
          >
            <X className="size-3.5" />
            Quitter (Esc)
          </Button>
        </div>
      </div>

      {/* Preview content */}
      <div className="absolute inset-0 pt-16 overflow-auto">
        <div className="min-h-full flex justify-center py-8 px-4">
          <div
            className={cn(
              'w-full transition-all duration-300',
              !isDesktop && 'shadow-2xl rounded-2xl border bg-background overflow-hidden'
            )}
            style={{ maxWidth: isDesktop ? '1280px' : `${targetWidth}px` }}
          >
            {blocks.length === 0 ? (
              <div className="py-32 text-center text-muted-foreground">
                Page vide
              </div>
            ) : (
              blocks.map((block) => (
                <BlockRenderer key={block.id} block={block} device={device} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
