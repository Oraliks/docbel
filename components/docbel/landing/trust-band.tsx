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

import { getTranslations } from "next-intl/server";
import {
  KeyRoundIcon,
  ShieldCheckIcon,
  TimerIcon,
  UserXIcon,
  type LucideIcon,
} from "lucide-react";

/// Engagements de confidentialité — formulations alignées sur celles déjà
/// affichées dans le parcours dossier (cf. commentaire d'en-tête du fichier).
/// Le texte (avec emphase <strong>) vient des traductions via `t.rich`.
const PRIVACY_POINTS: { Icon: LucideIcon; key: string }[] = [
  { Icon: UserXIcon, key: "trustPoint1" },
  { Icon: KeyRoundIcon, key: "trustPoint2" },
  { Icon: TimerIcon, key: "trustPoint3" },
];

export async function TrustBand() {
  const t = await getTranslations("public.home");
  return (
    <section
      aria-label={t("trustHeading")}
      className="glass-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
    >
      {/* En-tête : tuile + titre — compact, posé à gauche sur desktop. */}
      <div className="flex shrink-0 items-center gap-2.5 sm:max-w-[190px]">
        <span
          className="glass-icon-tile flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={
            {
              background:
                "color-mix(in oklab, var(--glass-accent-deep) 18%, transparent)",
              color: "var(--glass-accent-deep)",
              "--tile-hue": "var(--glass-accent-deep)",
            } as React.CSSProperties
          }
        >
          <ShieldCheckIcon className="size-[18px]" strokeWidth={1.9} aria-hidden />
        </span>
        <h2 className="glass-display text-[19px] font-semibold leading-tight sm:text-[21px]">
          {t("trustHeading")}
        </h2>
      </div>

      {/* 3 engagements en ligne, compacts. */}
      <div className="grid flex-1 gap-x-8 gap-y-2.5 sm:grid-cols-3">
        {PRIVACY_POINTS.map(({ Icon, key }) => (
          <div key={key} className="flex items-start gap-2.5">
            <Icon
              className="mt-0.5 size-4 shrink-0 text-[color:var(--glass-accent-deep)]"
              strokeWidth={2}
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-[color:var(--glass-ink-soft)]">
              {t.rich(key as Parameters<typeof t.rich>[0], {
                strong: (chunks) => (
                  <strong className="font-bold text-[color:var(--glass-ink)]">
                    {chunks}
                  </strong>
                ),
              })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
