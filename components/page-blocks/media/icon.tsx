'use client'

import React from 'react'
import { z } from 'zod'
import {
  Star, Heart, Check, X, Info, Lock, Mail, Phone, MapPin, Calendar, Clock,
  User, Users, Home, Search, Settings, Download, Upload, Link as LinkIcon,
  ExternalLink, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ChevronRight,
  ChevronDown, Plus, Minus, FileText, Folder, Image as ImageIcon, Video,
  Play, Pause, Bell, Bookmark, Tag, Gift, Zap, Sparkles, ThumbsUp,
  MessageCircle, Send, Globe, Briefcase, GraduationCap, Euro, CreditCard,
  TrendingUp, Award, Target, Rocket, Lightbulb,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Field,
  Group,
  Pills,
  ColorControl,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { iconSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const ICONS: Record<string, LucideIcon> = {
  star: Star, heart: Heart, check: Check, x: X, info: Info, lock: Lock,
  mail: Mail, phone: Phone, 'map-pin': MapPin, calendar: Calendar, clock: Clock,
  user: User, users: Users, home: Home, search: Search, settings: Settings,
  download: Download, upload: Upload, link: LinkIcon, 'external-link': ExternalLink,
  'arrow-right': ArrowRight, 'arrow-left': ArrowLeft, 'arrow-up': ArrowUp,
  'arrow-down': ArrowDown, 'chevron-right': ChevronRight, 'chevron-down': ChevronDown,
  plus: Plus, minus: Minus, file: FileText, folder: Folder, image: ImageIcon,
  video: Video, play: Play, pause: Pause, bell: Bell, bookmark: Bookmark, tag: Tag,
  gift: Gift, zap: Zap, sparkles: Sparkles, 'thumbs-up': ThumbsUp,
  message: MessageCircle, send: Send, globe: Globe, briefcase: Briefcase,
  'graduation-cap': GraduationCap, euro: Euro, 'credit-card': CreditCard,
  'trending-up': TrendingUp, award: Award, target: Target, rocket: Rocket,
  lightbulb: Lightbulb,
}

export const icon = defineBlock({
  type: 'icon',
  schema,
  defaults: { name: 'star', size: 48, strokeWidth: 2, align: 'center' },
  meta: {
    name: 'Icône',
    description: 'Icône vectorielle (Lucide)',
    category: 'media',
    icon: 'sparkles',
    shortcuts: ['icon', 'icone', 'pictogramme'],
  },
  Render: ({ props }) => {
    const { name = 'star', size = 48, color, strokeWidth = 2, align = 'center' } = props
    const Icon = ICONS[name] ?? Star
    const justifyContent =
      align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'
    return (
      <div style={{ display: 'flex', justifyContent }}>
        <Icon size={size} color={color || undefined} strokeWidth={strokeWidth} />
      </div>
    )
  },
  Fields: ({ props, onChange }) => {
    const [q, setQ] = React.useState('')
    const entries = Object.entries(ICONS).filter(([k]) =>
      k.includes(q.toLowerCase().trim())
    )
    return (
      <>
        <Group title="Icône" defaultOpen>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une icône…"
            className="mb-2 h-8 text-xs"
          />
          <div className="grid max-h-52 grid-cols-6 gap-1 overflow-y-auto pr-1">
            {entries.map(([k, I]) => (
              <button
                key={k}
                type="button"
                title={k}
                onClick={() => onChange({ name: k })}
                className={cn(
                  'flex items-center justify-center rounded-md border p-2 transition',
                  props.name === k
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent hover:border-border'
                )}
              >
                <I className="size-4" />
              </button>
            ))}
            {entries.length === 0 && (
              <p className="col-span-6 py-3 text-center text-xs text-muted-foreground">
                Aucune icône
              </p>
            )}
          </div>
        </Group>
        <Group title="Style">
          <Field label="Taille">
            <SliderControl
              value={props.size ?? 48}
              onChange={(v) => onChange({ size: v })}
              min={16}
              max={160}
              suffix="px"
            />
          </Field>
          <Field label="Couleur">
            <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
          </Field>
          <Field label="Épaisseur du trait">
            <SliderControl
              value={props.strokeWidth ?? 2}
              onChange={(v) => onChange({ strokeWidth: v })}
              min={1}
              max={4}
              step={0.5}
            />
          </Field>
          <Field label="Alignement">
            <Pills
              value={props.align ?? 'center'}
              onChange={(v) => onChange({ align: v as Props['align'] })}
              options={[
                { value: 'left', label: 'Gauche' },
                { value: 'center', label: 'Centre' },
                { value: 'right', label: 'Droite' },
              ]}
            />
          </Field>
        </Group>
      </>
    )
  },
})
