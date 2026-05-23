'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Building2,
  Loader2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Search,
  AlertCircle,
  Clock,
  Flag,
  X,
} from 'lucide-react'

interface HourSlot {
  open: string
  close: string
}
interface DayHours {
  day: number
  slots: HourSlot[]
}

interface BureauResult {
  id: string
  type: string
  name: string
  street: string
  streetNum: string | null
  postalCode: string
  city: string
  phone: string | null
  email: string | null
  website: string | null
  appointmentUrl: string | null
  hours: DayHours[]
  hoursNotes: string | null
  // Champs à plat depuis serializeBureau (lib/bureaus/types.ts)
  organismeCode: string | null
  organismeName: string | null
  organismeColor: string | null
}

interface ResolveResponse {
  commune: { nameFr: string; province: string | null } | null
  attitre: {
    cpas: BureauResult | null
    commune: BureauResult | null
    onem: BureauResult | null
    organismePaiement: BureauResult | null
    organismesPaiement: BureauResult[]
    mutuelle: BureauResult | null
  }
  warnings: string[]
}

export function BureauxFinder() {
  const [cp, setCp] = useState('')
  const [data, setData] = useState<ResolveResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolve = useCallback(async (postalCode: string) => {
    if (!/^\d{4}$/.test(postalCode)) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bureaux/resolve?cp=${postalCode}`)
      if (!res.ok) throw new Error('Échec de la recherche')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => void resolve(cp.trim()), 350)
    return () => clearTimeout(t)
  }, [cp, resolve])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="Code postal (ex: 1000)"
              value={cp}
              onChange={(e) => setCp(e.target.value.replace(/\D/g, ''))}
              className="pl-9 text-lg"
              autoFocus
            />
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Recherche…
        </div>
      )}

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4 text-sm text-red-800">{error}</CardContent>
        </Card>
      )}

      {data && !loading && (
        <>
          {data.commune && (
            <div className="px-1 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 inline mr-1" />
              <strong>{data.commune.nameFr}</strong>
              {data.commune.province && ` (${data.commune.province})`}
            </div>
          )}

          {data.warnings.length > 0 && (
            <Card className="border-orange-300 bg-orange-50">
              <CardContent className="p-3 text-xs text-orange-900 space-y-1">
                {data.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <BureauCard title="ONEM (chômage)" bureau={data.attitre.onem} />
            <BureauCard title="CPAS" bureau={data.attitre.cpas} />
            <BureauCard title="Commune" bureau={data.attitre.commune} />
            {data.attitre.organismesPaiement.length > 0 ? (
              <OrganismesPaiementTabs bureaux={data.attitre.organismesPaiement} />
            ) : (
              <BureauCard title="Organisme de paiement" bureau={null} />
            )}
          </div>
        </>
      )}

      {!loading && !data && cp.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            Tape ton code postal pour voir les bureaux compétents.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Tabs des 4 OPs (CAPAC, FGTB, CSC, CGSLB). L'utilisateur choisit son organisme
 * d'affiliation et voit le bureau compétent. Pas de défaut côté site public.
 */
function OrganismesPaiementTabs({ bureaux }: { bureaux: BureauResult[] }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [showReport, setShowReport] = useState(false)
  // Ordre canonique : CAPAC, FGTB, CSC, CGSLB
  const orderedCodes = ['capac', 'fgtb', 'csc', 'cgslb']
  const sorted = [...bureaux].sort(
    (a, b) =>
      orderedCodes.indexOf(a.organismeCode ?? '') -
      orderedCodes.indexOf(b.organismeCode ?? '')
  )
  const active = sorted[activeIdx] ?? sorted[0]
  if (!active) return null
  // Change de tab → ferme le formulaire de signalement
  const switchTab = (i: number) => {
    setActiveIdx(i)
    setShowReport(false)
  }
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
            Organisme de paiement
          </span>
          <FlagToggle active={showReport} onToggle={() => setShowReport((v) => !v)} />
        </div>
        <div className="flex flex-wrap gap-1">
          {sorted.map((b, i) => {
            const isActive = i === activeIdx
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => switchTab(i)}
                className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-muted'
                }`}
                style={
                  isActive && b.organismeColor
                    ? { backgroundColor: b.organismeColor, borderColor: b.organismeColor, color: '#fff' }
                    : undefined
                }
              >
                {b.organismeName ?? b.organismeCode}
              </button>
            )
          })}
        </div>
        {showReport ? (
          <ReportForm bureauId={active.id} onClose={() => setShowReport(false)} />
        ) : (
          <BureauCardContent bureau={active} />
        )}
      </CardContent>
    </Card>
  )
}

function BureauCard({
  title,
  bureau,
}: {
  title: string
  bureau: BureauResult | null
}) {
  const [showReport, setShowReport] = useState(false)
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
            {title}
          </span>
          {bureau && (
            <FlagToggle active={showReport} onToggle={() => setShowReport((v) => !v)} />
          )}
        </div>
        {showReport && bureau ? (
          <ReportForm bureauId={bureau.id} onClose={() => setShowReport(false)} />
        ) : (
          <BureauCardContent bureau={bureau} />
        )}
      </CardContent>
    </Card>
  )
}

function FlagToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? 'Fermer le signalement' : 'Signaler une erreur'}
      aria-label={active ? 'Fermer le signalement' : 'Signaler une erreur'}
      className="text-red-600 hover:text-red-700 transition-colors"
    >
      {active ? <X className="w-4 h-4" /> : <Flag className="w-4 h-4" />}
    </button>
  )
}

function BureauCardContent({ bureau }: { bureau: BureauResult | null }) {
  if (!bureau) {
    return (
      <p className="text-xs text-muted-foreground italic">Aucun bureau attitré trouvé.</p>
    )
  }
  return (
    <>
      <h3 className="text-sm font-semibold">{bureau.name}</h3>
      <p className="text-xs text-muted-foreground">
        {bureau.street}
        {bureau.streetNum ? ` ${bureau.streetNum}` : ''}
        <br />
        {bureau.postalCode} {bureau.city}
      </p>
      <div className="flex flex-wrap gap-3 text-xs pt-1">
        {bureau.phone && (
          <a href={`tel:${bureau.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Phone className="w-3 h-3" /> {bureau.phone}
          </a>
        )}
        {bureau.email && (
          <a href={`mailto:${bureau.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Mail className="w-3 h-3" /> {bureau.email}
          </a>
        )}
        {bureau.website && (
          <a href={bureau.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            <Globe className="w-3 h-3" /> Site
          </a>
        )}
      </div>
      <BureauHours hours={bureau.hours} notes={bureau.hoursNotes} type={bureau.type} />
    </>
  )
}

const DAY_LABELS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']

function BureauHours({
  hours,
  notes,
  type,
}: {
  hours: DayHours[]
  notes: string | null
  type: string
}) {
  // Pour ONEM et organismes de paiement, on sait que c'est fermé le weekend
  // → on masque pour pas polluer. Pour COMMUNE on garde (parfois ouvert sam).
  const hideWeekend = type !== 'COMMUNE' && type !== 'CPAS'
  const days = (hours ?? []).filter((d) => {
    if (hideWeekend && (d.day === 0 || d.day === 6)) return false
    return true
  })
  // Masque la section entière si on n'a aucune vraie donnée horaire (pas juste
  // des jours vides) → "pas d'info" plutôt que "Fermé" partout.
  const hasRealData = days.some((d) => d.slots.length > 0)
  if (!hasRealData) return null
  const sorted = [...days].sort((a, b) => {
    const ka = a.day === 0 ? 7 : a.day
    const kb = b.day === 0 ? 7 : b.day
    return ka - kb
  })
  return (
    <div className="pt-2 border-t">
      <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
        <Clock className="w-3 h-3" /> Horaires
      </div>
      <ul className="text-[11px] text-muted-foreground space-y-0.5">
        {sorted.map((d) => (
          <li key={d.day} className="flex gap-2">
            <span className="w-9 shrink-0 font-medium">{DAY_LABELS[d.day]}</span>
            <span>
              {d.slots.length === 0
                ? 'Fermé'
                : d.slots.map((s) => `${s.open} – ${s.close}`).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
      {notes && <p className="text-[10px] text-muted-foreground italic mt-1">{notes}</p>}
    </div>
  )
}

function ReportForm({ bureauId, onClose }: { bureauId: string; onClose: () => void }) {
  const [category, setCategory] = useState<'hours' | 'address' | 'phone' | 'closed' | 'other'>('hours')
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
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
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
    </div>
  )
}
