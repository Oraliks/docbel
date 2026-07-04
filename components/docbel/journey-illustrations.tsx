/**
 * Vignettes SVG des étapes de parcours (écran d'explication des dossiers).
 *
 * Dessinées maison (contrainte : pas de visuel ONEM sans approbation) dans la
 * palette glass via les tokens CSS — dark mode « néon » hérité gratuitement.
 * Une vignette par icône du catalogue `JourneyStepIcon` (lib/dossiers/types) :
 * le composant reste générique pour tout dossier qui déclare un `journey`.
 *
 * Discipline visuelle : traits `--glass-accent-deep`, remplissages doux en
 * color-mix, UN seul accent rose (`--glass-pop-fg`) par vignette.
 */

import type { JourneyStepIcon } from "@/lib/dossiers/types";

const STROKE = "var(--glass-accent-deep)";
const FILL_SOFT = "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)";
const FILL_POP = "color-mix(in oklab, var(--glass-pop-fg) 22%, transparent)";
const POP = "var(--glass-pop-fg)";

const COMMON = {
  fill: "none",
  stroke: STROKE,
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Inscription (badge demandeur d'emploi validé). */
function VignetteUserCheck() {
  return (
    <>
      <rect x="14" y="24" width="64" height="46" rx="9" {...COMMON} fill={FILL_SOFT} />
      <circle cx="33" cy="42" r="7" {...COMMON} />
      <path d="M22 60c1.5-6.5 5.5-10 11-10s9.5 3.5 11 10" {...COMMON} />
      <path d="M52 38h18M52 47h13" {...COMMON} />
      <circle cx="68" cy="64" r="13" {...COMMON} fill={FILL_POP} />
      <path d="M62 64.5l4 4 8-8.5" {...COMMON} stroke={POP} />
    </>
  );
}

/** Stage / attente (calendrier, jours cochés). */
function VignetteCalendar() {
  return (
    <>
      <rect x="16" y="22" width="64" height="54" rx="9" {...COMMON} fill={FILL_SOFT} />
      <path d="M16 36h64" {...COMMON} />
      <path d="M32 16v10M64 16v10" {...COMMON} />
      <circle cx="31" cy="48" r="2.4" fill={STROKE} stroke="none" />
      <circle cx="48" cy="48" r="2.4" fill={STROKE} stroke="none" />
      <circle cx="65" cy="48" r="2.4" fill={STROKE} stroke="none" />
      <circle cx="31" cy="62" r="2.4" fill={STROKE} stroke="none" />
      <circle cx="65" cy="62" r="2.4" fill={STROKE} stroke="none" />
      <circle cx="48" cy="62" r="9" {...COMMON} fill={FILL_POP} />
      <path d="M44 62l3 3 5.5-6" {...COMMON} stroke={POP} />
    </>
  );
}

/** Demande (formulaire validé). */
function VignetteFileCheck() {
  return (
    <>
      <path
        d="M28 14h26l14 14v46a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6Z"
        {...COMMON}
        fill={FILL_SOFT}
      />
      <path d="M54 14v14h14" {...COMMON} />
      <path d="M32 40h30M32 50h30M32 60h18" {...COMMON} />
      <circle cx="60" cy="66" r="12" {...COMMON} fill={FILL_POP} />
      <path d="M54.5 66l4 4 7-7.5" {...COMMON} stroke={POP} />
    </>
  );
}

/** Paiement (portefeuille + pièce). */
function VignetteWallet() {
  return (
    <>
      <rect x="18" y="32" width="58" height="42" rx="10" {...COMMON} fill={FILL_SOFT} />
      <path d="M18 44h58" {...COMMON} />
      <rect x="56" y="50" width="20" height="14" rx="7" {...COMMON} />
      <circle cx="64" cy="57" r="2.4" fill={STROKE} stroke="none" />
      <circle cx="62" cy="22" r="10" {...COMMON} fill={FILL_POP} />
      <path d="M58 22h8M62 18v8" {...COMMON} stroke={POP} />
    </>
  );
}

const VIGNETTES: Record<JourneyStepIcon, () => React.ReactElement> = {
  "user-check": VignetteUserCheck,
  calendar: VignetteCalendar,
  "file-check": VignetteFileCheck,
  wallet: VignetteWallet,
};

export function JourneyVignette({
  icon,
  className,
}: {
  icon: JourneyStepIcon;
  className?: string;
}) {
  const Vignette = VIGNETTES[icon];
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" role="presentation">
      <Vignette />
    </svg>
  );
}
