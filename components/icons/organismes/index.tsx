/**
 * Logos SVG des organismes belges utilisés dans Beldoc.
 *
 * Chaque composant suit la même API :
 *   <OnemLogo size={48} className="..." />
 *
 * Design choisi : pictogramme simplifié dans un carré arrondi avec gradient
 * de la couleur officielle de l'organisme. Plus distinctif qu'un icon Lucide
 * générique, plus léger qu'un logo officiel rasterisé. Si les organismes
 * exigent leur vrai logo plus tard (CGU branding), il suffira de remplacer le
 * contenu SVG ici sans toucher aux call-sites.
 *
 * Couleurs officielles connues :
 *   ONEM   : #003E7E (bleu marine institutionnel)
 *   CPAS   : pas de couleur centralisée — violet utilisé (cohérence Beldoc)
 *   CAPAC  : #003E7E (similaire ONEM, organisme public)
 *   FGTB   : #E30613 (rouge socialiste)
 *   CSC    : #008F4F (vert syndicat chrétien)
 *   SYNOVA : #0050A0 (ex-CGSLB, bleu libéral)
 */

import type { SVGProps } from 'react'

interface LogoProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number
}

const baseProps = (size: number, extra?: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: '0 0 48 48',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  ...extra,
})

/** Carré arrondi de fond avec gradient. Composé par chaque logo. */
function RoundedBg({ from, to, id }: { from: string; to: string; id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${id})`} />
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/* ONEM — bleu marine, pictogramme bâtiment administratif (colonnes) */
/* ─────────────────────────────────────────────────────────────────── */
export function OnemLogo({ size = 48, ...rest }: LogoProps) {
  return (
    <svg {...baseProps(size, rest)} aria-label="ONEM">
      <RoundedBg from="#003E7E" to="#1565C0" id="onem-bg" />
      {/* Toit du bâtiment */}
      <path d="M12 22 L24 14 L36 22 L36 24 L12 24 Z" fill="white" />
      {/* Colonnes */}
      <rect x="15" y="25" width="3" height="9" fill="white" />
      <rect x="21" y="25" width="3" height="9" fill="white" />
      <rect x="27" y="25" width="3" height="9" fill="white" />
      <rect x="33" y="25" width="0" height="0" fill="white" />
      {/* Base */}
      <rect x="12" y="34" width="24" height="2.5" fill="white" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/* CPAS — violet, pictogramme mains tendues / aide sociale            */
/* ─────────────────────────────────────────────────────────────────── */
export function CpasLogo({ size = 48, ...rest }: LogoProps) {
  return (
    <svg {...baseProps(size, rest)} aria-label="CPAS">
      <RoundedBg from="#7c3aed" to="#a78bfa" id="cpas-bg" />
      {/* Cœur stylisé entouré de mains */}
      <path
        d="M24 33 C 18 28, 14 24, 14 20 C 14 17, 16.5 15, 19 15 C 21 15, 23 16, 24 18 C 25 16, 27 15, 29 15 C 31.5 15, 34 17, 34 20 C 34 24, 30 28, 24 33 Z"
        fill="white"
        opacity="0.95"
      />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/* COMMUNE — vert, hôtel de ville stylisé (tour + drapeau)            */
/* ─────────────────────────────────────────────────────────────────── */
export function CommuneLogo({ size = 48, ...rest }: LogoProps) {
  return (
    <svg {...baseProps(size, rest)} aria-label="Maison communale">
      <RoundedBg from="#059669" to="#34d399" id="commune-bg" />
      {/* Tour centrale */}
      <rect x="22" y="14" width="4" height="22" fill="white" />
      {/* Ailes gauche/droite */}
      <rect x="14" y="20" width="6" height="16" fill="white" />
      <rect x="28" y="20" width="6" height="16" fill="white" />
      {/* Toit pointu sur la tour */}
      <path d="M22 14 L24 10 L26 14 Z" fill="white" />
      {/* Drapeau */}
      <rect x="24" y="11" width="3" height="1.5" fill="white" />
      {/* Base */}
      <rect x="12" y="36" width="24" height="1.5" fill="white" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/* OP générique — sarcelle, portefeuille / billet                     */
/* ─────────────────────────────────────────────────────────────────── */
export function OpLogo({ size = 48, ...rest }: LogoProps) {
  return (
    <svg {...baseProps(size, rest)} aria-label="Organisme de paiement">
      <RoundedBg from="#0d9488" to="#2dd4bf" id="op-bg" />
      {/* Carte/portefeuille */}
      <rect x="10" y="17" width="28" height="18" rx="2" fill="white" />
      {/* Bande magnétique */}
      <rect x="10" y="22" width="28" height="3.5" fill="#0d9488" opacity="0.4" />
      {/* Logo card */}
      <circle cx="18" cy="30" r="2" fill="#0d9488" opacity="0.5" />
      <circle cx="22" cy="30" r="2" fill="#0d9488" opacity="0.3" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/* CAPAC — orange (couleur officielle du logo)                        */
/* ─────────────────────────────────────────────────────────────────── */
export function CapacLogo({ size = 48, ...rest }: LogoProps) {
  return (
    <svg {...baseProps(size, rest)} aria-label="CAPAC">
      <RoundedBg from="#E8651E" to="#F58220" id="capac-bg" />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="white"
        fontFamily="system-ui, sans-serif"
        letterSpacing="-0.5"
      >
        CAPAC
      </text>
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/* FGTB — rouge socialiste                                            */
/* ─────────────────────────────────────────────────────────────────── */
export function FgtbLogo({ size = 48, ...rest }: LogoProps) {
  return (
    <svg {...baseProps(size, rest)} aria-label="FGTB">
      <RoundedBg from="#C8102E" to="#E30613" id="fgtb-bg" />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fill="white"
        fontFamily="system-ui, sans-serif"
        letterSpacing="-0.5"
      >
        FGTB
      </text>
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/* CSC — vert syndicat chrétien                                       */
/* ─────────────────────────────────────────────────────────────────── */
export function CscLogo({ size = 48, ...rest }: LogoProps) {
  return (
    <svg {...baseProps(size, rest)} aria-label="CSC">
      <RoundedBg from="#006B3C" to="#008F4F" id="csc-bg" />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="15"
        fontWeight="800"
        fill="white"
        fontFamily="system-ui, sans-serif"
        letterSpacing="-0.3"
      >
        CSC
      </text>
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/* SYNOVA — bleu libéral (ex-CGSLB)                                    */
/* ─────────────────────────────────────────────────────────────────── */
export function SynovaLogo({ size = 48, ...rest }: LogoProps) {
  return (
    <svg {...baseProps(size, rest)} aria-label="SYNOVA">
      <RoundedBg from="#003C84" to="#0050A0" id="synova-bg" />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="800"
        fill="white"
        fontFamily="system-ui, sans-serif"
        letterSpacing="-0.3"
      >
        SYNOVA
      </text>
    </svg>
  )
}

/**
 * Helper : retourne le logo correspondant à un code organisme.
 * Permet aux call-sites de mapper sans switch verbeux.
 */
export function OrganismeLogo({
  code,
  size = 48,
  ...rest
}: { code: string | null } & LogoProps) {
  const c = (code ?? '').toLowerCase()
  if (c === 'capac') return <CapacLogo size={size} {...rest} />
  if (c === 'fgtb') return <FgtbLogo size={size} {...rest} />
  if (c === 'csc') return <CscLogo size={size} {...rest} />
  if (c === 'synova') return <SynovaLogo size={size} {...rest} />
  return <OpLogo size={size} {...rest} />
}
