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
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('admin.baremes')
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
      toast.error(err instanceof Error ? err.message : t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const save = async () => {
    if (!draft.sheetName.trim()) {
      toast.error(t('mappingSheetNameRequired'))
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
      if (!res.ok) throw new Error(body.error ?? t('mappingSaveFailed'))
      toast.success(t('mappingSaved'))
      setDraft(EMPTY_DRAFT)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm(t('mappingDeleteConfirm')))
      return
    try {
      const res = await fetch(`/api/baremes/mappings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(t('failed'))
      toast.success(t('mappingDeleted'))
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'))
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
      if (!res.ok) throw new Error(t('failed'))
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'))
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <Link
          href="/admin/baremes"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('title')}
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('sheetMappings')}</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              {t('mappingIntro')}
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form de création */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {t('mappingNew')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">
                {t('mappingSheetNameLabel')}
              </label>
              <Input
                placeholder={t('mappingSheetNamePlaceholder')}
                value={draft.sheetName}
                onChange={(e) => setDraft({ ...draft, sheetName: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {t('mappingSheetNameHint')}
              </p>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">{t('mappingParserType')}</label>
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
              <label className="text-xs font-medium block mb-1">{t('mappingCategory')}</label>
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
              <label className="text-xs font-medium block mb-1">{t('mappingNotesLabel')}</label>
              <Input
                placeholder={t('mappingNotesPlaceholder')}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>

            <Button onClick={save} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saving ? t('saving') : t('save')}
            </Button>
          </CardContent>
        </Card>

        {/* Table des mappings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t('mappingActiveCount', {
                active: mappings.filter((m) => m.enabled).length,
                total: mappings.length,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('mappingColSheet')}</TableHead>
                  <TableHead>{t('mappingColParser')}</TableHead>
                  <TableHead>{t('mappingColCategory')}</TableHead>
                  <TableHead>{t('mappingColNotes')}</TableHead>
                  <TableHead className="text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t('loading')}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && mappings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t('mappingEmpty')}
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
                            {t('mappingDisabled')}
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
                          {m.enabled ? t('mappingDeactivate') : t('mappingActivate')}
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
          <div className="font-medium text-foreground">{t('mappingHowItWorksTitle')}</div>
          <p>
            {t('mappingHowItWorksBody1')}
          </p>
          <p>
            {t('mappingHowItWorksBody2')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
