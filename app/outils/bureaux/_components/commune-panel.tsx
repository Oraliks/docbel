'use client'

import { Card, CardContent } from '@/components/ui/card'
import { MapPin } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Skeleton } from '@/components/ui/skeleton'
import { displayBureauName, type BureauResult, type CommuneSummary } from './types'

// Carte SVG (d3-geo + topojson, ~120 Ko) : client-only (ResizeObserver/DOM) et
// sous la ligne de flottaison. dynamic ssr:false la sort du bundle initial de la
// page publique /outils/bureaux. Fallback dimensionné (~420px) → pas de CLS.
const CustomBelgiumMap = dynamic(
  () =>
    import('./custom-belgium-map').then((m) => ({ default: m.CustomBelgiumMap })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[420px] w-full rounded-xl" />,
  }
)

/** Mapping resilient des valeurs region stockées en DB (minuscules anglais
 * via le seed REFNIS) vers une clé i18n. Fallback : null → on affiche la
 * valeur brute (mieux que de cacher silencieusement). */
function regionLabelKey(raw: string): string | null {
  const map: Record<string, string> = {
    brussels: 'regionBrussels',
    wallonia: 'regionWallonia',
    flanders: 'regionFlanders',
    germanophone: 'regionGermanophone',
    // Anciens codes au cas où il en reste en DB
    bru: 'regionBrussels',
    wal: 'regionWallonia',
    fla: 'regionFlanders',
  }
  return map[raw.toLowerCase()] ?? null
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
  const t = useTranslations('public.outils')
  const validBureaux = bureaux.filter((b): b is BureauResult => !!b)

  // Couleurs des dots sur la map. Contrainte : aucune collision visuelle
  // avec les 4 OP (CAPAC orange, FGTB rouge, CSC vert, SYNOVA bleu) ni
  // avec le centroïde commune (violet primary).
  //  - ONEM    : anthracite (sobre, "officiel", distinct de toutes les
  //              couleurs OP — le rouge clair précédent #F87171 était
  //              trop proche de l'orange CAPAC #F58220)
  //  - CPAS    : gris neutre
  //  - COMMUNE : blanc (stroke pour visibilité sur fond clair)
  //  - SYNDICAT: couleur de l'organisme (FGTB rouge, CSC vert, SYNOVA
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
      // bleues qui collidaient avec SYNOVA (cf. bug visible : 2 dots bleus
      // ONEM + SYNOVA indistinguables).
      //
      // Pour SYNDICAT on prend organismeColor (couleur officielle de chaque
      // OP : CAPAC orange, FGTB rouge, CSC vert, SYNOVA bleu).
      const color =
        b.type === 'SYNDICAT'
          ? (b.organismeColor ?? TYPE_COLOR.SYNDICAT)
          : (TYPE_COLOR[b.type] ?? '#7c3aed')
      return {
        id: b.id,
        // displayBureauName : "BRUXELLES" → "ONEM de Bruxelles" pour
        // que le tooltip du dot soit aussi clair que la card.
        name: displayBureauName(b),
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
    // h-full : la div racine prend toute la hauteur du parent (qui est
    // stretch via grid items-stretch dans bureaux-finder). La Card hérite
    // de cette hauteur, et le conteneur de la map prend tout l'espace
    // restant après le bloc titre (flex-1).
    <div className="h-full">
      <Card className="h-full flex flex-col">
        <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                {t('communeZoneEyebrow')}
              </p>
              <h2 className="text-lg font-semibold mt-0.5 truncate">
                {commune?.nameFr ?? '—'}
              </h2>
              {commune?.region && (
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const key = regionLabelKey(commune.region)
                    return key
                      ? t(key as Parameters<typeof t>[0])
                      : commune.region
                  })()}
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
                {t('communeBureauxOnMap', { count: geolocCount })}
              </p>
            )}
          </div>

          {/* min-h-[420px] : garantit une hauteur lisible même si la
              colonne droite est très courte. Le ResizeObserver dans
              CustomBelgiumMap détecte la vraie taille et reprojette. */}
          <div className="flex-1 min-h-[420px] -mx-4 -mb-4">
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
