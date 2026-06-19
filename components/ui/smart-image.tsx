/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2Icon,
  FileTextIcon,
  GraduationCapIcon,
  HandshakeIcon,
  ImageIcon,
  UserIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Variantes ────────────────────────────────────────────────────────────────

export type SmartImageType =
  | "document"
  | "outil"
  | "formation"
  | "partenaire"
  | "employeur"
  | "avatar"
  | "generic";

interface TypeConfig {
  Icon: LucideIcon;
  label: string;
  hue: string;
}

const TYPE_CONFIG: Record<SmartImageType, TypeConfig> = {
  document:   { Icon: FileTextIcon,      label: "Document",   hue: "#818cf8" },
  outil:      { Icon: WrenchIcon,        label: "Outil",      hue: "#a78bfa" },
  formation:  { Icon: GraduationCapIcon, label: "Formation",  hue: "#c084fc" },
  partenaire: { Icon: HandshakeIcon,     label: "Partenaire", hue: "#818cf8" },
  employeur:  { Icon: Building2Icon,     label: "Employeur",  hue: "#93c5fd" },
  avatar:     { Icon: UserIcon,          label: "Profil",     hue: "#e879f9" },
  generic:    { Icon: ImageIcon,         label: "Contenu",    hue: "#94a3b8" },
};

// ─── Fallback standalone ──────────────────────────────────────────────────────

export interface MediaFallbackProps {
  type?: SmartImageType;
  /** Titre affiché sous l'icône (ex : nom de l'outil, du document…). */
  title?: string;
  /** Texte du badge. Défaut : "Aperçu indisponible". */
  label?: string;
  /** Variante compacte (icône seule, sans titre ni badge) — pour vignettes/logos. */
  compact?: boolean;
  className?: string;
}

/**
 * Bloc UI premium de remplacement pour toute image absente ou cassée.
 * Fond gradient dark violet, glow radial, bordure glassmorphism, icône typée.
 * Peut être utilisé standalone sans SmartImage.
 */
export function MediaFallback({
  type = "generic",
  title,
  label,
  compact = false,
  className,
}: MediaFallbackProps) {
  const { Icon, label: defaultLabel, hue } = TYPE_CONFIG[type];
  const badgeText = label ?? "Aperçu indisponible";
  const titleText = title ?? defaultLabel;

  return (
    <div
      role="img"
      aria-label={titleText}
      className={cn(
        "relative flex h-full w-full select-none flex-col items-center justify-center overflow-hidden",
        className,
      )}
      style={{
        background:
          "linear-gradient(135deg, #0f0a2c 0%, #1b0e46 55%, #0b0621 100%)",
      }}
    >
      {/* Bordure glassmorphism */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
      />

      {/* Glow radial coloré selon la variante */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 65% 55% at 50% 42%, ${hue}2a 0%, transparent 72%)`,
        }}
      />

      {/* Contenu centré */}
      <div className="relative z-10 flex flex-col items-center gap-2.5 px-4 text-center">
        {/* Icône avec halo */}
        <div
          className={cn(
            "flex items-center justify-center rounded-xl ring-1 ring-white/10",
            compact ? "size-8" : "size-11",
          )}
          style={{
            background: `color-mix(in oklab, ${hue} 20%, rgba(20,12,50,0.9))`,
            boxShadow: `0 0 20px ${hue}40, inset 0 1px 0 rgba(255,255,255,0.08)`,
          }}
        >
          <Icon
            className={cn("text-white/75", compact ? "size-4" : "size-[22px]")}
            strokeWidth={1.5}
            aria-hidden
          />
        </div>

        {!compact && (
          <>
            {/* Titre */}
            <p className="max-w-[85%] truncate text-[11.5px] font-semibold leading-tight text-white/55">
              {titleText}
            </p>

            {/* Badge */}
            <span
              className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.1em] text-white/40"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                backdropFilter: "blur(6px)",
              }}
            >
              {badgeText}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── SmartImage ───────────────────────────────────────────────────────────────

export interface SmartImageProps {
  /** URL de l'image. Vide / null / undefined → fallback immédiat. */
  src?: string | null;
  /** Texte alternatif (obligatoire pour l'accessibilité). */
  alt: string;
  /** Titre affiché dans le fallback. */
  title?: string;
  /** Texte du badge dans le fallback. Défaut : "Aperçu indisponible". */
  label?: string;
  /** Variante d'icône/couleur. Défaut : "generic". */
  type?: SmartImageType;
  /** Classes du conteneur (taille, arrondi, position). */
  className?: string;
  /** Classes appliquées UNIQUEMENT à la balise <img> (mix-blend, opacity…). */
  imgClassName?: string;
  /** object-fit de l'image réelle. Défaut : "cover". */
  fit?: "cover" | "contain" | "fill";
  loading?: "lazy" | "eager";
  /**
   * Que faire quand l'image est absente/cassée :
   *  - "component" (défaut) : afficher le MediaFallback premium ;
   *  - "hide" : ne rien rendre (laisse voir le fond derrière — utile quand
   *    l'image est décorative posée sur un dégradé déjà esthétique).
   */
  fallbackMode?: "component" | "hide";
  /** Fallback compact (icône seule) — pour petites vignettes/logos. */
  compactFallback?: boolean;
}

/**
 * Image intelligente : affiche `src` si disponible, sinon bascule sur
 * MediaFallback (ou se masque). Jamais d'icône navigateur d'image cassée.
 *
 * Cycle de vie :
 *  - tant que l'image charge → skeleton shimmer (couvre le cas « lente ») ;
 *  - au chargement → fondu d'apparition (pas de « pop ») ;
 *  - si `src` vide / `onError` → fallback (composant premium ou masqué).
 *
 * Le conteneur doit avoir une taille (la donner via `className` ou via le
 * parent) ; l'image et le fallback la remplissent en `absolute inset-0`.
 *
 * @example
 * <div className="relative h-48 w-full overflow-hidden rounded-xl">
 *   <SmartImage src={tool.image} alt={tool.title} type="outil" title={tool.title}
 *     className="absolute inset-0" />
 * </div>
 */
export function SmartImage({
  src,
  alt,
  title,
  label,
  type = "generic",
  className,
  imgClassName,
  fit = "cover",
  loading = "lazy",
  fallbackMode = "component",
  compactFallback = false,
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // `src` peut changer (liste réutilisée) → on réinitialise l'état.
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [src]);

  // Images servies depuis le cache : `onLoad` peut ne jamais se déclencher en
  // React (l'image est déjà `complete` au montage). On le détecte ici pour ne
  // pas rester bloqué sur le skeleton.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, [src]);

  const missing = !src || errored;

  // Mode "hide" : rien à afficher quand l'image manque/casse.
  if (missing && fallbackMode === "hide") return null;

  if (missing) {
    return (
      <MediaFallback
        type={type}
        title={title}
        label={label}
        compact={compactFallback}
        className={className}
      />
    );
  }

  return (
    <span className={cn("relative block overflow-hidden", className)}>
      {/* Skeleton tant que l'image n'est pas chargée (état « lente »). Inutile
          en mode "hide" : un fond (dégradé…) est déjà visible derrière. */}
      {!loaded && fallbackMode === "component" && (
        <span
          aria-hidden
          className="skeleton-shimmer absolute inset-0 motion-reduce:animate-none"
        />
      )}
      <img
        ref={imgRef}
        src={src ?? undefined}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={cn(
          "absolute inset-0 h-full w-full transition-opacity duration-500 motion-reduce:transition-none",
          fit === "cover" && "object-cover",
          fit === "contain" && "object-contain",
          fit === "fill" && "object-fill",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName,
        )}
      />
    </span>
  );
}
