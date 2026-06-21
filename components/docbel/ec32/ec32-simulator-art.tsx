'use client'

// =====================================================================
//  eC3.2 — Illustration décorative de l'en-tête du simulateur
// ---------------------------------------------------------------------
//  Petite « carte de contrôle » glass en léger 3D, flottante, pour
//  remplir l'espace à droite du titre/sous-titre (desktop uniquement).
//  100 % décoratif (aria-hidden), CSS pur (aucune image, aucune donnée).
//  Respecte `prefers-reduced-motion` (motion-reduce:animate-none).
// =====================================================================

import { cn } from '@/lib/utils'

/** Mini-grille de jours : teintes alignées sur la palette des situations. */
const TILES: Array<{ tone: string; pulse?: boolean }> = [
  { tone: 'bg-violet-300/80' },
  { tone: 'bg-indigo-300/80', pulse: true },
  { tone: 'bg-muted' },
  { tone: 'bg-sky-300/80' },
  { tone: 'bg-muted' },
  { tone: 'bg-emerald-300/80', pulse: true },
  { tone: 'bg-muted' },
  { tone: 'bg-muted' },
  { tone: 'bg-amber-300/80' },
  { tone: 'bg-violet-300/80', pulse: true },
  { tone: 'bg-muted' },
  { tone: 'bg-indigo-300/80' },
  { tone: 'bg-sky-300/80' },
  { tone: 'bg-muted' },
]

export function Ec32SimulatorArt({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none relative w-[24rem] max-w-full select-none [perspective:1200px]',
        className,
      )}
    >
      {/* Halo doux derrière la carte */}
      <div className="absolute inset-6 -z-10 rounded-[2.5rem] bg-primary/15 blur-3xl" />

      {/* Carte principale (flotte) → inclinaison 3D sur l'enfant */}
      <div className="animate-[ec32-art-float_7s_ease-in-out_infinite] motion-reduce:animate-none">
        <div
          className="rounded-[1.75rem] border border-primary/15 bg-card/90 p-4 shadow-[0_1px_3px_rgba(26,26,36,0.06),0_30px_60px_-28px_rgba(91,70,229,0.45)] backdrop-blur [transform:rotateY(-16deg)_rotateX(9deg)] [transform-style:preserve-3d]"
        >
          {/* Barre de titre */}
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <span className="size-2.5 rounded-[3px] bg-primary" />
            </span>
            <div className="flex-1 space-y-1">
              <span className="block h-1.5 w-20 rounded-full bg-foreground/25" />
              <span className="block h-1.5 w-12 rounded-full bg-foreground/10" />
            </div>
            <span className="flex gap-1">
              <span className="size-1.5 rounded-full bg-rose-300" />
              <span className="size-1.5 rounded-full bg-amber-300" />
              <span className="size-1.5 rounded-full bg-emerald-300" />
            </span>
          </div>

          {/* Mini-calendrier 7 colonnes × 2 rangées */}
          <div className="grid grid-cols-7 gap-1.5">
            {TILES.map((tile, i) => (
              <span
                key={i}
                className={cn(
                  'aspect-square rounded-md',
                  tile.tone,
                  tile.pulse &&
                    'animate-[ec32-art-pulse_2.8s_ease-in-out_infinite] motion-reduce:animate-none',
                )}
                style={tile.pulse ? { animationDelay: `${(i % 5) * 0.35}s` } : undefined}
              />
            ))}
          </div>

          {/* Pied : « légende » factice */}
          <div className="mt-3 flex items-center gap-1.5">
            <span className="size-2 rounded-[3px] bg-violet-300" />
            <span className="h-1.5 w-10 rounded-full bg-foreground/15" />
            <span className="ml-auto size-2 rounded-[3px] bg-emerald-300" />
            <span className="h-1.5 w-8 rounded-full bg-foreground/15" />
          </div>
        </div>
      </div>

      {/* Pastille flottante « validé » (contre-mouvement) */}
      <div className="absolute -right-2 -top-3 animate-[ec32-art-float-2_5.5s_ease-in-out_infinite] motion-reduce:animate-none">
        <span className="flex size-10 items-center justify-center rounded-2xl border border-primary/15 bg-card shadow-[0_10px_24px_-12px_rgba(91,70,229,0.55)]">
          <svg viewBox="0 0 24 24" className="size-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      </div>

      {/* Petite pastille flottante « calendrier » (bas-gauche) */}
      <div className="absolute -bottom-3 left-1 animate-[ec32-art-float_6.5s_ease-in-out_infinite_0.8s] motion-reduce:animate-none">
        <span className="flex size-9 items-center justify-center rounded-2xl border border-primary/15 bg-card shadow-[0_10px_24px_-12px_rgba(91,70,229,0.5)]">
          <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="3" />
            <path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
        </span>
      </div>

      {/* Keyframes locales (noms préfixés pour éviter toute collision). */}
      <style>{`
        @keyframes ec32-art-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes ec32-art-float-2 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(9px); }
        }
        @keyframes ec32-art-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
