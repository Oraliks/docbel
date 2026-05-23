'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Info, MapPin } from 'lucide-react'
import { CommuneFinderMap } from './commune-finder-map'
import type { BureauResult, CommuneSummary } from './types'

/** Mapping resilient des valeurs region stockées en DB (minuscules anglais
 * via le seed REFNIS) vers leur label FR. Fallback : on retourne la valeur
 * brute si pas reconnue (mieux que de cacher silencieusement). */
function regionLabel(raw: string): string {
  const map: Record<string, string> = {
    brussels: 'Région de Bruxelles-Capitale',
    wallonia: 'Région wallonne',
    flanders: 'Région flamande',
    germanophone: 'Communauté germanophone',
    // Anciens codes au cas où il en reste en DB
    bru: 'Région de Bruxelles-Capitale',
    wal: 'Région wallonne',
    fla: 'Région flamande',
  }
  return map[raw.toLowerCase()] ?? raw
}

interface Props {
  commune: CommuneSummary | null
  bureaux: (BureauResult | null)[]
}

/**
 * Panneau gauche du finder : carte agrandie avec les pins des bureaux trouvés,
 * + petit bloc "Bon à savoir" en dessous. Pas de stats grid (était trop vague).
 */
export function CommunePanel({ commune, bureaux }: Props) {
  const validBureaux = bureaux.filter((b): b is BureauResult => !!b)

  // Couleurs des pins par type bureau (cohérent avec les icônes des cards)
  const TYPE_COLOR: Record<string, string> = {
    ONEM: '#0050A0',
    CPAS: '#7c3aed',
    COMMUNE: '#059669',
    SYNDICAT: '#ea580c',
  }

  const mapBureaus = validBureaux
    .filter((b): b is BureauResult & { lat: number; lng: number } =>
      b.lat !== null && b.lng !== null
    )
    .map((b) => ({
      id: b.id,
      name: b.name,
      lat: b.lat,
      lng: b.lng,
      color: b.organismeColor ?? TYPE_COLOR[b.type] ?? '#7c3aed',
      type: b.type,
    }))

  const center =
    commune?.lat != null && commune?.lng != null
      ? { lat: commune.lat, lng: commune.lng }
      : null

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              Votre zone sélectionnée
            </p>
            <h2 className="text-lg font-semibold mt-0.5">
              {commune?.nameFr ?? '—'}
            </h2>
            {commune?.region && (
              <p className="text-xs text-muted-foreground">
                {regionLabel(commune.region)}
                {commune.province && commune.region !== 'brussels' && (
                  <> · {commune.province}</>
                )}
              </p>
            )}
          </div>

          <div className="h-[420px] -mx-4 -mb-4">
            <CommuneFinderMap
              center={center}
              communeName={commune?.nameFr ?? null}
              bureaus={mapBureaus}
              height={420}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/70" />
          <p>
            <strong className="text-foreground">Bon à savoir.</strong>{' '}
            Les horaires peuvent varier (jours fériés, ponts, fermetures
            exceptionnelles). Vérifie toujours par téléphone ou sur le site
            de l&apos;organisme avant de te déplacer.
          </p>
        </CardContent>
      </Card>

      {validBureaux.length > 0 && (
        <p className="text-[10px] text-muted-foreground/70 px-1 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {validBureaux.filter((b) => b.lat !== null).length} bureau
          {validBureaux.length > 1 ? 'x' : ''} géolocalisé
          {validBureaux.length > 1 ? 's' : ''} sur la carte
        </p>
      )}
    </div>
  )
}
