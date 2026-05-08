'use client'

import React from 'react'
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Globe,
  History,
  Monitor,
  Palette,
  Redo2,
  Settings2,
  ShieldAlert,
  Smartphone,
  Tablet,
  Undo2,
  CircleCheck,
  CircleAlert,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Pills } from './inspector/controls'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import type { BlockProps, ImageProps, GalleryProps } from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

interface TopbarProps {
  title: string
  slug: string
  saveLabel: string
  isPublished: boolean
  isSaving: boolean
  isDirty: boolean
  onBack: () => void
  onTitleChange: (title: string) => void
  onTogglePreview: () => void
  onOpenSettings: () => void
  onOpenVersions: () => void
  onOpenTheme: () => void
  onTogglePublish: () => void
}

export function Topbar({
  title,
  slug,
  saveLabel,
  isPublished,
  isSaving,
  isDirty,
  onBack,
  onTitleChange,
  onTogglePreview,
  onOpenSettings,
  onOpenVersions,
  onOpenTheme,
  onTogglePublish,
}: TopbarProps) {
  const device = usePageBuilderStore((s) => s.device)
  const setDevice = usePageBuilderStore((s) => s.setDevice)
  const undo = usePageBuilderStore((s) => s.undo)
  const redo = usePageBuilderStore((s) => s.redo)
  const past = usePageBuilderStore((s) => s.past)
  const future = usePageBuilderStore((s) => s.future)
  const blocks = usePageBuilderStore((s) => s.blocks)
  const selectBlock = usePageBuilderStore((s) => s.selectBlock)

  const issues = React.useMemo(() => detectIssues(blocks), [blocks])

  return (
    <div className="border-b bg-card">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Left section */}
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon-sm" variant="ghost" onClick={onBack} title="Retour">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="h-6 w-px bg-border mx-1" />
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Titre de la page"
            className="h-8 w-64 border-transparent bg-transparent shadow-none px-2 text-sm font-semibold focus:bg-muted/50 focus:border-input"
          />
        </div>

        {/* Center section: device switcher */}
        <div className="flex-1 flex justify-center">
          <Pills
            value={device}
            onChange={setDevice}
            className="w-auto min-w-[200px]"
            options={[
              { value: 'desktop', label: <Monitor className="size-3.5" />, title: 'Desktop' },
              { value: 'tablet', label: <Tablet className="size-3.5" />, title: 'Tablette' },
              { value: 'mobile', label: <Smartphone className="size-3.5" />, title: 'Mobile' },
            ]}
          />
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1 shrink-0">
          <SaveStatus label={saveLabel} isSaving={isSaving} isDirty={isDirty} />

          <div className="h-6 w-px bg-border mx-1" />

          <Button
            size="icon-sm"
            variant="ghost"
            onClick={undo}
            disabled={past.length === 0}
            title="Annuler (⌘Z)"
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={redo}
            disabled={future.length === 0}
            title="Rétablir (⌘⇧Z)"
          >
            <Redo2 className="size-4" />
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          {issues.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="relative text-amber-500 hover:text-amber-500"
                  title={`${issues.length} problème(s) d'accessibilité`}
                >
                  <ShieldAlert className="size-4" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-semibold px-1">
                    {issues.length}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="end">
                <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5 text-amber-500" />
                  Accessibilité &amp; SEO
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {issues.map((iss, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectBlock(iss.blockId)}
                      className="w-full text-left rounded-md border bg-card p-2 hover:border-primary transition text-xs"
                    >
                      <div className="font-medium">{iss.message}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {iss.blockType}
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onTogglePreview}
            title="Aperçu plein écran (⌘P)"
          >
            <Eye className="size-4" />
          </Button>

          {slug ? (
            <a href={`/${slug}`} target="_blank" rel="noopener noreferrer">
              <Button
                size="icon-sm"
                variant="ghost"
                title="Voir sur le site (nouvel onglet)"
              >
                <ExternalLink className="size-4" />
              </Button>
            </a>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              disabled
              title="Voir sur le site (nouvel onglet)"
            >
              <ExternalLink className="size-4" />
            </Button>
          )}

          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onOpenVersions}
            title="Historique des versions"
          >
            <History className="size-4" />
          </Button>

          <Button size="icon-sm" variant="ghost" onClick={onOpenTheme} title="Thème de la page">
            <Palette className="size-4" />
          </Button>

          <Button size="icon-sm" variant="ghost" onClick={onOpenSettings} title="Paramètres">
            <Settings2 className="size-4" />
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          <Badge
            variant={isPublished ? 'default' : 'secondary'}
            className={cn(
              'gap-1 hidden md:inline-flex',
              isPublished && 'bg-emerald-500 hover:bg-emerald-500'
            )}
          >
            <Globe className="size-3" />
            {isPublished ? 'Publié' : 'Brouillon'}
          </Badge>

          <Button
            size="sm"
            variant={isPublished ? 'outline' : 'default'}
            onClick={onTogglePublish}
            className="ml-1"
          >
            {isPublished ? 'Dépublier' : 'Publier'}
          </Button>
        </div>
      </div>

      {/* Sub-bar: slug */}
      <div className="flex items-center gap-2 px-4 pb-2 text-xs text-muted-foreground">
        <Globe className="size-3" />
        <span className="font-mono">/{slug || '…'}</span>
      </div>
    </div>
  )
}

// ─────────────────────────── Issue detection ───────────────────────────

interface Issue {
  blockId: string
  blockType: string
  message: string
  severity: 'warning' | 'error'
}

function detectIssues(blocks: BlockProps[]): Issue[] {
  const issues: Issue[] = []
  let h1Count = 0
  for (const b of blocks) {
    if (b.type === 'image') {
      const p = b.props as ImageProps
      if (!p.alt || p.alt.trim().length < 3) {
        issues.push({
          blockId: b.id,
          blockType: 'Image',
          message: 'Image sans texte alternatif (alt)',
          severity: 'warning',
        })
      }
    }
    if (b.type === 'gallery') {
      const p = b.props as GalleryProps
      const missing = p.items.filter((it) => !it.alt || it.alt.trim().length < 3).length
      if (missing > 0) {
        issues.push({
          blockId: b.id,
          blockType: 'Galerie',
          message: `${missing} image(s) sans alt`,
          severity: 'warning',
        })
      }
    }
    if (b.type === 'heading') {
      const lvl = (b.props as { level: number }).level
      if (lvl === 1) h1Count++
    }
  }
  if (h1Count > 1) {
    issues.push({
      blockId: blocks.find((b) => b.type === 'heading')?.id ?? '',
      blockType: 'Heading',
      message: `${h1Count} titres H1 trouvés (un seul recommandé)`,
      severity: 'warning',
    })
  }
  return issues
}

function SaveStatus({
  label,
  isSaving,
  isDirty,
}: {
  label: string
  isSaving: boolean
  isDirty: boolean
}) {
  return (
    <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground px-2">
      {isSaving ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : isDirty ? (
        <CircleAlert className="size-3.5 text-amber-500" />
      ) : (
        <CircleCheck className="size-3.5 text-emerald-500" />
      )}
      <span>{label}</span>
    </div>
  )
}
