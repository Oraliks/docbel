'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  Loader2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Search,
  AlertCircle,
} from 'lucide-react'

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
            <BureauCard
              title="Organisme de paiement"
              bureau={data.attitre.organismePaiement}
            />
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

function BureauCard({
  title,
  bureau,
}: {
  title: string
  bureau: BureauResult | null
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
            {title}
          </span>
          {bureau?.organismeName && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono"
              style={
                bureau.organismeColor
                  ? { borderColor: bureau.organismeColor, color: bureau.organismeColor }
                  : undefined
              }
            >
              {bureau.organismeName}
            </Badge>
          )}
        </div>
        {bureau ? (
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
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">Aucun bureau attitré trouvé.</p>
        )}
      </CardContent>
    </Card>
  )
}
