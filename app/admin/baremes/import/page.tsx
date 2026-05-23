'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Upload,
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  Info,
  AlertTriangle,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'

export default function ImportBaremePage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [requiresApproval, setRequiresApproval] = useState(false)

  const handleFile = async (file: File | null) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Seuls les fichiers .xlsx sont acceptés')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 20 MB)')
      return
    }

    setUploading(true)
    setProgress('Calcul du hash + analyse du workbook…')
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (requiresApproval) formData.append('requiresApproval', 'true')

      const res = await fetch('/api/baremes/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.status === 409 && data.fileId) {
        toast.info(data.message ?? 'Fichier déjà importé')
        router.push(`/admin/baremes/import/${data.fileId}`)
        return
      }

      if (!res.ok) {
        throw new Error(data.error ?? 'Échec de l’import')
      }

      toast.success(
        `Import créé en brouillon — ${data.summary?.amountsExtracted ?? 0} montants extraits`
      )
      router.push(`/admin/baremes/import/${data.fileId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de l’import'
      toast.error(message)
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/admin/baremes"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux barèmes
          </Link>
          <h1 className="text-2xl font-bold">Nouvel import de barème</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload d’un fichier Excel officiel (.xlsx). L’import est créé en{' '}
            <strong>brouillon</strong>: aperçu et validation manuelle avant publication.
          </p>
        </div>
      </div>

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drop zone — 2 colonnes */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Fichier source</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files?.[0] ?? null
                  void handleFile(file)
                }}
                className={`border-2 border-dashed rounded-lg p-16 text-center transition ${
                  dragOver ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'
                } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <FileSpreadsheet className="mx-auto w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  {uploading ? 'Analyse en cours…' : 'Glissez votre fichier .xlsx ici'}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  {progress ?? 'ou sélectionnez un fichier depuis votre disque'}
                </p>
                <label className="inline-block cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0] ?? null
                      void handleFile(file)
                      e.currentTarget.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    size="lg"
                    disabled={uploading}
                    render={<span />}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choisir un fichier
                  </Button>
                </label>
              </div>

              {/* Options avant upload */}
              <div className="mt-4 flex items-start gap-3 p-3 rounded-md border bg-muted/30">
                <input
                  id="requiresApproval"
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  disabled={uploading}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <label htmlFor="requiresApproval" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">Exiger une double approbation</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Workflow 4 yeux : 2 administrateurs distincts devront approuver avant publication.
                    Recommandé pour les barèmes pilotant des génération de documents officiels.
                  </p>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
                <InfoTile
                  icon={<Shield className="w-4 h-4" />}
                  title="Hash sha256"
                  body="Calculé automatiquement pour détecter les doublons. Un fichier identique ne peut être ré-importé."
                />
                <InfoTile
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  title="Statut draft"
                  body="L’import démarre en brouillon. Rien n’est exposé aux calculateurs avant publication explicite."
                />
                <InfoTile
                  icon={<AlertTriangle className="w-4 h-4" />}
                  title="Alertes non bloquantes"
                  body="Les onglets non gérés ou cellules suspectes sont signalés mais l’import continue."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar info — 1 colonne */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                Pipeline d’import
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <Step n={1} label="Vérification du type .xlsx (max 20 MB)" />
                <Step n={2} label="Calcul du hash sha256 → détection doublon" />
                <Step n={3} label="Lecture du workbook (SheetJS)" />
                <Step n={4} label="Dispatch vers les parsers dédiés selon l’onglet" />
                <Step n={5} label="Normalisation des montants (virgules, espaces, codes)" />
                <Step n={6} label="Stockage en transaction (BaremeFile + BaremeAmount)" />
                <Step n={7} label="Comparaison automatique vs dernier publié" />
                <Step n={8} label="Redirection vers la preview pour validation" />
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Onglets gérés en V1</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs font-mono">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                  <span>A_N_B_vol_plein <span className="text-muted-foreground">→ full_unemployment</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                  <span>A_N_B_half_demi <span className="text-muted-foreground">→ half_unemployment</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                  <span>Loonschijven_Tranches… <span className="text-muted-foreground">→ salary_bracket</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                  <span>Basisbedragen <span className="text-muted-foreground">→ basic_amount</span></span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                Les autres onglets sont conservés en vue grille brute et signalés en alerte info.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function InfoTile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="border rounded-md p-3 bg-muted/30">
      <div className="flex items-center gap-2 font-medium mb-1">
        {icon}
        {title}
      </div>
      <p className="text-muted-foreground leading-relaxed">{body}</p>
    </div>
  )
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-xs font-medium flex items-center justify-center">
        {n}
      </span>
      <span className="text-muted-foreground leading-snug">{label}</span>
    </li>
  )
}
