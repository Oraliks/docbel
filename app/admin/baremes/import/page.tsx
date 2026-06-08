'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useTranslations } from 'next-intl'

export default function ImportBaremePage() {
  const t = useTranslations('admin.baremes')
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [requiresApproval, setRequiresApproval] = useState(false)

  const handleFile = async (file: File | null) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error(t('onlyXlsx'))
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t('fileTooLarge'))
      return
    }

    setUploading(true)
    setProgress(t('progressHashing'))
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
        toast.info(data.message ?? t('alreadyImported'))
        router.push(`/admin/baremes/import/${data.fileId}`)
        return
      }

      if (!res.ok) {
        throw new Error(data.error ?? t('importFailed'))
      }

      toast.success(
        t('importCreated', { count: data.summary?.amountsExtracted ?? 0 })
      )
      router.push(`/admin/baremes/import/${data.fileId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('importFailed')
      toast.error(message)
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/admin/baremes"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('backToBaremes')}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{t('importTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.rich('importIntro', { strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </div>
      </div>

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drop zone — 2 colonnes */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('sourceFile')}</CardTitle>
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
                  {uploading ? t('analyzing') : t('dropHere')}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  {progress ?? t('orSelectFile')}
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
                    {t('chooseFile')}
                  </Button>
                </label>
              </div>

              {/* Options avant upload */}
              <div className="mt-4 flex items-start gap-3 p-3 rounded-md border bg-muted/30">
                <Checkbox
                  id="requiresApproval"
                  checked={requiresApproval}
                  onCheckedChange={(checked) => setRequiresApproval(checked === true)}
                  disabled={uploading}
                  className="mt-0.5"
                />
                <label htmlFor="requiresApproval" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">{t('requireApprovalLabel')}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('requireApprovalDescription')}
                  </p>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
                <InfoTile
                  icon={<Shield className="w-4 h-4" />}
                  title={t('tileHashTitle')}
                  body={t('tileHashBody')}
                />
                <InfoTile
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  title={t('tileDraftTitle')}
                  body={t('tileDraftBody')}
                />
                <InfoTile
                  icon={<AlertTriangle className="w-4 h-4" />}
                  title={t('tileAlertsTitle')}
                  body={t('tileAlertsBody')}
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
                {t('pipelineTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <Step n={1} label={t('pipelineStep1')} />
                <Step n={2} label={t('pipelineStep2')} />
                <Step n={3} label={t('pipelineStep3')} />
                <Step n={4} label={t('pipelineStep4')} />
                <Step n={5} label={t('pipelineStep5')} />
                <Step n={6} label={t('pipelineStep6')} />
                <Step n={7} label={t('pipelineStep7')} />
                <Step n={8} label={t('pipelineStep8')} />
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('managedSheetsTitle')}</CardTitle>
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
                {t('managedSheetsFooter')}
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
