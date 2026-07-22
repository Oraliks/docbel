'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { useReportSubmit } from '@/components/reports/use-report-submit'

interface Props {
  bureauId: string
  onClose: () => void
}

/**
 * Formulaire inline de signalement d'erreur sur un bureau spécifique.
 * Catégorie + message libre + email optionnel. Soumis via le moteur
 * unifié /api/reports (type "bureau").
 */
export function ReportForm({ bureauId, onClose }: Props) {
  const t = useTranslations('public.outils')
  const [category, setCategory] = useState<
    'hours' | 'address' | 'phone' | 'closed' | 'other'
  >('hours')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const { submit, status } = useReportSubmit('bureau')
  const submitting = status === 'submitting'
  const done = status === 'done'

  const handleSubmit = async () => {
    if (message.trim().length < 5) {
      setErr(t('rfErrTooShort'))
      return
    }
    setErr(null)
    const result = await submit({
      targetId: bureauId,
      message: message.trim(),
      payload: { category },
      reporterEmail: email.trim() || undefined,
    })
    if (result.ok) {
      setTimeout(onClose, 1500)
    } else {
      setErr(result.error)
    }
  }

  if (done) {
    return (
      <div className="text-[11px] text-[color:var(--glass-success-ink)] bg-[color:var(--glass-success-surface)] border border-[color:var(--glass-success-border)] rounded px-2 py-1.5">
        {t('rfSubmittedConfirm')}
      </div>
    )
  }

  return (
    <div className="border rounded p-2 space-y-1.5 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('rfTitle')}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as typeof category)}
        className="w-full text-[11px] border rounded px-1.5 py-1 bg-background"
      >
        <option value="hours">{t('rfCatHours')}</option>
        <option value="address">{t('rfCatAddress')}</option>
        <option value="phone">{t('rfCatPhone')}</option>
        <option value="closed">{t('rfCatClosed')}</option>
        <option value="other">{t('rfCatOther')}</option>
      </select>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t('rfMessagePlaceholder')}
        rows={2}
        maxLength={1000}
        className="w-full text-[11px] border rounded px-1.5 py-1 bg-background resize-none"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('rfEmailPlaceholder')}
        className="w-full text-[11px] border rounded px-1.5 py-1 bg-background"
      />
      {err && <p className="text-[10px] text-[color:var(--destructive)]">{err}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full text-[11px] bg-primary text-primary-foreground rounded py-1 hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? t('rfSubmitting') : t('rfSubmit')}
      </button>
      {bureauId && null /* id silently used in submit; placeholder to satisfy lint */}
    </div>
  )
}
