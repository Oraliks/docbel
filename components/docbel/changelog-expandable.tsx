"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** Contenu à plier (HTML rendu côté serveur + JSX libre). */
  children: React.ReactNode;
  /**
   * Hauteur (px) au-delà de laquelle on plie la card. Sous ce seuil, on
   * affiche tout sans bouton. Défaut : 240px.
   */
  collapsedHeight?: number;
  /** Couleur d'accent du bouton + halo. */
  accent?: string;
};

/**
 * Wrapper client : prend du contenu arbitraire (children) et coupe
 * automatiquement la hauteur si elle dépasse `collapsedHeight`.
 *
 * Quand plié :
 *  - le contenu est tronqué (max-height + overflow:hidden)
 *  - un fondu doux masque la dernière bande de contenu
 *  - un bouton **plein-largeur** sticky en bas de la card propose « Voir plus »
 *
 * **Important** : le bouton sort des paddings du parent via `-mx-5 -mb-5`
 * et arrondit ses coins via `rounded-b-2xl`. Le parent DOIT donc avoir
 * `p-5` + `rounded-2xl` + `overflow-hidden`. Tous les éléments qui
 * doivent être pliés/expandés doivent être passés en `children` (et pas
 * rendus comme siblings après ce composant — sinon le bouton les recouvre).
 */
export function ChangelogExpandable({
  children,
  collapsedHeight = 240,
  accent = "var(--glass-accent-deep)",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Trois états — séparer la mesure du résultat permet de :
  //   1) Couper par défaut (pas de FOUC qui déplie tout sur les longues)
  //   2) Ne PAS afficher le bouton avant d'avoir confirmé le débordement
  //      (sinon les cards courtes voient un bouton apparaître/disparaître)
  const [measured, setMeasured] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setHasOverflow(el.scrollHeight > collapsedHeight + 8);
      setMeasured(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, collapsedHeight]);

  // - Avant mesure : on coupe (safe default, évite le flash sur les longues).
  // - Après mesure : on ne coupe que si le contenu déborde réellement,
  //   sauf si l'utilisateur a explicitement déplié.
  const isClipped = (!measured || hasOverflow) && !expanded;
  // Bouton montré uniquement quand la mesure confirme le débordement.
  const showButton = measured && hasOverflow;

  return (
    <div className="relative">
      {/* Zone pliable */}
      <div className="relative">
        <div
          ref={ref}
          className="transition-[max-height] duration-300 ease-out"
          style={{
            maxHeight: isClipped ? `${collapsedHeight}px` : "none",
            overflow: isClipped ? "hidden" : "visible",
          }}
        >
          {children}
        </div>

        {/* Fondu doux sur la dernière bande quand plié */}
        {isClipped && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{
              background:
                "linear-gradient(to top, var(--glass-surface, var(--card)) 0%, transparent 100%)",
            }}
          />
        )}
      </div>

      {/* Bouton plein-largeur, edge-to-edge avec la card */}
      {showButton && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cn(
            "-mx-5 -mb-5 mt-4 w-[calc(100%_+_2.5rem)] rounded-b-2xl",
            "group relative flex items-center justify-center gap-2 px-4 py-3.5",
            "text-[11px] font-bold uppercase tracking-[0.1em]",
            "border-t backdrop-blur-md transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
          )}
          style={{
            color: accent,
            borderColor: `${accent}25`,
            background: `linear-gradient(180deg, ${accent}0d 0%, ${accent}1a 100%)`,
            ["--tw-ring-color" as string]: `${accent}40`,
          }}
        >
          {/* Calque hover qui s'éclaircit */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-b-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            style={{
              background: `linear-gradient(180deg, ${accent}1a 0%, ${accent}2e 100%)`,
            }}
          />
          <span className="relative inline-flex items-center gap-2">
            {expanded ? "Voir moins" : "Voir plus"}
            <ChevronDown
              aria-hidden
              className={cn(
                "size-3.5 transition-transform duration-300",
                expanded && "rotate-180"
              )}
            />
          </span>
        </button>
      )}
    </div>
  );
}
