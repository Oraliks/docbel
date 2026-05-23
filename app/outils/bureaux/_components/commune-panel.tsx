'use client'

import { Card, CardContent } from '@/components/ui/card'
import { MapPin } from 'lucide-react'
import { CustomBelgiumMap } from './custom-belgium-map'
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

  // Couleurs des dots sur la map. Contrainte : aucune collision visuelle
  // avec les 4 OP (CAPAC orange, FGTB rouge, CSC vert, CGSLB bleu) ni
  // avec le centroïde commune (violet primary).
  //  - ONEM    : anthracite (sobre, "officiel", distinct de toutes les
  //              couleurs OP — le rouge clair précédent #F87171 était
  //              trop proche de l'orange CAPAC #F58220)
  //  - CPAS    : gris neutre
  //  - COMMUNE : blanc (stroke pour visibilité sur fond clair)
  //  - SYNDICAT: couleur de l'organisme (FGTB rouge, CSC vert, CGSLB
  //              bleu, CAPAC orange — déjà dans organismeColor en DB)
  const TYPE_COLOR: Record<string, string> = {
    ONEM: '#1F2937', // gray-800 anthracite — distinct de tous les OP
    CPAS: '#9CA3AF', // gray-400
    COMMUNE: '#FFFFFF', // blanc, stroke géré côté Pin
    SYNDICAT: '#ea580c', // fallback si organismeColor manque
  }

  const mapBureaus = validBureaux
    .filter((b): b is BureauResult & { lat: number; lng: number } =>
      b.lat !== null && b.lng !== null
    )
    .map((b) => {
      // Pour ONEM/CPAS/COMMUNE on force TYPE_COLOR (rouge clair / gris /
      // blanc) — organismeColor en DB peut avoir des valeurs historiques
      // bleues qui collidaient avec CGSLB (cf. bug visible : 2 dots bleus
      // ONEM + CGSLB indistinguables).
      //
      // Pour SYNDICAT on prend organismeColor (couleur officielle de chaque
      // OP : CAPAC orange, FGTB rouge, CSC vert, CGSLB bleu).
      const color =
        b.type === 'SYNDICAT'
          ? (b.organismeColor ?? TYPE_COLOR.SYNDICAT)
          : (TYPE_COLOR[b.type] ?? '#7c3aed')
      return {
        id: b.id,
        name: b.name,
        lat: b.lat,
        lng: b.lng,
        color,
        type: b.type,
      }
    })

  const center =
    commune?.lat != null && commune?.lng != null
      ? { lat: commune.lat, lng: commune.lng }
      : null

  const geolocCount = validBureaux.filter((b) => b.lat !== null).length

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Votre zone sélectionnée
              </p>
              <h2 className="text-lg font-semibold mt-0.5 truncate">
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
            {/* Compteur de bureaux affichés sur la map, dans la même card
                pour rester collé à la carte (avant : phrase isolée plus bas) */}
            {geolocCount > 0 && (
              <p className="shrink-0 text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {geolocCount} bureau{geolocCount > 1 ? 'x' : ''} sur la carte
              </p>
            )}
          </div>

          <div className="h-[420px] -mx-4 -mb-4">
            <CustomBelgiumMap
              selectedInsCode={commune?.insCode ?? null}
              center={center}
              bureaus={mapBureaus}
              height={420}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
