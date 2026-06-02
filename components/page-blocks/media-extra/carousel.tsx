'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Field,
  Group,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { carouselSlideSchema as slideSchema, carouselSchema as schema } from './schemas'

type Slide = z.infer<typeof slideSchema>

export const carousel = defineBlock({
  type: 'carousel',
  schema,
  defaults: {
    slides: [
      { image: '', alt: 'Slide 1', caption: '' },
      { image: '', alt: 'Slide 2', caption: '' },
      { image: '', alt: 'Slide 3', caption: '' },
    ],
    autoplay: false,
    interval: 5000,
    showDots: true,
    showArrows: true,
  },
  meta: {
    name: 'Carrousel',
    description: 'Slideshow d\'images',
    category: 'media',
    icon: 'images',
    shortcuts: ['carousel', 'slideshow'],
  },
  Render: ({ props }) => {
    const { slides, autoplay, interval = 5000, showDots = true, showArrows = true } = props
    const [active, setActive] = useState(0)

    useEffect(() => {
      if (!autoplay || slides.length <= 1) return
      const t = setInterval(() => {
        setActive((a) => (a + 1) % slides.length)
      }, interval)
      return () => clearInterval(t)
    }, [autoplay, interval, slides.length])

    if (slides.length === 0) {
      return (
        <div className="aspect-video rounded-lg border border-dashed bg-muted flex items-center justify-center text-muted-foreground">
          Carousel vide
        </div>
      )
    }

    const slide = slides[active]
    return (
      <div className="relative w-full overflow-hidden rounded-2xl bg-muted my-2">
        <div className="aspect-video">
          {slide.image ? (
            <img src={slide.image} alt={slide.alt || ''} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-muted" />
          )}
        </div>
        {slide.caption && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
            {slide.caption}
          </div>
        )}
        {showArrows && slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActive((a) => (a - 1 + slides.length) % slides.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur flex items-center justify-center transition"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setActive((a) => (a + 1) % slides.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur flex items-center justify-center transition"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
        {showDots && slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === active ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        )}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Comportement" defaultOpen>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Lecture auto" className="flex-1">
            <span className="sr-only">autoplay</span>
          </Field>
          <Switch
            checked={props.autoplay ?? false}
            onCheckedChange={(v) => onChange({ autoplay: v })}
          />
        </div>
        {props.autoplay && (
          <Field label="Intervalle (ms)">
            <SliderControl
              value={props.interval ?? 5000}
              onChange={(v) => onChange({ interval: v })}
              min={2000}
              max={15000}
              step={500}
              suffix="ms"
            />
          </Field>
        )}
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Points de navigation" className="flex-1">
            <span className="sr-only">dots</span>
          </Field>
          <Switch
            checked={props.showDots ?? true}
            onCheckedChange={(v) => onChange({ showDots: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Flèches" className="flex-1">
            <span className="sr-only">arrows</span>
          </Field>
          <Switch
            checked={props.showArrows ?? true}
            onCheckedChange={(v) => onChange({ showArrows: v })}
          />
        </div>
      </Group>
      <Group title={`Slides (${props.slides.length})`} defaultOpen>
        <RepeaterList<Slide>
          items={props.slides}
          onChange={(slides) => onChange({ slides })}
          render={(item, set) => (
            <>
              <ImageUpload value={item.image} onChange={(url) => set({ image: url })} compact />
              <Input
                value={item.alt ?? ''}
                onChange={(e) => set({ alt: e.target.value })}
                placeholder="Alt"
                className="h-8 text-xs"
              />
              <Input
                value={item.caption ?? ''}
                onChange={(e) => set({ caption: e.target.value })}
                placeholder="Légende"
                className="h-8 text-xs"
              />
              <Input
                value={item.link ?? ''}
                onChange={(e) => set({ link: e.target.value })}
                placeholder="Lien (optionnel)"
                className="h-8 text-xs"
              />
            </>
          )}
          addItem={() => ({ image: '', alt: 'Nouvelle slide', caption: '' })}
        />
      </Group>
    </>
  ),
})
