'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Info, MapPin } from 'lucide-react'
import { BureauMap } from '@/components/docbel/bureau-map'
import type { BureauResult, CommuneSummary } from './types'
import type { SerializedBureau } from '@/lib/bureaus/types'

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

  // Adapter BureauResult → SerializedBureau pour BureauMap. Le composant Map
  // ne lit que name / lat / lng / fullAddress / phone / website / organismeColor,
  // donc on remplit le minimum nécessaire et on cast pour le reste.
  const mapBureaus: SerializedBureau[] = validBureaux
    .filter((b) => b.lat !== null && b.lng !== null)
    .map((b) => ({
      id: b.id,
      type: b.type as SerializedBureau['type'],
      name: b.name,
      nameNl: null,
      nameDe: null,
      street: b.street,
      streetNum: b.streetNum,
      postalCode: b.postalCode,
      city: b.city,
      fullAddress: `${b.street}${b.streetNum ? ' ' + b.streetNum : ''}, ${b.postalCode} ${b.city}`,
      lat: b.lat,
      lng: b.lng,
      phone: b.phone,
      email: b.email,
      website: b.website,
      appointmentUrl: b.appointmentUrl,
      hours: b.hours,
      hoursNotes: b.hoursNotes,
      services: [],
      active: true,
      notes: null,
      verified: false,
      lastVerifiedAt: null,
      verifiedBy: null,
      updatedBy: null,
      organismeId: '',
      communeId: null,
      communeName: null,
      organismeName: b.organismeName,
      organismeCode: b.organismeCode,
      organismeColor: b.organismeColor,
      createdAt: '',
      updatedAt: '',
    }))

  const center =
    commune?.lat != null && commune?.lng != null
      ? { lat: commune.lat, lng: commune.lng }
      : undefined

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
                {commune.region === 'BRU'
                  ? 'Région de Bruxelles-Capitale'
                  : commune.region === 'WAL'
                    ? 'Région wallonne'
                    : commune.region === 'FLA'
                      ? 'Région flamande'
                      : commune.region}
              </p>
            )}
          </div>

          <div className="h-[420px] -mx-4 -mb-4">
            <BureauMap bureaus={mapBureaus} center={center} height={420} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/[0.03]">
        <CardContent className="p-3 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/70" />
          <p>
            <strong className="text-foreground">Bon à savoir.</strong> Les horaires
            peuvent varier (jours fériés, ponts, fermetures exceptionnelles).
            Vérifie toujours par téléphone ou sur le site de l&apos;organisme
            avant de te déplacer.
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
