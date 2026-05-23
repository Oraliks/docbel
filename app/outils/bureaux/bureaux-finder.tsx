'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Building2,
  Loader2,
  MapPin,
  Search,
  AlertCircle,
  Users,
  Wallet,
  Briefcase,
} from 'lucide-react'

import { BureauCard } from './_components/bureau-card'
import { OpTabsCard } from './_components/op-tabs-card'
import { CommunePanel } from './_components/commune-panel'
import { DemarcheSelector } from './_components/demarche-selector'
import {
  GeolocBanner,
  haversineKm,
  type UserGeoloc,
} from './_components/geoloc-banner'
import { InfoBands } from './_components/info-bands'
import { MobileMapSheet } from './_components/mobile-map-sheet'
import {
  type ResolveResponse,
  type DemarcheKey,
  type BureauResult,
  recommendedBureauType,
} from './_components/types'

/**
 * Orchestrateur du finder de bureaux. Layout :
 *
 *  [Search bar (CP)]
 *  [Banner géoloc] (dismissible)
 *  [Sélecteur démarche]
 *
 *  ┌────────────────┬────────────────────────────────┐
 *  │  CommunePanel  │  4 cards (ONEM / CPAS / Commune│
 *  │  (map + info)  │  + OP tabs)                    │
 *  └────────────────┴────────────────────────────────┘
 *
 *  [4 InfoBands en bas]
 *
 * Persist : ?cp=, ?for= (démarche) → bookmarkable / shareable.
 */
export function BureauxFinder() {
  const router = useRouter()
  const params = useSearchParams()

  const [cp, setCp] = useState(params?.get('cp') ?? '')
  const [demarche, setDemarche] = useState<DemarcheKey | null>(
    (params?.get('for') as DemarcheKey) || null
  )
  const [userGeoloc, setUserGeoloc] = useState<UserGeoloc | null>(null)
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

  // Debounce + sync URL
  useEffect(() => {
    const t = setTimeout(() => {
      void resolve(cp.trim())
      // Sync URL
      const usp = new URLSearchParams(params?.toString() ?? '')
      if (cp.trim()) usp.set('cp', cp.trim())
      else usp.delete('cp')
      if (demarche) usp.set('for', demarche)
      else usp.delete('for')
      const qs = usp.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp, demarche, resolve])

  // Référence pour calculer les distances : géoloc si dispo, sinon centroïde commune
  const distanceRef = useMemo(() => {
    if (userGeoloc) return userGeoloc
    if (data?.commune?.lat != null && data?.commune?.lng != null) {
      return { lat: data.commune.lat, lng: data.commune.lng }
    }
    return null
  }, [userGeoloc, data?.commune])

  const distance = useCallback(
    (b: BureauResult | null): number | null => {
      if (!b || b.lat === null || b.lng === null || !distanceRef) return null
      return haversineKm(distanceRef, { lat: b.lat, lng: b.lng })
    },
    [distanceRef]
  )

  const recommendedType = recommendedBureauType(demarche)
  const recoReason =
    demarche === 'chomage'
      ? 'pour ta démarche chômage'
      : demarche === 'aide_sociale'
        ? 'pour ta démarche aide sociale'
        : undefined

  const showResults = !!data && !loading

  return (
    <div className="space-y-4 w-full">
      {/* Recherche CP */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="Code postal (ex: 1000 pour Bruxelles)"
              value={cp}
              onChange={(e) => setCp(e.target.value.replace(/\D/g, ''))}
              className="pl-9 text-base h-11"
              autoFocus
            />
          </div>
        </CardContent>
      </Card>

      {/* Géoloc + démarche */}
      <div className="flex flex-col gap-3">
        <GeolocBanner onLocated={setUserGeoloc} located={userGeoloc} />
        <DemarcheSelector value={demarche} onChange={setDemarche} />
      </div>

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

      {showResults && data && (
        <>
          {/* Warnings techniques (CP pas en DB, fallback, etc.) */}
          {data.warnings.length > 0 && (
            <Card className="border-orange-300 bg-orange-50/60 dark:bg-orange-950/10">
              <CardContent className="p-3 text-xs text-orange-900 dark:text-orange-200 space-y-1">
                {data.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Layout 2 colonnes : map gauche, cards droite (mobile : map dans Sheet) */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-4">
            {/* Desktop : map à gauche */}
            <div className="hidden lg:block lg:sticky lg:top-4 lg:self-start">
              <CommunePanel
                commune={data.commune}
                bureaux={[
                  data.attitre.cpas,
                  data.attitre.commune,
                  data.attitre.onem,
                  ...data.attitre.organismesPaiement.slice(0, 1),
                ]}
              />
            </div>
            {/* Mobile : bouton Sheet */}
            <div className="lg:hidden">
              <MobileMapSheet
                commune={data.commune}
                bureaux={[
                  data.attitre.cpas,
                  data.attitre.commune,
                  data.attitre.onem,
                  ...data.attitre.organismesPaiement.slice(0, 1),
                ]}
              />
            </div>

            {/* Cards droite */}
            <div className="space-y-3">
              <BureauCard
                title="ONEM (chômage)"
                icon={<Briefcase className="w-3.5 h-3.5" />}
                bureau={data.attitre.onem}
                distanceKm={distance(data.attitre.onem)}
                fromUserLocation={!!userGeoloc}
                recommended={recommendedType === 'ONEM'}
                recommendedReason={recoReason}
              />
              <BureauCard
                title="CPAS"
                icon={<Users className="w-3.5 h-3.5" />}
                bureau={data.attitre.cpas}
                distanceKm={distance(data.attitre.cpas)}
                fromUserLocation={!!userGeoloc}
                recommended={recommendedType === 'CPAS'}
                recommendedReason={recoReason}
              />
              <BureauCard
                title="Maison communale"
                icon={<Building2 className="w-3.5 h-3.5" />}
                bureau={data.attitre.commune}
                distanceKm={distance(data.attitre.commune)}
                fromUserLocation={!!userGeoloc}
              />
              {data.attitre.organismesPaiement.length > 0 ? (
                <OpTabsCard
                  bureaux={data.attitre.organismesPaiement}
                  commune={data.commune}
                  userGeoloc={userGeoloc}
                />
              ) : (
                <BureauCard
                  title="Organisme de paiement"
                  icon={<Wallet className="w-3.5 h-3.5" />}
                  bureau={null}
                />
              )}
            </div>
          </div>

          {/* 4 bandes pédagogiques bas de page */}
          <InfoBands />
        </>
      )}

      {!loading && !data && cp.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <MapPin className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            Tape ton code postal pour voir les bureaux compétents pour ta commune.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
