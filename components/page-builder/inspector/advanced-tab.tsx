'use client'

import React from 'react'
import type { BlockProps, BlockAdvanced } from '@/lib/page-builder/types'
import { Field, Group, SliderControl } from './controls'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Wand2 } from 'lucide-react'

interface AdvancedTabProps {
  block: BlockProps
  onChange: (advanced: Partial<BlockAdvanced>) => void
}

export function AdvancedTab({ block, onChange }: AdvancedTabProps) {
  const adv = block.advanced ?? {}
  return (
    <div>
      <Group title="Identifiants" defaultOpen>
        <Field label="ID HTML" hint="Pour les ancres ou ciblage CSS">
          <Input
            value={adv.htmlId ?? ''}
            onChange={(e) => onChange({ htmlId: e.target.value || undefined })}
            placeholder="mon-bloc"
            className="h-8 font-mono text-xs"
          />
        </Field>
        <Field label="Classes CSS">
          <Input
            value={adv.className ?? ''}
            onChange={(e) => onChange({ className: e.target.value || undefined })}
            placeholder="ma-classe"
            className="h-8 font-mono text-xs"
          />
        </Field>
        <Field label="Ancre" hint="Lien direct vers ce bloc : ?#ancre">
          <Input
            value={adv.anchor ?? ''}
            onChange={(e) => onChange({ anchor: e.target.value || undefined })}
            placeholder="ancre"
            className="h-8 font-mono text-xs"
          />
        </Field>
      </Group>

      <Group title="Animation d'apparition">
        <Field label="Type d'animation">
          <Select
            value={adv.animation ?? 'none'}
            onValueChange={(v) => onChange({ animation: v as BlockAdvanced['animation'] })}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune</SelectItem>
              <SelectItem value="fade-in">Apparition (fondu)</SelectItem>
              <SelectItem value="fade-up">Fondu vers le haut</SelectItem>
              <SelectItem value="fade-down">Fondu vers le bas</SelectItem>
              <SelectItem value="slide-left">Glisse de la droite</SelectItem>
              <SelectItem value="slide-right">Glisse de la gauche</SelectItem>
              <SelectItem value="zoom-in">Zoom avant</SelectItem>
              <SelectItem value="zoom-out">Zoom arrière</SelectItem>
              <SelectItem value="pulse">Pulsation (continu)</SelectItem>
              <SelectItem value="bounce">Rebond (continu)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {adv.animation && adv.animation !== 'none' && (
          <>
            <div className="flex items-center justify-between gap-4 py-1">
              <Label className="text-xs text-muted-foreground flex-1">
                Déclencher au scroll
              </Label>
              <Switch
                checked={adv.animateOnScroll ?? false}
                onCheckedChange={(v) => onChange({ animateOnScroll: v })}
              />
            </div>
            <Field label="Délai (ms)">
              <SliderControl
                value={adv.animationDelay ?? 0}
                onChange={(v) => onChange({ animationDelay: v })}
                min={0}
                max={2000}
                step={50}
                suffix="ms"
              />
            </Field>
          </>
        )}
      </Group>

      <Group title="Affichage conditionnel">
        <Field label="Visible si" hint="Contrôle qui voit ce bloc côté public">
          <Select
            value={adv.showIf ?? 'always'}
            onValueChange={(v) => onChange({ showIf: v as BlockAdvanced['showIf'] })}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">Toujours</SelectItem>
              <SelectItem value="loggedIn">Utilisateur connecté</SelectItem>
              <SelectItem value="loggedOut">Utilisateur déconnecté</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Group>

      {(block.type === 'cta' || block.type === 'buttonGroup' || block.type === 'hero') && (
        <Group title="UTM (tracking)">
          <UTMHelper
            currentLink={getPrimaryLink(block)}
            onApply={(newLink) => {
              // Stamp the link onto whatever field this block uses; surfaced via the
              // 'link', 'ctaLink' or first item.link field via toast — we let the
              // user paste it themselves to avoid surprises.
              navigator.clipboard?.writeText(newLink).catch(() => {})
              toast.success('Lien UTM copié dans le presse-papiers')
            }}
          />
        </Group>
      )}
    </div>
  )
}

function getPrimaryLink(block: BlockProps): string {
  const p = block.props as Record<string, unknown>
  if (typeof p.link === 'string') return p.link
  if (typeof p.ctaLink === 'string') return p.ctaLink
  if (Array.isArray(p.items) && p.items.length > 0 && typeof (p.items[0] as { link?: string }).link === 'string') {
    return (p.items[0] as { link: string }).link
  }
  return ''
}

function UTMHelper({
  currentLink,
  onApply,
}: {
  currentLink: string
  onApply: (link: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [source, setSource] = React.useState('newsletter')
  const [medium, setMedium] = React.useState('email')
  const [campaign, setCampaign] = React.useState('')
  const [content, setContent] = React.useState('')

  const buildUrl = () => {
    const trimmed = currentLink.trim()
    if (!trimmed || trimmed === '#') return ''
    try {
      const base = trimmed.startsWith('http') ? trimmed : `${window.location.origin}${trimmed}`
      const u = new URL(base)
      if (source) u.searchParams.set('utm_source', source)
      if (medium) u.searchParams.set('utm_medium', medium)
      if (campaign) u.searchParams.set('utm_campaign', campaign)
      if (content) u.searchParams.set('utm_content', content)
      return u.toString()
    } catch {
      return ''
    }
  }

  const built = buildUrl()

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        <Wand2 className="size-3 mr-1.5" />
        Construire un lien UTM
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Construire un lien UTM</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Lien de base">
              <Input value={currentLink} disabled className="font-mono text-xs" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="utm_source">
                <Input value={source} onChange={(e) => setSource(e.target.value)} />
              </Field>
              <Field label="utm_medium">
                <Input value={medium} onChange={(e) => setMedium(e.target.value)} />
              </Field>
              <Field label="utm_campaign">
                <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} />
              </Field>
              <Field label="utm_content">
                <Input value={content} onChange={(e) => setContent(e.target.value)} />
              </Field>
            </div>
            <Field label="Résultat">
              <Input value={built} readOnly className="font-mono text-xs" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!built}
              onClick={() => {
                onApply(built)
                setOpen(false)
              }}
            >
              Copier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
