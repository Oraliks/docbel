"use client";

// Bande de confiance de la home : 3 compteurs (chiffres RÉELS injectés par le
// Server Component app/page.tsx) + carte « Vos données restent à vous ».
//
// Les puces de confidentialité reprennent les engagements déjà formulés dans
// le produit (rien n'est promis ici qui ne soit pas dans le code) :
//   - « Aucune donnée nominative n'est conservée »
//     → components/docbel/onboarding/resume-code-banner.tsx
//   - code de reprise anonyme, sans compte (parcours via cookie de session)
//     → lib/bundles/resume-code.ts + app/d/[slug]/page.tsx
//   - expiration automatique après 30 jours
//     → RESUME_CODE_DEFAULT_TTL_DAYS (lib/bundles/resume-code.ts)

import { useEffect, useRef, useState } from "react";
import {
  Building2Icon,
  FileTextIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  TimerIcon,
  UserXIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

export interface TrustBandStats {
  /// PdfForms publiés et actifs (prisma.pdfForm.count).
  documents: number;
  /// Outils actifs visibles sur le site.
  outils: number;
  /// Organismes émetteurs distincts (issuers des PdfForms publiés).
  organismes: number;
}

interface TrustBandProps {
  stats: TrustBandStats;
}

/// Durée du count-up (assez courte pour ne pas faire attendre la lecture).
const COUNT_UP_DURATION_MS = 1300;

/**
 * Count-up déclenché au scroll : le nombre final est rendu côté serveur
 * (SEO / sans JS / reduced-motion = valeur directe), puis, à la première
 * intersection, on rejoue 0 → valeur via requestAnimationFrame. Tous les
 * setState vivent dans des callbacks (observer / rAF) — jamais en synchrone
 * dans l'effet (règle react-hooks/set-state-in-effect).
 */
function useCountUp(target: number) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    const el = ref.current;
    if (!el || target <= 0) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return; // valeur directe, aucune animation
    }

    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / COUNT_UP_DURATION_MS, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          setDisplay(Math.round(eased * target));
          if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target]);

  return { ref, display };
}

function StatCard({
  Icon,
  hue,
  value,
  label,
  delay,
}: {
  Icon: LucideIcon;
  hue: string;
  value: number;
  label: string;
  delay: number;
}) {
  const { ref, display } = useCountUp(value);
  return (
    <div
      className="glass-surface outils-rise flex min-w-[200px] flex-1 flex-col items-start gap-3 p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        className="glass-icon-tile flex size-10 items-center justify-center rounded-xl"
        style={{
          background: `color-mix(in oklab, ${hue} 18%, transparent)`,
          color: hue,
          "--tile-hue": hue,
        } as React.CSSProperties}
      >
        <Icon className="size-5" strokeWidth={1.9} aria-hidden />
      </span>
      <span
        ref={ref}
        className="glass-display text-[34px] font-semibold leading-none tabular-nums"
      >
        {display.toLocaleString("fr-BE")}
      </span>
      <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
        {label}
      </span>
    </div>
  );
}

/// Engagements de confidentialité — formulations alignées sur celles déjà
/// affichées dans le parcours dossier (cf. commentaire d'en-tête du fichier).
const PRIVACY_POINTS: { Icon: LucideIcon; text: React.ReactNode }[] = [
  {
    Icon: UserXIcon,
    text: (
      <>
        <strong className="font-bold">
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
        Un <strong className="font-bold">code de reprise anonyme</strong>{" "}
        suffit pour retrouver votre dossier sur un autre appareil — sans créer
        de compte.
      </>
    ),
  },
  {
    Icon: TimerIcon,
    text: (
      <>
        <strong className="font-bold">Expiration automatique</strong> : le code
        est valable 30 jours ; ensuite, les informations saisies sont perdues.
      </>
    ),
  },
];

export function TrustBand({ stats }: TrustBandProps) {
  // Fail-soft : si une requête de comptage a échoué côté serveur (0), on
  // masque le compteur concerné plutôt que d'afficher un « 0 » mensonger.
  const counters = [
    {
      Icon: FileTextIcon,
      hue: "var(--glass-accent-deep)",
      value: stats.documents,
      label: "documents officiels couverts",
    },
    {
      Icon: WrenchIcon,
      hue: "var(--glass-accent-a)",
      value: stats.outils,
      label: "outils gratuits",
    },
    {
      Icon: Building2Icon,
      hue: "var(--glass-accent-c)",
      value: stats.organismes,
      label: "organismes",
    },
  ].filter((counter) => counter.value > 0);

  return (
    <section
      aria-label="Chiffres clés et confidentialité"
      className="flex flex-wrap items-stretch gap-4"
    >
      {counters.map((counter, index) => (
        <StatCard
          key={counter.label}
          Icon={counter.Icon}
          hue={counter.hue}
          value={counter.value}
          label={counter.label}
          delay={index * 70}
        />
      ))}

      {/* Carte confidentialité — un peu plus large que les compteurs. */}
      <div
        className="glass-surface outils-rise flex min-w-full flex-[1.6] flex-col gap-4 p-6 sm:min-w-[340px]"
        style={{ animationDelay: `${counters.length * 70}ms` }}
      >
        <div className="flex items-center gap-3">
          <span
            className="glass-icon-tile flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                "color-mix(in oklab, var(--glass-accent-deep) 18%, transparent)",
              color: "var(--glass-accent-deep)",
              "--tile-hue": "var(--glass-accent-deep)",
            } as React.CSSProperties}
          >
            <ShieldCheckIcon className="size-5" strokeWidth={1.9} aria-hidden />
          </span>
          <h2 className="glass-display text-[20px] font-semibold leading-tight">
            Vos données restent à vous
          </h2>
        </div>

        <ul className="flex flex-col gap-2.5">
          {PRIVACY_POINTS.map(({ Icon, text }, index) => (
            <li
              key={index}
              className="flex items-start gap-2.5 text-[12.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]"
            >
              <Icon
                className="mt-0.5 size-4 shrink-0 text-[color:var(--glass-accent-deep)]"
                strokeWidth={2}
                aria-hidden
              />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
