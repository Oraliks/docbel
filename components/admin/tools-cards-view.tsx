'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ExternalLink,
  Settings2,
  Star,
  Clock,
  Trash2,
  BookOpenCheck,
  Pencil,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  IconDisplay,
  IconPicker,
} from '@/components/admin/documents/icon-picker'
import { AUDIENCES, type AudienceId } from '@/lib/audience'

interface Tool {
  id: string
  name: string
  slug: string
  description: string
  type: string
  icon?: string
  popular: boolean
  timeMin?: number
  order: number
  active: boolean
  audience: AudienceId
}

interface Section {
  id: string
  name: string
  description?: string | null
  icon?: string | null
  order: number
  tools: Tool[]
}

interface Props {
  sections: Section[]
}

const TYPE_LABEL: Record<string, string> = {
  calc_preavis: 'Calculatrice — Préavis',
  calc_agr: 'Calculatrice — AGR',
  calc_cp: 'Calculatrice — Salaire',
  // Batch calculateurs citoyens 2026-05 (cf. lib/calculators/*).
  calc_brut_net: 'Calculatrice — Brut/Net',
  calc_pecule: 'Calculatrice — Pécule',
  calc_chomage: 'Calculatrice — Chômage',
  calc_indemnite: 'Calculatrice — Indemnité rupture',
  calc_pension: 'Calculatrice — Pension',
  calc_allocs_fam: 'Calculatrice — Allocs familiales',
  calc_ipp: 'Calculatrice — IPP',
  calc_tarif_social: 'Calculatrice — Tarif social',
  calc_km: 'Calculatrice — Frais km',
  locator: 'Localisateur',
  tutorial: 'Tutoriel',
  info: 'FAQ',
  links: 'Liens',
  form: 'Formulaire',
  doc_generator: 'Générateur de document',
}

/**
 * Mapping slug → page admin de configuration spécifique. Utilisé pour le
 * bouton "Configurer" sur chaque card. Si pas d'entrée ici, le bouton
 * est masqué (l'outil n'a pas de config dédiée).
 */
const CONFIG_URL: Record<string, string> = {
  preavis: '/admin/chomage/preavis',
  bureaux: '/outils/bureaux',
}

export function ToolsCardsView({ sections }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Outils</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Active ou désactive chaque outil. Désactivé = caché du catalogue public.
        </p>
      </div>

      {sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <div className="flex items-baseline gap-2">
            {section.icon && <span className="text-lg">{section.icon}</span>}
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {section.name}
            </h2>
            <Badge variant="secondary" className="text-[10px]">
              {section.tools.filter((t) => t.active).length}/{section.tools.length} actifs
            </Badge>
          </div>

          {section.tools.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aucun outil dans cette section.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {section.tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function ToolCard({ tool }: { tool: Tool }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [active, setActive] = useState(tool.active)
  const [popular, setPopular] = useState(tool.popular)
  const [name, setName] = useState(tool.name)
  const [description, setDescription] = useState(tool.description)
  const [icon, setIcon] = useState<string | null>(tool.icon ?? null)
  const [audience, setAudience] = useState<AudienceId>(tool.audience)
  const [saving, setSaving] = useState(false)
  const [deleted, setDeleted] = useState(false)

  /**
   * PATCH générique du Tool. Body partiel — n'envoie que les champs modifiés.
   * En cas d'erreur on revert visuellement l'état booléen (UI optimiste pour
   * les toggles ; les champs texte, eux, gardent la nouvelle valeur dans
   * l'état même si la sauvegarde échoue — l'utilisateur peut retenter).
   */
  async function patch(body: {
    active?: boolean
    popular?: boolean
    name?: string
    description?: string
    icon?: string | null
    audience?: AudienceId
  }) {
    setSaving(true)
    try {
      const res = await fetch(`/api/tools/${tool.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Échec mise à jour')
      }
    } catch (err) {
      // Revert UI booléens
      if ('active' in body) setActive(!body.active)
      if ('popular' in body) setPopular(!body.popular)
      toast.error(err instanceof Error ? err.message : 'Erreur')
      throw err
    } finally {
      setSaving(false)
    }
  }

  /** Sauvegarde du nom — utilisée par EditableField. */
  async function saveName(next: string) {
    const trimmed = next.trim()
    if (!trimmed || trimmed === tool.name) {
      setName(tool.name)
      return
    }
    try {
      await patch({ name: trimmed })
      tool.name = trimmed // mutate pour cohérence (ex: si on supprime ensuite)
      toast.success('Titre mis à jour')
      router.refresh()
    } catch {
      setName(tool.name)
    }
  }

  /** Sauvegarde de la description — utilisée par EditableField. */
  async function saveDescription(next: string) {
    const trimmed = next.trim()
    if (!trimmed || trimmed === tool.description) {
      setDescription(tool.description)
      return
    }
    try {
      await patch({ description: trimmed })
      tool.description = trimmed
      toast.success('Description mise à jour')
      router.refresh()
    } catch {
      setDescription(tool.description)
    }
  }

  /**
   * Sauvegarde de l'icône — utilisée par IconPicker. Accepte string (nom
   * lucide ou emoji 1-4 chars) ou null (retirer l'icône).
   */
  async function saveIcon(next: string | null) {
    if (next === (tool.icon ?? null)) return
    const previous = icon
    setIcon(next)
    try {
      await patch({ icon: next })
      tool.icon = next ?? undefined
      toast.success(next ? 'Icône mise à jour' : 'Icône retirée')
      router.refresh()
    } catch {
      setIcon(previous)
    }
  }

  function toggleActive(next: boolean) {
    setActive(next)
    void patch({ active: next })
    toast.success(next ? `${tool.name} activé` : `${tool.name} désactivé`)
  }

  function togglePopular() {
    const next = !popular
    setPopular(next)
    void patch({ popular: next })
  }

  /**
   * Sauvegarde l'audience de l'outil. UI optimiste : on update tout de suite,
   * on revert si l'API échoue.
   */
  async function saveAudience(next: AudienceId) {
    if (next === audience) return
    const previous = audience
    setAudience(next)
    try {
      await patch({ audience: next })
      tool.audience = next
      const label = AUDIENCES.find((a) => a.id === next)?.label ?? next
      toast.success(`Audience : ${label}`)
      router.refresh()
    } catch {
      setAudience(previous)
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Supprimer "${tool.name}" ?`,
      description:
        'Le template associé (et tous ses générés, révisions, items de bundle) sera aussi supprimé en cascade. Cette action est irréversible.',
      confirmText: 'Supprimer définitivement',
      destructive: true,
      requireText: tool.name,
    })
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch(`/api/tools/${tool.slug}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Échec suppression')
      }
      setDeleted(true)
      toast.success(`${tool.name} supprimé`)
      // Refresh server-rendered list pour que la card disparaisse aux yeux des autres.
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
      setSaving(false)
    }
  }

  if (deleted) return null

  const configUrl = CONFIG_URL[tool.slug]
  /**
   * Pour les calculateurs (`type` commençant par `calc_`), on expose un
   * bouton "Méthodologie" qui mène à la fiche détaillée
   * `/admin/chomage/outils/calculateurs/[slug]` : formules, constantes,
   * sources officielles, limitations. C'est l'endroit où l'admin (expert
   * métier) peut auditer chaque chiffre du calcul.
   */
  const showMethodology = tool.type.startsWith('calc_')

  return (
    <Card className={active ? '' : 'opacity-60 border-dashed'}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <IconPickerInline
              value={icon}
              onChange={saveIcon}
              disabled={saving}
            />
            <div className="min-w-0 flex-1">
              <EditableField
                value={name}
                onSave={saveName}
                onChange={setName}
                mode="input"
                placeholder="Titre de l'outil…"
                ariaLabel="Éditer le titre"
                disabled={saving}
                className="text-sm font-semibold"
              />
              <p className="text-[11px] text-muted-foreground font-mono">{tool.slug}</p>
            </div>
          </div>
          <Switch
            checked={active}
            onCheckedChange={toggleActive}
            disabled={saving}
            aria-label={active ? 'Désactiver' : 'Activer'}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-1">
        <EditableField
          value={description}
          onSave={saveDescription}
          onChange={setDescription}
          mode="textarea"
          placeholder="Description publique…"
          ariaLabel="Éditer la description"
          disabled={saving}
          className="text-xs text-muted-foreground"
        />

        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <Badge variant="outline">{TYPE_LABEL[tool.type] ?? tool.type}</Badge>
          {tool.timeMin && (
            <Badge variant="outline" className="gap-1">
              <Clock className="w-2.5 h-2.5" /> {tool.timeMin} min
            </Badge>
          )}
          <button
            onClick={togglePopular}
            disabled={saving}
            title={popular ? 'Retirer des populaires' : 'Marquer populaire'}
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition ${
              popular
                ? 'border-yellow-400 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30'
                : 'border-border text-muted-foreground hover:border-yellow-300'
            }`}
          >
            <Star className={`w-2.5 h-2.5 ${popular ? 'fill-yellow-500 text-yellow-500' : ''}`} />
            {popular ? 'Populaire' : 'Non populaire'}
          </button>

          <AudiencePicker
            value={audience}
            onChange={saveAudience}
            disabled={saving}
          />
        </div>

        <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
          {configUrl ? (
            <Button
              render={<Link href={configUrl} />}
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
            >
              <Settings2 className="w-3 h-3 mr-1" />
              Configurer
            </Button>
          ) : null}
          {showMethodology ? (
            <Button
              render={
                <Link
                  href={`/admin/chomage/outils/calculateurs/${tool.slug}`}
                />
              }
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              title="Voir la méthodologie (formules, constantes, sources)"
            >
              <BookOpenCheck className="w-3 h-3 mr-1" />
              Méthodologie
            </Button>
          ) : null}
          <Button
            render={
              <a href={`/outils/${tool.slug}`} target="_blank" rel="noreferrer" />
            }
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            disabled={!active}
          >
            Voir <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={saving}
            className="h-7 text-xs px-2 ml-auto text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Supprimer l'outil"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  AudiencePicker — chip cliquable + dropdown pour choisir l'audience */
/* ------------------------------------------------------------------ */

/**
 * Compact picker pour `Tool.audience`. Affiche un chip coloré (violet clair
 * → foncé selon l'audience) et ouvre un dropdown au clic pour basculer entre
 * citoyen / employeur / partenaire.
 *
 * Hiérarchie (cf. lib/audience.ts) :
 *   - citoyen   : visible par tous (badge violet clair)
 *   - employeur : visible par employeur + partenaire (badge violet moyen)
 *   - partenaire: visible uniquement par partenaire (badge violet foncé)
 *
 * Les couleurs reprennent `Audience.dotClass` / `iconBgClass`.
 */
function AudiencePicker({
  value,
  onChange,
  disabled,
}: {
  value: AudienceId
  onChange: (next: AudienceId) => void
  disabled?: boolean
}) {
  const current = AUDIENCES.find((a) => a.id === value) ?? AUDIENCES[0]
  const CurrentIcon = current.Icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            title={`Audience : ${current.label}. Hiérarchie : citoyen = tous, employeur = employeur+partenaire, partenaire = partenaire uniquement.`}
            aria-label={`Audience actuelle : ${current.label}`}
            className={`inline-flex items-center gap-1 rounded border border-violet-300/60 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 transition hover:border-violet-500 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200 disabled:opacity-50`}
          />
        }
      >
        <CurrentIcon className="w-2.5 h-2.5" />
        <span className="capitalize">{current.id}</span>
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {AUDIENCES.map((aud) => {
          const Icon = aud.Icon
          const isActive = aud.id === value
          return (
            <DropdownMenuItem
              key={aud.id}
              onClick={() => onChange(aud.id)}
              className={isActive ? 'bg-accent/60 font-semibold' : ''}
            >
              <span
                className={`inline-flex size-5 shrink-0 items-center justify-center rounded ${aud.iconBgClass}`}
              >
                <Icon className="size-3" />
              </span>
              <div className="flex flex-col items-start">
                <span className="text-xs capitalize">{aud.id}</span>
                <span className="text-[10px] text-muted-foreground">
                  {audienceHint(aud.id)}
                </span>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Petite phrase d'aide affichée sous chaque entrée du picker. */
function audienceHint(id: AudienceId): string {
  switch (id) {
    case 'citoyen':
      return 'Visible par tous'
    case 'employeur':
      return 'Employeur + partenaire'
    case 'partenaire':
      return 'Partenaire uniquement'
  }
}

/* ------------------------------------------------------------------ */
/*  IconPickerInline — bouton icône compact qui ouvre le IconPicker   */
/* ------------------------------------------------------------------ */

/**
 * Wrapper compact autour de <IconPicker /> pour usage dans la card admin.
 *
 * On passe au IconPicker un `trigger` custom : un bouton carré 36×36 qui
 * affiche l'icône courante via `IconDisplay`. Le clic ouvre le Dialog
 * complet (recherche d'icônes lucide + emoji custom) ; à la sélection,
 * `onChange` est appelé avec la nouvelle valeur (string | null).
 */
function IconPickerInline({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (next: string | null) => void
  disabled?: boolean
}) {
  const trigger = (
    <button
      type="button"
      disabled={disabled}
      className="group relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
      title="Changer l'icône"
      aria-label="Changer l'icône"
    >
      {value ? (
        <IconDisplay value={value} className="size-5" />
      ) : (
        <Pencil className="size-3.5 text-muted-foreground" />
      )}
      <Pencil className="absolute -bottom-0.5 -right-0.5 size-3 rounded bg-primary p-0.5 text-primary-foreground opacity-0 transition group-hover:opacity-100" />
    </button>
  )
  return <IconPicker value={value} onChange={onChange} trigger={trigger} />
}

/* ------------------------------------------------------------------ */
/*  EditableField — click-to-edit pour le titre et la description     */
/* ------------------------------------------------------------------ */

interface EditableFieldProps {
  value: string
  onChange: (next: string) => void
  onSave: (next: string) => void
  mode: 'input' | 'textarea'
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
  className?: string
}

/**
 * Champ d'affichage qui passe en édition au clic.
 *
 * - `Enter` (input) ou `Cmd/Ctrl+Enter` (textarea) → sauvegarde
 * - `Esc` → annule (recharge la valeur initiale)
 * - `blur` → sauvegarde
 *
 * En mode lecture, hover affiche une icône Pencil discrète pour signaler
 * la possibilité d'éditer. Le composant est volontairement minimaliste —
 * il ne valide rien côté client (la validation Zod côté API garde le
 * dernier mot).
 */
function EditableField({
  value,
  onChange,
  onSave,
  mode,
  placeholder,
  ariaLabel,
  disabled,
  className = '',
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Re-sync quand la valeur change côté parent (ex: après refresh).
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  // Auto-focus + sélection à l'entrée en édition.
  useEffect(() => {
    if (!editing) return
    const el = mode === 'input' ? inputRef.current : textareaRef.current
    el?.focus()
    if (el && 'select' in el) el.select()
  }, [editing, mode])

  function startEdit() {
    if (disabled) return
    setDraft(value)
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    if (draft !== value) {
      onChange(draft)
      onSave(draft)
    }
  }

  function cancel() {
    setEditing(false)
    setDraft(value)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
      return
    }
    if (e.key === 'Enter') {
      if (mode === 'input' || (mode === 'textarea' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        commit()
      }
    }
  }

  if (editing) {
    if (mode === 'input') {
      return (
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          maxLength={120}
          className={`h-7 px-2 py-0 text-sm ${className}`}
        />
      )
    }
    return (
      <Textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        maxLength={600}
        rows={3}
        className={`min-h-[64px] resize-none text-xs ${className}`}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel ? `${ariaLabel} (clic)` : 'Cliquer pour éditer'}
      className={`group/edit relative w-full rounded px-1 -mx-1 text-left transition hover:bg-muted/60 disabled:cursor-not-allowed ${
        mode === 'input' ? 'truncate' : 'line-clamp-2'
      } ${className}`}
    >
      {value || (
        <span className="italic text-muted-foreground/60">
          {placeholder ?? 'Cliquer pour éditer'}
        </span>
      )}
      <Pencil className="absolute right-1 top-1 size-2.5 opacity-0 transition group-hover/edit:opacity-50" />
    </button>
  )
}
