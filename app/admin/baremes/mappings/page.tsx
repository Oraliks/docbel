'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Mapping {
  id: string
  sheetName: string
  fileType: string
  parserType: string
  category: string
  config: unknown
  notes: string | null
  enabled: boolean
  createdBy: string | null
  updatedAt: string
}

const PARSER_TYPES = [
  'allocation_matrix',
  'salary_brackets',
  'basic_amounts',
  'hourly_wages',
  'allocation_w',
  'other_unemployment_amounts',
  'activation',
  'other_allocations',
  'employment_bonus',
]

const CATEGORIES = [
  'full_unemployment',
  'half_unemployment',
  'temporary_unemployment_full',
  'temporary_unemployment_half',
  'special_category_full',
  'special_category_half',
  'salary_bracket',
  'hourly_wage',
  'allocation_w',
  'other_unemployment_amount',
  'activation',
  'other_allocation',
  'employment_bonus',
  'basic_amount',
]

interface NewMappingDraft {
  sheetName: string
  parserType: string
  category: string
  notes: string
  enabled: boolean
}

const EMPTY_DRAFT: NewMappingDraft = {
  sheetName: '',
  parserType: 'allocation_matrix',
  category: 'full_unemployment',
  notes: '',
  enabled: true,
}

export default function MappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<NewMappingDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/baremes/mappings')
      const data = await res.json()
      setMappings(data.mappings ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const save = async () => {
    if (!draft.sheetName.trim()) {
      toast.error("Renseigne le nom de l'onglet")
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/baremes/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          sheetName: draft.sheetName.trim(),
          notes: draft.notes.trim() || undefined,
          config: {}, // V2.1 : passer la config personnalisée par parser
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Échec sauvegarde')
      toast.success('Mapping enregistré')
      setDraft(EMPTY_DRAFT)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce mapping ? Les prochains imports utiliseront la détection auto.'))
      return
    try {
      const res = await fetch(`/api/baremes/mappings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Échec')
      toast.success('Mapping supprimé')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const toggleEnabled = async (m: Mapping) => {
    try {
      const res = await fetch('/api/baremes/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetName: m.sheetName,
          fileType: m.fileType,
          parserType: m.parserType,
          category: m.category,
          config: m.config ?? {},
          notes: m.notes ?? undefined,
          enabled: !m.enabled,
        }),
      })
      if (!res.ok) throw new Error('Échec')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <div>
        <Link
          href="/admin/baremes"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Barèmes
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Mappings d&apos;onglets</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Override de structure pour un onglet dont la mise en page a changé.
              Si un mapping existe pour un nom d&apos;onglet, il prend le pas sur la
              détection automatique au moment de l&apos;import suivant.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form de création */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nouveau mapping
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">
                Nom de l&apos;onglet Excel
              </label>
              <Input
                placeholder="ex: A_N_B_vol_plein"
                value={draft.sheetName}
                onChange={(e) => setDraft({ ...draft, sheetName: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Exact, espaces inclus. Existant remplacé.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Type de parser</label>
              <Select
                value={draft.parserType}
                onValueChange={(v) => setDraft({ ...draft, parserType: v ?? 'allocation_matrix' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARSER_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Catégorie produite</label>
              <Select
                value={draft.category}
                onValueChange={(v) => setDraft({ ...draft, category: v ?? 'full_unemployment' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Notes (optionnel)</label>
              <Input
                placeholder="ex: ONEM a modifié la structure le 03/2026"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>

            <Button onClick={save} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Sauvegarde…' : 'Enregistrer'}
            </Button>
          </CardContent>
        </Card>

        {/* Table des mappings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Mappings actifs ({mappings.filter((m) => m.enabled).length}/{mappings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Onglet</TableHead>
                  <TableHead>Parser</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Chargement…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && mappings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun mapping. La détection automatique s&apos;applique pour tous les onglets.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  mappings.map((m) => (
                    <TableRow key={m.id} className={!m.enabled ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-xs">
                        {m.sheetName}
                        {!m.enabled && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            désactivé
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m.parserType}</TableCell>
                      <TableCell className="font-mono text-xs">{m.category}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {m.notes ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleEnabled(m)}
                          className="mr-1"
                        >
                          {m.enabled ? 'Désactiver' : 'Activer'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(m.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
          <div className="font-medium text-foreground">Comment ça marche ?</div>
          <p>
            Les mappings prennent le pas sur la table par défaut au moment du prochain import.
            Utilise-les si ONEM publie un fichier avec un onglet renommé ou réorganisé : tu peux
            forcer un parser existant à traiter un nouvel onglet sans déployer de code.
          </p>
          <p>
            Pour un changement structurel profond (positions de colonnes), V2.1 ajoutera un éditeur
            de configuration JSON par mapping. Pour l&apos;instant, le mapping route uniquement le
            choix parser+catégorie.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
