// Bande de confiance de la home : uniquement les engagements de
// confidentialité, affichés en TEXTE compact et prominent (plus de compteurs,
// plus de carte). Formulations alignées sur celles déjà présentes dans le
// produit (rien n'est promis ici qui ne soit pas dans le code) :
//   - « Aucune donnée nominative n'est conservée »
//     → components/docbel/onboarding/resume-code-banner.tsx
//   - code de reprise anonyme, sans compte (parcours via cookie de session)
//     → lib/bundles/resume-code.ts + app/d/[slug]/page.tsx
//   - expiration automatique après 30 jours
//     → RESUME_CODE_DEFAULT_TTL_DAYS (lib/bundles/resume-code.ts)

import {
  KeyRoundIcon,
  ShieldCheckIcon,
  TimerIcon,
  UserXIcon,
  type LucideIcon,
} from "lucide-react";

/// Engagements de confidentialité — formulations alignées sur celles déjà
/// affichées dans le parcours dossier (cf. commentaire d'en-tête du fichier).
const PRIVACY_POINTS: { Icon: LucideIcon; text: React.ReactNode }[] = [
  {
    Icon: UserXIcon,
    text: (
      <>
        <strong className="font-bold text-[color:var(--glass-ink)]">
          Aucune donnée nominative n&apos;est conservée
        </strong>{" "}
        : votre dossier reste anonyme.
      </>
    ),
  },
  {
    Icon: KeyRoundIcon,
    text: (
      <>
        Un{" "}
        <strong className="font-bold text-[color:var(--glass-ink)]">
          code de reprise anonyme
        </strong>{" "}
        suffit pour retrouver votre dossier sur un autre appareil — sans créer
        de compte.
      </>
    ),
  },
  {
    Icon: TimerIcon,
    text: (
      <>
        <strong className="font-bold text-[color:var(--glass-ink)]">
          Expiration automatique
        </strong>{" "}
        : le code est valable 30 jours ; ensuite, les informations saisies sont
        perdues.
      </>
    ),
  },
];

export function TrustBand() {
  return (
    <section
      aria-label="Vos données restent à vous"
      className="outils-rise flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <span
          className="glass-icon-tile flex size-11 shrink-0 items-center justify-center rounded-xl"
          style={
            {
              background:
                "color-mix(in oklab, var(--glass-accent-deep) 18%, transparent)",
              color: "var(--glass-accent-deep)",
              "--tile-hue": "var(--glass-accent-deep)",
            } as React.CSSProperties
          }
        >
          <ShieldCheckIcon className="size-5" strokeWidth={1.9} aria-hidden />
        </span>
        <h2 className="glass-display text-[26px] font-semibold leading-tight sm:text-[30px]">
          Vos données restent à vous
        </h2>
      </div>

      <div className="grid gap-x-10 gap-y-5 sm:grid-cols-3">
        {PRIVACY_POINTS.map(({ Icon, text }, index) => (
          <div key={index} className="flex items-start gap-3">
            <Icon
              className="mt-0.5 size-5 shrink-0 text-[color:var(--glass-accent-deep)]"
              strokeWidth={2}
              aria-hidden
            />
            <p className="text-[13.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
              {text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
