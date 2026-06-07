'use client'

import React from 'react'
import {
  ArrowLeft,
  Braces,
  Download,
  ExternalLink,
  Eye,
  Globe,
  History,
  ListChecks,
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
import { detectIssues, type Issue, type IssueSeverity } from '@/lib/page-builder/page-health'
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
  onOpenVariables: () => void
  onOpenAudit: () => void
  onExport: () => void
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
  onOpenVariables,
  onOpenAudit,
  onExport,
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
            <PageHealth issues={issues} onSelect={selectBlock} />
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

          <Button size="icon-sm" variant="ghost" onClick={onOpenVariables} title="Variables de la page">
            <Braces className="size-4" />
          </Button>

          <Button size="icon-sm" variant="ghost" onClick={onOpenAudit} title="Audit IA de la page">
            <ListChecks className="size-4" />
          </Button>

          <Button size="icon-sm" variant="ghost" onClick={onOpenSettings} title="Paramètres">
            <Settings2 className="size-4" />
          </Button>

          <Button size="icon-sm" variant="ghost" onClick={onExport} title="Exporter en JSON">
            <Download className="size-4" />
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

// ─────────────────────────── Page health (a11y / SEO) ───────────────────────────

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  error: 'Erreurs',
  warning: 'Avertissements',
  info: 'Suggestions',
}

const SEVERITY_TEXT: Record<IssueSeverity, string> = {
  error: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-muted-foreground',
}

// Couleur du déclencheur dans la topbar (classes statiques pour Tailwind).
const TRIGGER_TONE: Record<'error' | 'warning', string> = {
  error: 'text-destructive hover:text-destructive',
  warning: 'text-amber-600 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-400',
}

const SEVERITY_DOT: Record<IssueSeverity, string> = {
  error: 'bg-destructive',
  warning: 'bg-amber-500',
  info: 'bg-muted-foreground',
}

function PageHealth({
  issues,
  onSelect,
}: {
  issues: Issue[]
  onSelect: (id: string | null) => void
}) {
  const hasError = issues.some((i) => i.severity === 'error')
  // Couleur du badge : rouge si au moins une erreur, sinon ambre.
  const tone = hasError ? 'error' : 'warning'
  const order: IssueSeverity[] = ['error', 'warning', 'info']

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          className={cn('relative', TRIGGER_TONE[tone])}
          title={`${issues.length} point(s) à vérifier (accessibilité & SEO)`}
        >
          <ShieldAlert className="size-4" />
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full text-white text-[9px] font-semibold px-1',
              SEVERITY_DOT[tone]
            )}
          >
            {issues.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <ShieldAlert className="size-3.5 text-amber-500" />
          Santé de la page
          <span className="ml-auto font-normal text-muted-foreground">
            {issues.length} point{issues.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {order.map((sev) => {
            const group = issues.filter((i) => i.severity === sev)
            if (group.length === 0) return null
            return (
              <div key={sev} className="space-y-1">
                <div
                  className={cn(
                    'flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide',
                    SEVERITY_TEXT[sev]
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', SEVERITY_DOT[sev])} />
                  {SEVERITY_LABEL[sev]} ({group.length})
                </div>
                {group.map((iss, i) => {
                  const clickable = !!iss.blockId
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!clickable}
                      onClick={() => iss.blockId && onSelect(iss.blockId)}
                      className={cn(
                        'w-full text-left rounded-md border bg-card p-2 text-xs transition',
                        clickable
                          ? 'hover:border-primary cursor-pointer'
                          : 'cursor-default opacity-90'
                      )}
                    >
                      <div className={cn('font-medium', SEVERITY_TEXT[sev])}>{iss.message}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {iss.blockType}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
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
