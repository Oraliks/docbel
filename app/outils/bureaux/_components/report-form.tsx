'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  bureauId: string
  onClose: () => void
}

/**
 * Formulaire inline de signalement d'erreur sur un bureau spécifique.
 * Catégorie + message libre + email optionnel. Soumis via POST
 * /api/bureaux/[id]/report.
 */
export function ReportForm({ bureauId, onClose }: Props) {
  const [category, setCategory] = useState<
    'hours' | 'address' | 'phone' | 'closed' | 'other'
  >('hours')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (message.trim().length < 5) {
      setErr('Décris l’erreur en quelques mots (5 caractères minimum).')
      return
    }
    setSubmitting(true)
    setErr(null)
    try {
      const res = await fetch(`/api/bureaux/${bureauId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: message.trim(),
          reporterEmail: email.trim() || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Échec')
      setDone(true)
      setTimeout(onClose, 1500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">
        ✓ Merci, signalement transmis.
      </div>
    )
  }

  return (
    <div className="border rounded p-2 space-y-1.5 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Signaler une erreur
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
        <option value="hours">Horaires incorrects</option>
        <option value="address">Adresse incorrecte</option>
        <option value="phone">Téléphone incorrect</option>
        <option value="closed">Bureau fermé / déplacé</option>
        <option value="other">Autre</option>
      </select>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Décris l’erreur (ex: le bureau ferme à 16h, pas 17h)"
        rows={2}
        maxLength={1000}
        className="w-full text-[11px] border rounded px-1.5 py-1 bg-background resize-none"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Ton email (optionnel, pour suivi)"
        className="w-full text-[11px] border rounded px-1.5 py-1 bg-background"
      />
      {err && <p className="text-[10px] text-red-600">{err}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full text-[11px] bg-primary text-primary-foreground rounded py-1 hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Envoi…' : 'Envoyer le signalement'}
      </button>
      {bureauId && null /* id silently used in submit; placeholder to satisfy lint */}
    </div>
  )
}
