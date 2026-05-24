'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { ExternalLink, Settings2, Star, Clock, Trash2, BookOpenCheck } from 'lucide-react'
import { toast } from 'sonner'

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
  const [saving, setSaving] = useState(false)
  const [deleted, setDeleted] = useState(false)

  async function patch(body: { active?: boolean; popular?: boolean }) {
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
      // Revert UI
      if ('active' in body) setActive(!body.active)
      if ('popular' in body) setPopular(!body.popular)
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
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
            {tool.icon && <span className="text-xl shrink-0">{tool.icon}</span>}
            <div className="min-w-0">
              <CardTitle className="text-sm truncate">{tool.name}</CardTitle>
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
        <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>

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
