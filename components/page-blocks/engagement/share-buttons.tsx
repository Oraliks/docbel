'use client'

import type { ElementType } from 'react'
import { z } from 'zod'
import {
  Mail,
  MessageCircle,
  Copy,
  Share2,
  Send,
  ThumbsUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const PLATFORMS = ['twitter', 'linkedin', 'facebook', 'email', 'whatsapp', 'copy'] as const

const schema = z.object({
  platforms: z.array(z.enum(PLATFORMS)),
  align: z.enum(['left', 'center', 'right']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  utmCampaign: z.string().max(120).optional(),
})

type Props = z.infer<typeof schema>

const SIZES = {
  sm: 'size-8 [&_svg]:size-3.5',
  md: 'size-9 [&_svg]:size-4',
  lg: 'size-10 [&_svg]:size-5',
} as const

const STYLES: Record<(typeof PLATFORMS)[number], { bg: string; label: string; Icon: ElementType }> = {
  twitter: { bg: 'bg-black hover:bg-zinc-800 text-white', label: 'X / Twitter', Icon: Share2 },
  linkedin: { bg: 'bg-[#0A66C2] hover:opacity-90 text-white', label: 'LinkedIn', Icon: ThumbsUp },
  facebook: { bg: 'bg-[#1877F2] hover:opacity-90 text-white', label: 'Facebook', Icon: Send },
  email: { bg: 'bg-zinc-700 hover:bg-zinc-600 text-white', label: 'Email', Icon: Mail },
  whatsapp: {
    bg: 'bg-[#25D366] hover:opacity-90 text-white',
    label: 'WhatsApp',
    Icon: MessageCircle,
  },
  copy: {
    bg: 'bg-zinc-200 hover:bg-zinc-300 text-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-white',
    label: 'Copier le lien',
    Icon: Copy,
  },
}

export const shareButtons = defineBlock({
  type: 'shareButtons',
  schema,
  defaults: {
    platforms: ['twitter', 'linkedin', 'facebook', 'email', 'copy'],
    align: 'left',
    size: 'md',
  },
  meta: {
    name: 'Partager',
    description: 'Boutons de partage social',
    category: 'engagement',
    icon: 'arrow-up-right',
    shortcuts: ['share', 'partager'],
  },
  Render: ({ props }) => {
    const { platforms, align = 'left', size = 'md', utmCampaign } = props
    const handleShare = (platform: string) => {
      if (typeof window === 'undefined') return
      const baseUrl = window.location.href
      let url = baseUrl
      if (utmCampaign) {
        try {
          const u = new URL(baseUrl)
          u.searchParams.set('utm_source', platform)
          u.searchParams.set('utm_medium', 'social')
          u.searchParams.set('utm_campaign', utmCampaign)
          url = u.toString()
        } catch {}
      }
      const title = document.title
      let target = ''
      switch (platform) {
        case 'twitter':
          target = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
          break
        case 'linkedin':
          target = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
          break
        case 'facebook':
          target = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
          break
        case 'email':
          target = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`
          break
        case 'whatsapp':
          target = `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`
          break
        case 'copy':
          navigator.clipboard?.writeText(url).then(
            () => toast.success('Lien copié'),
            () => toast.error('Erreur copie')
          )
          return
      }
      if (target) window.open(target, '_blank', 'noopener,noreferrer')
    }

    return (
      <div
        className={cn(
          'flex flex-wrap gap-2 my-2',
          align === 'center' && 'justify-center',
          align === 'right' && 'justify-end'
        )}
      >
        {platforms.map((p) => {
          const cfg = STYLES[p]
          if (!cfg) return null
          const { Icon } = cfg
          return (
            <button
              key={p}
              type="button"
              onClick={() => handleShare(p)}
              title={cfg.label}
              className={cn(
                'inline-flex items-center justify-center rounded-full transition',
                SIZES[size],
                cfg.bg
              )}
            >
              <Icon />
            </button>
          )
        })}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Réglages" defaultOpen>
      <Field label="Plateformes">
        <div className="grid grid-cols-2 gap-1.5">
          {PLATFORMS.map((p) => {
            const active = props.platforms.includes(p)
            return (
              <button
                key={p}
                type="button"
                onClick={() =>
                  onChange({
                    platforms: active
                      ? props.platforms.filter((x) => x !== p)
                      : [...props.platforms, p],
                  })
                }
                className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${active ? 'border-primary bg-primary/10 text-primary' : 'border-input'}`}
              >
                {p}
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="Alignement">
        <Pills
          value={props.align ?? 'left'}
          onChange={(v) => onChange({ align: v as Props['align'] })}
          options={[
            { value: 'left', label: 'Gauche' },
            { value: 'center', label: 'Centre' },
            { value: 'right', label: 'Droite' },
          ]}
        />
      </Field>
      <Field label="Taille">
        <Pills
          value={props.size ?? 'md'}
          onChange={(v) => onChange({ size: v as Props['size'] })}
          options={[
            { value: 'sm', label: 'Sm' },
            { value: 'md', label: 'Md' },
            { value: 'lg', label: 'Lg' },
          ]}
        />
      </Field>
      <Field label="UTM Campaign (optionnel)">
        <Input
          value={props.utmCampaign ?? ''}
          onChange={(e) => onChange({ utmCampaign: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
