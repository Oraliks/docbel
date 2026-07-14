// app/outils/bureaux/_components/office-map-types.ts

/**
 * Interface d'isolation carto du finder de bureaux (`app/outils/bureaux`).
 *
 * `OfficeMap` (`./office-map.tsx`) est l'UNIQUE point de couplage avec une
 * implémentation cartographique concrète (aujourd'hui `CustomBelgiumMap`,
 * SVG d3-geo/topojson ; demain, si besoin, Mapbox/MapLibre). L'orchestrateur
 * et le reste de l'écran ne connaissent QUE les deux interfaces de ce
 * fichier : tous les champs arrivent déjà résolus (i18n, formatage). Ce
 * fichier ne dépend d'aucun type métier (`OfficeItem` / `BureauResult` /
 * `RankedOffice`) — remplacer l'implémentation carto ne doit jamais
 * nécessiter de toucher ni l'orchestrateur, ni ce contrat.
 */

/** Un marqueur carte déjà résolu pour l'affichage — jamais de donnée brute. */
export interface OfficeMapMarker {
  id: string
  /** Rang partagé liste ↔ carte (1 = bureau recommandé). */
  number: number
  /** Bureau n°1 recommandé pour la démarche en cours. */
  recommended: boolean
  /** `null` = coordonnées inconnues. Un marqueur sans coordonnées ne doit
   *  JAMAIS être placé sur la carte à une position inventée : `OfficeMap`
   *  le filtre et signale son existence via une note honnête. */
  lat: number | null
  lng: number | null
  /** Couleur catégorielle (registre `TYPE_META`) : pin + accents popup. */
  color: string
  /** Nom du bureau. */
  label: string
  /** Libellé du type d'organisme déjà traduit (ex. « ONEM »). */
  typeLabel: string
  /** Adresse complète déjà formatée. */
  address: string
  /** Statut d'ouverture déjà traduit (ex. « Ouvert »), `null` si aucune
   *  donnée horaire connue pour ce bureau (jamais un statut inventé). */
  statusLabel: string | null
  /** Distance déjà formatée (ex. « 1,2 km »), `null` si non calculable
   *  (pas de position de référence ou pas de coordonnées bureau). */
  distanceLabel: string | null
}

/** Props du composant `OfficeMap` — jamais de type métier au-delà de cette forme. */
export interface OfficeMapProps {
  markers: OfficeMapMarker[]
  /** Centre de repli si la commune sélectionnée ne matche pas. */
  center: { lat: number; lng: number } | null
  /** insCode de la commune sélectionnée (zoom/contour carte). */
  selectedInsCode: string | null
  /** Id du marqueur sélectionné : synchronise liste ↔ carte ↔ popup. */
  selectedId: string | null
  /** Nom de la zone affiché dans l'en-tête intégré (ex. commune). */
  zoneLabel: string
  /** Nombre de résultats affiché dans l'en-tête intégré. */
  resultCount: number
  /** Survol d'un marqueur (`null` = fin de survol) — sync avec la liste. */
  onHover: (id: string | null) => void
  /** Sélection d'un marqueur (clic pin) — sync avec la liste. */
  onSelect: (id: string) => void
  /** Depuis la popup : ouvre la fiche détaillée du bureau. */
  onView: (id: string) => void
}
