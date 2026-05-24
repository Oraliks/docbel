'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'

interface Props {
  /** CP en cours de recherche, pour personnaliser le message. */
  cp?: string
}

/**
 * Loader animé du finder de bureaux.
 *
 * Métaphore radar : un pin central pulse, 3 ondes circulaires se diffusent
 * vers l'extérieur, et 4 dots colorés (couleurs CAPAC/FGTB/CSC/CGSLB)
 * orbitent autour en séquence — exactement les mêmes couleurs que les
 * dots sur la map, donc l'utilisateur fait inconsciemment le lien.
 *
 * Phrases tournantes pour donner l'impression de progression : on
 * cycle entre 4 messages toutes les 1.4s. Ça occupe l'œil + ça raconte
 * ce qu'on est en train de faire côté serveur.
 *
 * Pas de dépendance externe (anim CSS pure dans globals.css), léger,
 * accessible (aria-live polite + role status).
 */
export function SearchLoader({ cp }: Props) {
  const messages = [
    'On localise ton CPAS…',
    'On cherche l’ONEM compétent…',
    'On trouve ta Maison communale…',
    'On compare les 4 organismes de paiement…',
  ]
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 1400)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-10 gap-5"
    >
      {/* Radar : 96×96 px, 3 ondes + 4 dots OP + pin central */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Ondes concentriques (border-only, scale + fade) */}
        <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-radar-pulse" />
        <span
          className="absolute inset-0 rounded-full border-2 border-primary/40 animate-radar-pulse"
          style={{ animationDelay: '600ms' }}
        />
        <span
          className="absolute inset-0 rounded-full border-2 border-primary/40 animate-radar-pulse"
          style={{ animationDelay: '1200ms' }}
        />

        {/* 4 dots OP en orbite : positions cardinales (N/E/S/W) avec
            pulse staggered. Couleurs identiques à celles de la map
            pour cohérence visuelle. */}
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 size-2.5 rounded-full animate-radar-dot shadow-[0_0_8px_currentColor]"
          style={{ background: '#F58220', color: '#F58220', animationDelay: '0ms' }}
          title="CAPAC"
        />
        <span
          className="absolute right-0 top-1/2 -translate-y-1/2 size-2.5 rounded-full animate-radar-dot shadow-[0_0_8px_currentColor]"
          style={{ background: '#E30613', color: '#E30613', animationDelay: '400ms' }}
          title="FGTB"
        />
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 size-2.5 rounded-full animate-radar-dot shadow-[0_0_8px_currentColor]"
          style={{ background: '#008F4F', color: '#008F4F', animationDelay: '800ms' }}
          title="CSC"
        />
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 size-2.5 rounded-full animate-radar-dot shadow-[0_0_8px_currentColor]"
          style={{ background: '#0050A0', color: '#0050A0', animationDelay: '1200ms' }}
          title="CGSLB"
        />

        {/* Pin central : pulse plus rapide pour ancrer l'attention */}
        <span className="relative z-10 flex items-center justify-center size-10 rounded-full bg-primary/10 animate-pin-bounce">
          <MapPin className="size-5 text-primary" fill="currentColor" />
        </span>
      </div>

      {/* Texte */}
      <div className="text-center space-y-1 min-h-[2.5rem]">
        <p className="text-sm font-medium text-foreground tabular-nums">
          Recherche{cp ? ` pour ${cp}` : ''}…
        </p>
        <p
          key={idx}
          className="text-xs text-muted-foreground animate-fade-in-up"
        >
          {messages[idx]}
        </p>
      </div>
    </div>
  )
}
