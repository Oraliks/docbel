"use client";

// Parcours « Chômage temporaire » pour la landing employeur (/p/employeur).
// Timeline 4 étapes — horizontale en desktop, verticale en mobile — révélée
// en séquence à l'entrée dans le viewport (réutilise `.outils-rise`, déjà
// neutralisée par prefers-reduced-motion dans globals.css).
//
// Contenu aligné sur le module lib/dossiers/chomage-temporaire :
// - section théorique « Démarches employeur — vue d'ensemble » (notification,
//   communication du 1er jour effectif, flux DRS / WECH) ;
// - avertissement EC32 (formulation reprise du repo, cf.
//   components/admin/documents/bundle-warnings-editor.tsx).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  EuroIcon,
  FileTextIcon,
  FolderOpenIcon,
  type LucideIcon,
  SendIcon,
  UsersIcon,
} from "lucide-react";

/// Slug vérifié dans lib/dossiers/registry.ts (module chomage-temporaire).
const DOSSIER_HREF = "/d/chomage-temporaire";

// Mêmes gradients d'icônes que le reste de la landing employeur.
type StepHue = "violet" | "blue" | "rose" | "green";
const ICON_BG: Record<StepHue, string> = {
  violet:
    "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
  blue: "linear-gradient(135deg, color-mix(in oklab, var(--chart-2) 55%, white), var(--chart-2))",
  rose: "linear-gradient(135deg, var(--glass-accent-c), var(--chart-5))",
  green: "linear-gradient(135deg, color-mix(in oklab, var(--chart-3) 55%, white), var(--chart-3))",
};
const ICON_SHADOW: Record<StepHue, string> = {
  violet: "0 6px 20px color-mix(in oklab, var(--glass-accent-a) 35%, transparent)",
  blue: "0 6px 20px color-mix(in oklab, var(--chart-2) 35%, transparent)",
  rose: "0 6px 20px color-mix(in oklab, var(--glass-accent-c) 35%, transparent)",
  green: "0 6px 20px color-mix(in oklab, var(--chart-3) 35%, transparent)",
};

interface ParcoursStep {
  Icon: LucideIcon;
  hue: StepHue;
  titleKey: string;
  descKey: string;
  /// Avertissement mis en avant (badge rose doux).
  warning?: { titleKey: string; messageKey: string };
}

const STEPS: ParcoursStep[] = [
  {
    Icon: SendIcon,
    hue: "violet",
    titleKey: "ctParcoursStep1Title",
    descKey: "ctParcoursStep1Desc",
  },
  {
    Icon: UsersIcon,
    hue: "blue",
    titleKey: "ctParcoursStep2Title",
    descKey: "ctParcoursStep2Desc",
  },
  {
    Icon: FileTextIcon,
    hue: "rose",
    titleKey: "ctParcoursStep3Title",
    descKey: "ctParcoursStep3Desc",
    warning: {
      titleKey: "ctParcoursStep3WarningTitle",
      messageKey: "ctParcoursStep3WarningMessage",
    },
  },
  {
    Icon: EuroIcon,
    hue: "green",
    titleKey: "ctParcoursStep4Title",
    descKey: "ctParcoursStep4Desc",
  },
];

/// Révélation à l'entrée dans le viewport. Les setState passent par le
/// callback de l'IntersectionObserver ou un setTimeout (asynchrones) —
/// conforme à la règle react-hooks/set-state-in-effect.
function useRevealOnView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      // Pas d'observer disponible : on affiche sans séquence.
      const t = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, visible };
}

export function CtParcours() {
  const t = useTranslations("public.landing");
  const { ref, visible } = useRevealOnView<HTMLElement>();

  // Avant révélation : masqué — SAUF en reduced-motion, où le contenu reste
  // toujours visible (jamais de contenu caché derrière une animation).
  const stepClass = visible
    ? "outils-rise"
    : "opacity-0 motion-reduce:opacity-100";

  return (
    <section
      ref={ref}
      className="flex flex-col gap-7"
      aria-labelledby="ct-parcours-title"
    >
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          {t("ctParcoursEyebrow")}
        </p>
        <h2
          id="ct-parcours-title"
          className="glass-display max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[38px]"
        >
          {t.rich("ctParcoursTitle", {
            em: (chunks) => <em>{chunks}</em>,
          })}
        </h2>
        <p className="max-w-[640px] text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          {t("ctParcoursIntro")}
        </p>
      </div>

      <div className="glass-surface p-6 sm:p-8">
        <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
          {/* Fil conducteur horizontal (desktop) — derrière les pastilles,
              du centre de la 1ʳᵉ pastille au centre de la dernière. */}
          <span
            aria-hidden
            className="absolute top-6 left-6 hidden h-px md:block md:right-[calc(25%-1.5rem)]"
            style={{ background: "var(--glass-ink-line)" }}
          />
          {STEPS.map(({ Icon, hue, titleKey, descKey, warning }, idx) => {
            const title = t(titleKey as Parameters<typeof t>[0]);
            const desc = t(descKey as Parameters<typeof t>[0]);
            return (
            <li
              key={titleKey}
              className={`relative flex gap-4 md:flex-col ${stepClass}`}
              // Décalage croissant → les étapes apparaissent en séquence.
              style={visible ? { animationDelay: `${idx * 140}ms` } : undefined}
            >
              {/* Fil conducteur vertical (mobile). */}
              {idx < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute top-14 -bottom-8 left-6 w-px md:hidden"
                  style={{ background: "var(--glass-ink-line)" }}
                />
              ) : null}

              <span
                className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl text-white"
                style={{
                  backgroundImage: ICON_BG[hue],
                  boxShadow: ICON_SHADOW[hue],
                }}
              >
                <Icon className="size-5" strokeWidth={2.2} />
                <span
                  aria-hidden
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: "var(--glass-ink)",
                    color: "var(--glass-bg-a)",
                  }}
                >
                  {idx + 1}
                </span>
              </span>

              <div className="flex min-w-0 flex-col gap-1.5">
                <h3 className="text-[15px] font-bold tracking-tight">
                  {title}
                </h3>
                <p className="text-[12.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
                  {desc}
                </p>
                {warning ? (
                  <div
                    className="mt-1.5 flex flex-col gap-1 rounded-xl border px-3.5 py-3"
                    style={{
                      borderColor:
                        "color-mix(in oklab, var(--glass-accent-c) 45%, transparent)",
                      background:
                        "color-mix(in oklab, var(--glass-accent-c) 14%, var(--glass-surface))",
                    }}
                  >
                    <p
                      className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em]"
                      style={{ color: "var(--glass-pop-fg)" }}
                    >
                      <AlertTriangleIcon
                        className="size-3.5 shrink-0"
                        strokeWidth={2.4}
                      />
                      {t(warning.titleKey as Parameters<typeof t>[0])}
                    </p>
                    <p className="text-[12px] leading-[1.5] font-medium text-[color:var(--glass-ink)]">
                      {t(warning.messageKey as Parameters<typeof t>[0])}
                    </p>
                  </div>
                ) : null}
              </div>
            </li>
            );
          })}
        </ol>

        <div
          className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6"
          style={{ borderColor: "var(--glass-ink-line)" }}
        >
          <Link
            href={DOSSIER_HREF}
            className="glass-cta inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
          >
            {t("ctParcoursCtaPrimary")}
            <ArrowRightIcon className="size-4" strokeWidth={2.4} />
          </Link>
          <Link
            href={DOSSIER_HREF}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-6 py-3.5 text-[13.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-[color:var(--glass-surface-strong)] hover:text-[color:var(--glass-ink)] motion-reduce:transition-none"
          >
            <FolderOpenIcon className="size-4" strokeWidth={2.2} />
            {t("ctParcoursCtaSecondary")}
          </Link>
        </div>
      </div>
    </section>
  );
}
