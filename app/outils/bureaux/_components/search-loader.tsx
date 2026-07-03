'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MapPin, Navigation, Satellite, Compass } from 'lucide-react'

interface Props {
  /** CP en cours de recherche, pour personnaliser le message. */
  cp?: string
}

// Clés des phrases tournantes communes à tous les loaders — donnent
// l'impression de progression côté serveur et occupent l'œil pendant le fetch.
const MESSAGE_KEYS = [
  'loaderMsgCpas',
  'loaderMsgOnem',
  'loaderMsgCommune',
  'loaderMsgOp',
] as const

// Couleurs des 4 OP, réutilisées pour cohérence avec les dots de la map.
const OP_COLORS = {
  capac: '#F58220',
  fgtb: '#E30613',
  csc: '#008F4F',
  synova: '#0050A0',
}

/**
 * Orchestrateur : pioche un loader au hasard à chaque montage.
 *
 * Le useMemo avec deps [] garantit qu'on garde le même loader pour
 * toute la durée du chargement (pas de switch en cours). Comme le
 * composant unmount quand loading=false, chaque nouvelle recherche
 * tire un nouveau loader → variété sans répétition voulue.
 */
export function SearchLoader({ cp }: Props) {
  const Picked = useMemo(() => {
    const variants = [RadarLoader, GpsLoader, CompassLoader, PinDropLoader]
    return variants[Math.floor(Math.random() * variants.length)]
  }, [])
  return <Picked cp={cp} />
}

// ─────────────────────────────────────────────────────────────────
// Shell partagé : wrapper + phrases tournantes. Évite la duplication
// dans chaque variant.
// ─────────────────────────────────────────────────────────────────
function LoaderShell({ cp, children }: { cp?: string; children: React.ReactNode }) {
  const t = useTranslations('public.outils')
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const timer = setInterval(
      () => setIdx((i) => (i + 1) % MESSAGE_KEYS.length),
      1400
    )
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-10 gap-5"
    >
      {children}
      <div className="text-center space-y-1 min-h-[2.5rem]">
        <p className="text-sm font-medium text-foreground tabular-nums">
          {cp ? t('loaderSearchingCp', { cp }) : t('loaderSearching')}
        </p>
        <p key={idx} className="text-xs text-muted-foreground animate-fade-in-up">
          {t(MESSAGE_KEYS[idx])}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 1. RADAR — sonar avec 3 ondes + 4 dots OP en orbite + pin central
// ─────────────────────────────────────────────────────────────────
function RadarLoader({ cp }: Props) {
  return (
    <LoaderShell cp={cp}>
      <div className="relative w-24 h-24 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-radar-pulse" />
        <span
          className="absolute inset-0 rounded-full border-2 border-primary/40 animate-radar-pulse"
          style={{ animationDelay: '600ms' }}
        />
        <span
          className="absolute inset-0 rounded-full border-2 border-primary/40 animate-radar-pulse"
          style={{ animationDelay: '1200ms' }}
        />
        <OpDot pos="top" color={OP_COLORS.capac} delay="0ms" title="CAPAC" />
        <OpDot pos="right" color={OP_COLORS.fgtb} delay="400ms" title="FGTB" />
        <OpDot pos="bottom" color={OP_COLORS.csc} delay="800ms" title="CSC" />
        <OpDot pos="left" color={OP_COLORS.synova} delay="1200ms" title="SYNOVA" />
        <span className="relative z-10 flex items-center justify-center size-10 rounded-full bg-primary/10 animate-pin-bounce">
          <MapPin className="size-5 text-primary" fill="currentColor" />
        </span>
      </div>
    </LoaderShell>
  )
}

function OpDot({
  pos,
  color,
  delay,
  title,
}: {
  pos: 'top' | 'right' | 'bottom' | 'left'
  color: string
  delay: string
  title: string
}) {
  const posClass = {
    top: 'top-0 left-1/2 -translate-x-1/2',
    right: 'right-0 top-1/2 -translate-y-1/2',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2',
    left: 'left-0 top-1/2 -translate-y-1/2',
  }[pos]
  return (
    <span
      className={`absolute ${posClass} size-2.5 rounded-full animate-radar-dot shadow-[0_0_8px_currentColor]`}
      style={{ background: color, color, animationDelay: delay }}
      title={title}
    />
  )
}

// ─────────────────────────────────────────────────────────────────
// 2. GPS TRIANGULATION — 3 satellites + lignes "marching ants" qui
// signalent un flux vers un pin central. Style "position fix en cours".
//
// Animation des lignes : stroke-dasharray + stroke-dashoffset animé
// (technique "marching ants") au lieu d'offset-path qui a un support
// browser inégal et est tricky avec les coordonnées SVG.
// ─────────────────────────────────────────────────────────────────
function GpsLoader({ cp }: Props) {
  // Positions des 3 satellites dans la viewBox 100×100 (triangle équilatéral).
  const sats = [
    { x: 50, y: 10 }, // haut
    { x: 12, y: 80 }, // bas gauche
    { x: 88, y: 80 }, // bas droit
  ]
  const center = { x: 50, y: 50 }
  return (
    <LoaderShell cp={cp}>
      <div className="relative size-32">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
          {/* Lignes d'arrière-plan : faible opacity, juste pour situer */}
          {sats.map((s, i) => (
            <line
              key={`bg-${i}`}
              x1={s.x}
              y1={s.y}
              x2={center.x}
              y2={center.y}
              stroke="var(--primary)"
              strokeOpacity={0.18}
              strokeWidth={0.4}
            />
          ))}
          {/* Lignes signal : "marching ants" via stroke-dashoffset animé.
              Délai différent par satellite pour que le flux soit échelonné. */}
          {sats.map((s, i) => (
            <line
              key={`sig-${i}`}
              x1={s.x}
              y1={s.y}
              x2={center.x}
              y2={center.y}
              stroke="var(--primary)"
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeDasharray="3 8"
              className="animate-gps-march"
              style={{ animationDelay: `${i * 500}ms` }}
            />
          ))}
        </svg>

        {/* Satellites en HTML pour les icônes lucide */}
        {sats.map((s, i) => (
          <span
            key={`sat-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-primary animate-gps-sat"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              animationDelay: `${i * 200}ms`,
            }}
          >
            <Satellite className="size-4" fill="currentColor" />
          </span>
        ))}

        {/* Pin central */}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center size-10 rounded-full bg-primary/10 animate-pin-bounce">
          <MapPin className="size-5 text-primary" fill="currentColor" />
        </span>
      </div>
    </LoaderShell>
  )
}

// ─────────────────────────────────────────────────────────────────
// 3. COMPASS — aiguille de boussole qui scanne en oscillation, avec
// les 4 lettres cardinales qui s'allument à tour de rôle.
// ─────────────────────────────────────────────────────────────────
function CompassLoader({ cp }: Props) {
  const t = useTranslations('public.outils')
  return (
    <LoaderShell cp={cp}>
      <div className="relative size-28 flex items-center justify-center">
        {/* Cercle externe (cadran) */}
        <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
        {/* Marques cardinales */}
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary animate-card-glow" style={{ animationDelay: '0ms' }}>{t('compassN')}</span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-foreground/60 animate-card-glow" style={{ animationDelay: '500ms' }}>{t('compassE')}</span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-foreground/60 animate-card-glow" style={{ animationDelay: '1000ms' }}>{t('compassS')}</span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-foreground/60 animate-card-glow" style={{ animationDelay: '1500ms' }}>{t('compassW')}</span>

        {/* Cercle intérieur (fond du compass) */}
        <div className="absolute inset-3 rounded-full bg-primary/5" />

        {/* Aiguille — utilise Navigation rotée */}
        <Navigation
          className="relative z-10 size-12 text-primary animate-compass-spin drop-shadow-[0_0_4px_var(--primary)]"
          fill="currentColor"
          strokeWidth={1.5}
        />

        {/* Petit point central (pivot) */}
        <span className="absolute size-1.5 rounded-full bg-foreground z-20" />

        {/* Icône Compass discrète en arrière-plan */}
        <Compass
          aria-hidden
          className="absolute inset-0 m-auto size-24 text-primary/5"
          strokeWidth={0.5}
        />
      </div>
    </LoaderShell>
  )
}

// ─────────────────────────────────────────────────────────────────
// 4. PIN DROP — mini-carte stylisée (grille de dots) avec un pin qui
// tombe sur une position aléatoire, rebondit, disparaît, et un
// nouveau apparaît ailleurs. Très "résultat de recherche".
// ─────────────────────────────────────────────────────────────────
function PinDropLoader({ cp }: Props) {
  // 4 positions sur la mini-carte, le pin cycle dessus
  const positions = [
    { x: 25, y: 30 },
    { x: 70, y: 35 },
    { x: 35, y: 70 },
    { x: 75, y: 75 },
  ]
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setActiveIdx((i) => (i + 1) % positions.length)
    }, 900)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <LoaderShell cp={cp}>
      <div className="relative size-32 rounded-lg bg-primary/5 border border-primary/15 overflow-hidden">
        {/* Grille de dots décoratifs (dotted pattern) façon mini-map */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle, color-mix(in oklab, var(--foreground) 30%, transparent) 1px, transparent 1.5px)',
            backgroundSize: '10px 10px',
          }}
        />

        {/* "Anciens" pins (positions précédentes, en fade-out gris) */}
        {positions.map((p, i) => {
          if (i === activeIdx) return null
          return (
            <span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 size-1.5 rounded-full bg-foreground/30"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            />
          )
        })}

        {/* Pin actif qui drop + bounce. Le key={activeIdx} force le
            remount pour rejouer l'animation à chaque déplacement. */}
        <span
          key={activeIdx}
          className="absolute -translate-x-1/2 -translate-y-full animate-pin-drop"
          style={{
            left: `${positions[activeIdx].x}%`,
            top: `${positions[activeIdx].y}%`,
            color: 'var(--primary)',
          }}
        >
          <MapPin className="size-6" fill="currentColor" strokeWidth={1.5} />
        </span>

        {/* Cercle "ping" autour de la nouvelle position pour la souligner */}
        <span
          key={`ping-${activeIdx}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 size-3 rounded-full border-2 border-primary animate-ping-once"
          style={{ left: `${positions[activeIdx].x}%`, top: `${positions[activeIdx].y}%` }}
        />
      </div>
    </LoaderShell>
  )
}
