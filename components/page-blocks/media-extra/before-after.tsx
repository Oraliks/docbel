'use client'

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { beforeAfterSchema as schema } from './schemas'

function BeforeImage({
  src,
  alt,
  containerRef,
}: {
  src: string
  alt: string
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(el.offsetWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover absolute inset-0"
      style={width ? { width: `${width}px` } : undefined}
      draggable={false}
    />
  )
}

export const beforeAfter = defineBlock({
  type: 'beforeAfter',
  schema,
  defaults: {
    beforeUrl: '',
    afterUrl: '',
    beforeLabel: 'Avant',
    afterLabel: 'Après',
    orientation: 'horizontal',
  },
  meta: {
    name: 'Avant / Après',
    description: 'Slider de comparaison d\'images',
    category: 'media',
    icon: 'columns-3',
    shortcuts: ['beforeafter', 'compare'],
  },
  Render: ({ props }) => {
    const { beforeUrl, afterUrl, beforeLabel = 'Avant', afterLabel = 'Après' } = props
    const [position, setPosition] = useState(50)
    const containerRef = useRef<HTMLDivElement>(null)
    const [dragging, setDragging] = useState(false)

    const updateFromEvent = useCallback((clientX: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const pct = ((clientX - rect.left) / rect.width) * 100
      setPosition(Math.max(0, Math.min(100, pct)))
    }, [])

    useEffect(() => {
      if (!dragging) return
      const onMove = (e: MouseEvent) => updateFromEvent(e.clientX)
      const onUp = () => setDragging(false)
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      return () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
    }, [dragging, updateFromEvent])

    if (!beforeUrl || !afterUrl) {
      return (
        <div className="aspect-video rounded-lg border border-dashed bg-muted flex items-center justify-center text-muted-foreground text-sm">
          Configurez les images «&nbsp;avant&nbsp;» et «&nbsp;après&nbsp;»
        </div>
      )
    }

    return (
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-2xl select-none cursor-ew-resize"
        onMouseDown={(e) => {
          setDragging(true)
          updateFromEvent(e.clientX)
        }}
      >
        <img src={afterUrl} alt={afterLabel} className="w-full block" draggable={false} />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
          <BeforeImage src={beforeUrl} alt={beforeLabel} containerRef={containerRef} />
        </div>
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-md pointer-events-none"
          style={{ left: `${position}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-9 rounded-full bg-white shadow-lg flex items-center justify-center">
            <ChevronLeft className="size-3 -mr-1" />
            <ChevronRight className="size-3 -ml-1" />
          </div>
        </div>
        <div className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white font-medium pointer-events-none">
          {beforeLabel}
        </div>
        <div className="absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white font-medium pointer-events-none">
          {afterLabel}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Images" defaultOpen>
      <Field label="Image avant">
        <ImageUpload value={props.beforeUrl} onChange={(url) => onChange({ beforeUrl: url })} />
      </Field>
      <Field label="Étiquette avant">
        <Input
          value={props.beforeLabel ?? ''}
          onChange={(e) => onChange({ beforeLabel: e.target.value })}
        />
      </Field>
      <Field label="Image après">
        <ImageUpload value={props.afterUrl} onChange={(url) => onChange({ afterUrl: url })} />
      </Field>
      <Field label="Étiquette après">
        <Input
          value={props.afterLabel ?? ''}
          onChange={(e) => onChange({ afterLabel: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
