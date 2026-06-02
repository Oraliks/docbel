'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Calendar,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface FileRecord {
  id: string
  name: string
  status: string
  filePath: string
  fileHash: string | null
  effectiveDate: string
  validFrom: string | null
  multiplicateur: number | null
  publishedAt: string | null
  publishedBy: string | null
  createdBy: string | null
  createdAt: string
  summary: {
    sheetsDetected: number
    sheetsParsed: number
    sheetsIgnored: number
    amountsExtracted: number
    sheetsByName: { name: string; parsed: boolean; amountsCount: number; reason?: string }[]
  } | null
  alerts:
    | {
        level: 'info' | 'warn' | 'error'
        sheet?: string
        cell?: string
        message: string
      }[]
    | null
}

interface AmountPreview {
  id: string
  sourceSheet: string
  category: string
  allocationCode: string | null
  salaryCode: string | null
  article: string | null
  labelFr: string | null
  labelNl: string | null
  unit: string | null
  amount: number
  minDailySalary: number | null
  maxDailySalary: number | null
  comparisonKey: string
}

interface DiffChange {
  type: 'amount_changed' | 'new_entry' | 'removed_entry'
  key: string
  oldValue?: number
  newValue?: number
  category: string
  sourceSheet?: string
}

interface Diff {
  changes: DiffChange[]
  previousFileId: string | null
  newFileId: string
  countsByType: {
    amount_changed: number
    new_entry: number
    removed_entry: number
  }
}

interface Approval {
  id: string
  approverEmail: string
  approverName: string | null
  comment: string | null
  createdAt: string
}

interface HistoryEntry {
  id: string
  action: string
  fromStatus: string | null
  toStatus: string | null
  actorEmail: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

interface PreviewData {
  file: FileRecord & { requiresApproval?: boolean }
  amountsPreview: AmountPreview[]
  totalAmounts: number
  amountsPreviewLimit: number
  diff: Diff | null
  history?: HistoryEntry[]
  approvals?: Approval[]
}

export default function BaremeImportPreviewPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Chargement impossible')
      }
      setData(await res.json())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const publish = async (force = false) => {
    if (!id) return
    if (
      !confirm(
        force
          ? 'Publier malgré les alertes d’erreur ? Cette version deviendra la source utilisée par les calculateurs.'
          : 'Publier cet import ? L’ancienne version sera archivée.'
      )
    )
      return
    setActing(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Publication échouée')
      toast.success('Import publié')
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur'
      toast.error(message)
    } finally {
      setActing(false)
    }
  }

  const reject = async () => {
    if (!id) return
    if (!confirm('Rejeter cet import ? Il sera marqué "rejected" et ne pourra plus être publié.'))
      return
    setActing(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}/reject`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Rejet échoué')
      toast.success('Import rejeté')
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur'
      toast.error(message)
    } finally {
      setActing(false)
    }
  }

  const approve = async () => {
    if (!id) return
    const comment = window.prompt('Commentaire d\'approbation (optionnel) :') ?? ''
    setActing(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast.info('Vous avez déjà approuvé cet import')
        return
      }
      if (!res.ok) throw new Error(body.error ?? 'Approbation échouée')
      if (body.autoPublished) {
        toast.success(`Import auto-publié (${body.approvalsCount}/${body.requiredCount})`)
      } else {
        toast.success(`Approbation enregistrée (${body.approvalsCount}/${body.requiredCount})`)
      }
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActing(false)
    }
  }

  const rollback = async () => {
    if (!id) return
    if (
      !confirm(
        'Restaurer cette version archivée ? La version actuellement publiée sera archivée à son tour.'
      )
    )
      return
    setActing(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}/rollback`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Rollback échoué')
      toast.success('Version restaurée et publiée')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <Link
          href="/admin/baremes"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Barèmes
        </Link>
        <p className="mt-6">Import introuvable.</p>
      </div>
    )
  }

  const { file, amountsPreview, totalAmounts, amountsPreviewLimit, diff } = data
  const alerts = file.alerts ?? []
  const summary = file.summary
  const isDraftOrPending = file.status === 'draft' || file.status === 'pending_approval'
  const isArchived = file.status === 'archived'
  const requiresApproval = file.requiresApproval === true
  const approvals = data.approvals ?? []
  const history = data.history ?? []
  const errorCount = alerts.filter((a) => a.level === 'error').length
  const warnCount = alerts.filter((a) => a.level === 'warn').length
  const infoCount = alerts.filter((a) => a.level === 'info').length

  const statusLabel: Record<string, { label: string; tone: string }> = {
    draft: { label: 'Brouillon', tone: 'bg-yellow-100 text-yellow-900 border-yellow-200' },
    pending_approval: {
      label: 'En attente d\'approbation',
      tone: 'bg-orange-100 text-orange-900 border-orange-300',
    },
    published: { label: 'Publié', tone: 'bg-green-100 text-green-900 border-green-200' },
    archived: { label: 'Archivé', tone: 'bg-muted text-muted-foreground' },
    rejected: { label: 'Rejeté', tone: 'bg-red-100 text-red-900 border-red-200' },
    active: { label: 'Legacy (avant nouveau workflow)', tone: 'bg-muted text-muted-foreground' },
  }
  const statusInfo = statusLabel[file.status] ?? { label: file.status, tone: 'bg-muted' }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header sticky avec actions */}
      <div className="sticky top-0 z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 bg-background/95 backdrop-blur border-b">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <Link
              href="/admin/baremes"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Barèmes
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <FileSpreadsheet className="w-5 h-5 text-muted-foreground shrink-0" />
              <h1 className="text-xl font-bold truncate" title={file.name}>
                {file.name}
              </h1>
              <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${statusInfo.tone}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {file.validFrom
                  ? `Valide depuis ${new Date(file.validFrom).toLocaleDateString('fr-BE')}`
                  : `Date brute: ${file.effectiveDate}`}
              </span>
              {file.multiplicateur && <span>×{file.multiplicateur.toFixed(4)}</span>}
              <span className="font-mono">
                Hash: {file.fileHash ? file.fileHash.slice(0, 10) + '…' : '— legacy'}
              </span>
              {file.createdBy && <span>par {file.createdBy}</span>}
              {file.publishedAt && (
                <span>publié {new Date(file.publishedAt).toLocaleDateString('fr-BE')}</span>
              )}
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {file.filePath && (
              <Button
                variant="outline"
                onClick={() => window.open(file.filePath, '_blank')}
                type="button"
                size="sm"
              >
                Source .xlsx
              </Button>
            )}
            {isDraftOrPending && (
              <>
                <Button
                  variant="outline"
                  onClick={() => reject()}
                  disabled={acting}
                  className="text-red-600 hover:text-red-700"
                  size="sm"
                >
                  Rejeter
                </Button>
                {requiresApproval ? (
                  <Button onClick={approve} disabled={acting} size="sm">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approuver ({approvals.length}/2)
                  </Button>
                ) : errorCount > 0 ? (
                  <Button onClick={() => publish(true)} disabled={acting} variant="outline" size="sm">
                    Publier ({errorCount} erreur{errorCount > 1 ? 's' : ''})
                  </Button>
                ) : (
                  <Button onClick={() => publish(false)} disabled={acting} size="sm">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Publier
                  </Button>
                )}
              </>
            )}
            {isArchived && (
              <Button onClick={rollback} disabled={acting} variant="outline" size="sm">
                Restaurer cette version
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI grid — pleine largeur */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label="Onglets détectés" value={summary.sheetsDetected} />
          <Stat label="Onglets parsés" value={summary.sheetsParsed} tone="success" />
          <Stat label="Onglets ignorés" value={summary.sheetsIgnored} tone="muted" />
          <Stat label="Montants extraits" value={summary.amountsExtracted} tone="primary" />
          <Stat label="Erreurs" value={errorCount} tone={errorCount > 0 ? 'error' : 'muted'} />
          <Stat label="Avertissements" value={warnCount} tone={warnCount > 0 ? 'warn' : 'muted'} />
        </div>
      )}

      <Tabs defaultValue="diff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diff">
            Changements
            {diff && diff.changes.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {diff.changes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts">
            Alertes
            {alerts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sheets">Onglets</TabsTrigger>
          <TabsTrigger value="preview">
            Aperçu montants
            <Badge variant="secondary" className="ml-2">
              {totalAmounts}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="raw">Grille brute</TabsTrigger>
          <TabsTrigger value="workflow">
            Workflow
            {(approvals.length > 0 || history.length > 0) && (
              <Badge variant="secondary" className="ml-2">
                {approvals.length + history.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diff">
          <DiffPanel diff={diff} status={file.status} />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsPanel alerts={alerts} counts={{ error: errorCount, warn: warnCount, info: infoCount }} />
        </TabsContent>

        <TabsContent value="sheets">
          <SheetsPanel sheets={summary?.sheetsByName ?? []} />
        </TabsContent>

        <TabsContent value="preview">
          <AmountsPreviewPanel
            amounts={amountsPreview}
            total={totalAmounts}
            limit={amountsPreviewLimit}
          />
        </TabsContent>

        <TabsContent value="raw">
          <RawSheetsPanel fileId={file.id} />
        </TabsContent>

        <TabsContent value="workflow">
          <WorkflowPanel
            approvals={approvals}
            history={history}
            requiresApproval={requiresApproval}
            status={file.status}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'muted' | 'primary' | 'warn' | 'error'
}) {
  const toneClass: Record<typeof tone, string> = {
    default: 'border-border',
    success: 'border-green-200 bg-green-50 dark:bg-green-950/20',
    muted: 'border-border bg-muted/30',
    primary: 'border-blue-200 bg-blue-50 dark:bg-blue-950/20',
    warn: 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20',
    error: 'border-red-300 bg-red-50 dark:bg-red-950/20',
  }
  return (
    <div className={`rounded-lg border p-3 ${toneClass[tone]}`}>
      <div className="text-2xl font-semibold">{value.toLocaleString('fr-BE')}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

function DiffPanel({ diff, status }: { diff: Diff | null; status: string }) {
  if (status !== 'draft') {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          La comparaison vs version publiée n’est calculée que pour les brouillons.
        </CardContent>
      </Card>
    )
  }
  if (!diff) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Aucun diff disponible.
        </CardContent>
      </Card>
    )
  }
  if (!diff.previousFileId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Aucune version publiée antérieure — toutes les entrées sont nouvelles.
        </CardContent>
      </Card>
    )
  }

  const groups = {
    amount_changed: diff.changes.filter((c) => c.type === 'amount_changed'),
    new_entry: diff.changes.filter((c) => c.type === 'new_entry'),
    removed_entry: diff.changes.filter((c) => c.type === 'removed_entry'),
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Modifiés" value={groups.amount_changed.length} tone="warn" />
        <Stat label="Nouveaux" value={groups.new_entry.length} tone="success" />
        <Stat label="Supprimés" value={groups.removed_entry.length} tone="error" />
      </div>

      {groups.amount_changed.length > 0 && (
        <DiffSection title="Montants modifiés" items={groups.amount_changed.slice(0, 100)} />
      )}
      {groups.new_entry.length > 0 && (
        <DiffSection title="Nouvelles entrées" items={groups.new_entry.slice(0, 100)} />
      )}
      {groups.removed_entry.length > 0 && (
        <DiffSection title="Entrées supprimées" items={groups.removed_entry.slice(0, 100)} />
      )}

      {diff.changes.length > 300 && (
        <p className="text-xs text-muted-foreground">
          Affichage limité aux 100 premiers changements par catégorie.
        </p>
      )}
    </div>
  )
}

function DiffSection({ title, items }: { title: string; items: DiffChange[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Clé</th>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-right px-3 py-2">Ancien</th>
                <th className="text-right px-3 py-2">Nouveau</th>
                <th className="text-right px-3 py-2">Δ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c, i) => {
                const oldV = 'oldValue' in c ? c.oldValue : null
                const newV = 'newValue' in c ? c.newValue : null
                const delta = oldV != null && newV != null ? newV - oldV : null
                const deltaPct =
                  oldV != null && oldV !== 0 && delta != null ? (delta / oldV) * 100 : null
                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5 font-mono text-xs">{c.key}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {c.sourceSheet ?? c.category}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {oldV != null ? oldV.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {newV != null ? newV.toFixed(2) : '—'}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-mono text-xs ${
                        delta != null && delta > 0
                          ? 'text-green-700 dark:text-green-400'
                          : delta != null && delta < 0
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {delta != null
                        ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}${deltaPct != null ? ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)` : ''}`
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function AlertsPanel({
  alerts,
  counts,
}: {
  alerts: FileRecord['alerts']
  counts: { error: number; warn: number; info: number }
}) {
  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Aucune alerte. Tout s’est bien passé.
        </CardContent>
      </Card>
    )
  }

  const icons = {
    error: <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />,
    warn: <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />,
    info: <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />,
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-3">
          <span>
            {counts.error > 0 && (
              <span className="text-red-600 mr-2">{counts.error} erreur(s)</span>
            )}
            {counts.warn > 0 && (
              <span className="text-yellow-600 mr-2">{counts.warn} avertissement(s)</span>
            )}
            {counts.info > 0 && <span className="text-blue-600">{counts.info} info(s)</span>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              {icons[a.level]}
              <div className="flex-1">
                <div>{a.message}</div>
                {(a.sheet || a.cell) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {a.sheet && <span>Onglet: {a.sheet}</span>}
                    {a.sheet && a.cell && <span> · </span>}
                    {a.cell && <span>Cellule: {a.cell}</span>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function SheetsPanel({
  sheets,
}: {
  sheets: { name: string; parsed: boolean; amountsCount: number; reason?: string }[]
}) {
  if (sheets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Aucun onglet détecté.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Onglet</th>
              <th className="text-left px-3 py-2">Statut</th>
              <th className="text-right px-3 py-2">Montants</th>
              <th className="text-left px-3 py-2">Raison</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((s) => (
              <tr key={s.name} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{s.name}</td>
                <td className="px-3 py-2">
                  {s.parsed ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Parsé
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Ignoré</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">{s.amountsCount}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{s.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function AmountsPreviewPanel({
  amounts,
  total,
  limit,
}: {
  amounts: AmountPreview[]
  total: number
  limit: number
}) {
  if (amounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Aucun montant extrait.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          Aperçu — {amounts.length} sur {total.toLocaleString('fr-BE')}
          {total > limit && ` (limite: ${limit})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Catégorie</th>
                <th className="text-left px-3 py-2">Onglet</th>
                <th className="text-left px-3 py-2">Code alloc</th>
                <th className="text-left px-3 py-2">Tranche</th>
                <th className="text-left px-3 py-2">Article</th>
                <th className="text-left px-3 py-2">Libellé</th>
                <th className="text-right px-3 py-2">Montant</th>
                <th className="text-left px-3 py-2">Unité</th>
              </tr>
            </thead>
            <tbody>
              {amounts.map((a) => (
                <tr key={a.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-1.5 font-mono">{a.category}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{a.sourceSheet}</td>
                  <td className="px-3 py-1.5 font-mono">{a.allocationCode ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono">
                    {a.salaryCode ?? '—'}
                    {a.minDailySalary != null && a.maxDailySalary != null && (
                      <span className="text-muted-foreground ml-1">
                        ({a.minDailySalary.toFixed(2)}–{a.maxDailySalary.toFixed(2)})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">{a.article ?? '—'}</td>
                  <td className="px-3 py-1.5 truncate max-w-[240px]">
                    {a.labelFr ?? a.labelNl ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{a.amount.toFixed(4)}</td>
                  <td className="px-3 py-1.5">{a.unit ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

interface RawSheetData {
  id: string
  name: string
  category: string
  rowCount: number
  colCount: number
  sheetIndex: number
  cellData: string[][]
}

function RawSheetsPanel({ fileId }: { fileId: string }) {
  const [sheets, setSheets] = useState<RawSheetData[] | null>(null)
  const [activeId, setActiveId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchSheets() {
      setLoading(true)
      try {
        const res = await fetch(`/api/baremes?fileId=${fileId}`)
        if (!res.ok) throw new Error('Chargement impossible')
        const data = await res.json()
        if (cancelled) return
        setSheets(data.sheets ?? [])
        if (data.sheets?.[0]) setActiveId(data.sheets[0].id)
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Erreur')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchSheets()
    return () => {
      cancelled = true
    }
  }, [fileId])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
          Chargement des grilles…
        </CardContent>
      </Card>
    )
  }

  if (!sheets || sheets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Aucune feuille disponible.
        </CardContent>
      </Card>
    )
  }

  const active = sheets.find((s) => s.id === activeId) ?? sheets[0]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Grille brute</span>
            <span className="text-xs text-muted-foreground">
              ({sheets.length} feuille{sheets.length > 1 ? 's' : ''})
            </span>
          </div>
          <div className="relative w-72 max-w-full">
            <input
              type="search"
              placeholder="Filtrer les cellules…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm border rounded-md px-3 py-1.5 bg-background"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={active.id} onValueChange={setActiveId}>
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex w-auto">
              {sheets.map((sheet) => (
                <TabsTrigger key={sheet.id} value={sheet.id} className="text-xs">
                  {sheet.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {sheets.map((sheet) => (
            <TabsContent key={sheet.id} value={sheet.id} className="mt-4">
              <div className="text-xs text-muted-foreground mb-2">
                {sheet.category} · {sheet.rowCount} × {sheet.colCount}
              </div>
              <ExcelGrid cellData={sheet.cellData} searchTerm={searchTerm} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}

function ExcelGrid({ cellData, searchTerm }: { cellData: string[][]; searchTerm: string }) {
  const search = searchTerm.toLowerCase().trim()

  const highlightCell = (val: string): React.ReactNode => {
    if (!search || !val) return val
    const lower = val.toLowerCase()
    const idx = lower.indexOf(search)
    if (idx === -1) return val
    return (
      <>
        {val.slice(0, idx)}
        <mark className="bg-yellow-200 dark:bg-yellow-700/60 dark:text-yellow-50 px-0.5">
          {val.slice(idx, idx + search.length)}
        </mark>
        {val.slice(idx + search.length)}
      </>
    )
  }

  const isMatchingRow = (row: string[]): boolean => {
    if (!search) return true
    return row.some((c) => c && c.toLowerCase().includes(search))
  }

  if (!cellData || cellData.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">Pas de données</p>
  }

  return (
    <div className="border rounded-lg overflow-auto max-h-[70vh]">
      <table className="text-sm w-full border-collapse">
        <tbody>
          {cellData.map((row, rIdx) => {
            const matches = isMatchingRow(row)
            return (
              <tr
                key={rIdx}
                className={`${search && !matches ? 'opacity-30' : ''} ${
                  rIdx === 0 ? 'bg-muted font-semibold' : 'hover:bg-primary/5'
                }`}
              >
                <td className="border border-border px-2 py-1 text-xs text-muted-foreground sticky left-0 bg-muted/50 font-mono">
                  {rIdx + 1}
                </td>
                {row.map((cell, cIdx) => {
                  const isError = cell?.startsWith('#')
                  return (
                    <td
                      key={cIdx}
                      className={`border border-border px-2 py-1 whitespace-nowrap ${
                        isError ? 'text-red-400 italic text-xs' : ''
                      }`}
                    >
                      {isError ? '' : highlightCell(cell || '')}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function WorkflowPanel({
  approvals,
  history,
  requiresApproval,
  status,
}: {
  approvals: Approval[]
  history: HistoryEntry[]
  requiresApproval: boolean
  status: string
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Approbations
            {requiresApproval && (
              <Badge variant="outline" className="text-[10px]">
                4 yeux requis
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!requiresApproval && (
            <p className="text-xs text-muted-foreground mb-3">
              Ce barème ne requiert pas de double approbation — la publication directe est autorisée.
            </p>
          )}
          {approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune approbation enregistrée pour le moment.
            </p>
          ) : (
            <ul className="space-y-3">
              {approvals.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div>
                      <span className="font-medium">{a.approverName ?? a.approverEmail}</span>
                      {a.approverName && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {a.approverEmail}
                        </span>
                      )}
                    </div>
                    {a.comment && (
                      <p className="text-xs text-muted-foreground mt-0.5">« {a.comment} »</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(a.createdAt).toLocaleString('fr-BE')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {requiresApproval && (status === 'draft' || status === 'pending_approval') && (
            <div className="mt-4 p-3 rounded-md bg-muted/40 text-xs">
              <p>
                <strong>{Math.max(0, 2 - approvals.length)}</strong> approbation(s)
                supplémentaire(s) requise(s) pour publication automatique.
              </p>
              <p className="text-muted-foreground mt-1">
                Un approbateur ne peut approuver qu&apos;une fois. Il faut deux admins distincts.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historique</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun événement enregistré.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-start gap-3 pb-2 border-b last:border-0">
                  <div className="text-[10px] text-muted-foreground font-mono shrink-0 w-24 pt-0.5">
                    {new Date(h.createdAt).toLocaleString('fr-BE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <ActionBadge action={h.action} />
                      {h.fromStatus && h.toStatus && h.fromStatus !== h.toStatus && (
                        <span className="text-xs text-muted-foreground">
                          {h.fromStatus} → {h.toStatus}
                        </span>
                      )}
                    </div>
                    {h.actorEmail && (
                      <p className="text-xs text-muted-foreground mt-0.5">par {h.actorEmail}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const tones: Record<string, string> = {
    created: 'bg-blue-100 text-blue-900',
    published: 'bg-green-100 text-green-900',
    force_published: 'bg-yellow-100 text-yellow-900',
    rejected: 'bg-red-100 text-red-900',
    archived: 'bg-muted text-muted-foreground',
    rollback: 'bg-purple-100 text-purple-900',
    approved: 'bg-green-50 text-green-700',
    submitted_for_approval: 'bg-orange-100 text-orange-900',
  }
  const tone = tones[action] ?? 'bg-muted'
  return (
    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${tone}`}>
      {action.replace(/_/g, ' ')}
    </span>
  )
}
