/**
 * « Comment ça se passe » — bande illustrée du hub /chomage.
 *
 * Aperçu (non interactif) du parcours universel d'une démarche chômage :
 * réutilise les vignettes SVG maison (journey-illustrations) et la ligne
 * dessinée du « chemin de demande » de l'écran journey — même langage visuel,
 * pour que le hub prépare l'expérience qui suit dans un dossier.
 *
 * Les montants « à la clé » sont composés depuis la SOURCE UNIQUE
 * lib/chomage/params.ts (jamais de chiffre en dur) et portent un badge de
 * validité daté + source ONEM (concept ValidityBadge de l'audit archi).
 *
 * Server Component : rendu statique, aucune interaction ici (elle vit dans le
 * dossier). Les vignettes sont du SVG pur → pas de frontière client.
 */

import { getTranslations } from "next-intl/server";

import { JourneyVignette } from "@/components/docbel/journey-illustrations";
import { getInsertionParams, mensuelBrut } from "@/lib/chomage/params";
import type { JourneyStepIcon } from "@/lib/dossiers/types";

const EUR = new Intl.NumberFormat("fr-BE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Ligne « à la main » reliant 4 jalons (viewBox 400×40). Décorative :
// les cartes numérotées portent le sens, la ligne fait le liant visuel.
const PATH_D = "M12 26 C 60 14, 100 12, 150 18 S 250 30, 300 22 S 372 12, 392 18";
const NODES = [50, 150, 250, 350];

interface Step {
  icon: JourneyStepIcon;
  title: string;
  desc: string;
}

export async function CommentCaMarche() {
  const t = await getTranslations("public.landing");

  const steps: Step[] = [
    { icon: "user-check", title: t("chomageHubHowStep1Title"), desc: t("chomageHubHowStep1Desc") },
    { icon: "calendar", title: t("chomageHubHowStep2Title"), desc: t("chomageHubHowStep2Desc") },
    { icon: "file-check", title: t("chomageHubHowStep3Title"), desc: t("chomageHubHowStep3Desc") },
    { icon: "wallet", title: t("chomageHubHowStep4Title"), desc: t("chomageHubHowStep4Desc") },
  ];

  // Montants « à la clé » — exemple allocation d'insertion, source unique datée.
  const insertion = getInsertionParams();
  const [aaaa, mm, jj] = insertion.validFrom.split("-");
  const dateFr = `${jj}/${mm}/${aaaa}`;
  const chargeFamille = EUR.format(mensuelBrut(insertion.values.montantsJour.chargeFamille));
  const isole = EUR.format(mensuelBrut(insertion.values.montantsJour.isole.aPartirDe21));

  return (
    <section
      aria-labelledby="chomage-how-heading"
      className="glass-surface flex flex-col gap-6 p-5 sm:p-7 lg:p-8"
    >
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          {t("chomageHubHowEyebrow")}
        </p>
        <h2
          id="chomage-how-heading"
          className="glass-display text-[24px] font-semibold leading-[1.12] sm:text-[28px]"
        >
          {t("chomageHubHowTitle")}
        </h2>
      </header>

      {/* Ligne dessinée reliant les jalons — décorative, masquée sur mobile. */}
      <svg
        viewBox="0 0 400 40"
        className="hidden h-10 w-full lg:block"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={PATH_D}
          fill="none"
          stroke="color-mix(in oklab, var(--glass-accent-deep) 26%, transparent)"
          strokeWidth="2"
          strokeDasharray="5 6"
          strokeLinecap="round"
        />
        {NODES.map((x, i) => (
          <g key={x}>
            <circle
              cx={x}
              cy={i % 2 === 0 ? 22 : 18}
              r="6"
              fill="var(--glass-accent-deep)"
            />
            <text
              x={x}
              y={i % 2 === 0 ? 25.5 : 21.5}
              textAnchor="middle"
              fontSize="8"
              fontWeight="700"
              fill="white"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>

      {/* Étapes illustrées — vraie séquence (numérotation justifiée). */}
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <li
            key={step.icon}
            className="outils-rise flex flex-col gap-2"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div
              className="glass-icon-tile flex aspect-[5/4] w-full items-center justify-center rounded-2xl"
              style={{
                background: "color-mix(in oklab, var(--glass-accent-deep) 9%, transparent)",
                "--tile-hue": "var(--glass-accent-deep)",
              } as React.CSSProperties}
            >
              <JourneyVignette icon={step.icon} className="h-20 w-20" />
            </div>
            <p className="mt-1 flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--glass-accent-deep)] text-[11px] font-bold text-white lg:hidden">
                {i + 1}
              </span>
              <span className="text-[14.5px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                {step.title}
              </span>
            </p>
            <p className="text-[13px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
              {step.desc}
            </p>
          </li>
        ))}
      </ol>

      {/* À la clé — montants sourcés (source unique, badge de validité). */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="glass-icon-tile flex size-11 shrink-0 items-center justify-center rounded-xl text-[color:var(--glass-accent-deep)]"
            style={{
              background: "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)",
              "--tile-hue": "var(--glass-accent-deep)",
            } as React.CSSProperties}
            aria-hidden
          >
            <JourneyVignette icon="wallet" className="h-7 w-7" />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-[color:var(--glass-ink)]">
              {t("chomageHubHowAmountsTitle")}
            </p>
            <p className="text-[11.5px] leading-snug text-[color:var(--glass-ink-faint)]">
              {t("chomageHubHowAmountsSource", { date: dateFr })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
          <p className="flex flex-col">
            <span className="text-[11px] font-medium text-[color:var(--glass-ink-soft)]">
              {t("chomageHubHowAmountsCharge")}
            </span>
            <span className="text-[16px] font-bold leading-tight text-[color:var(--glass-ink)]">
              {chargeFamille} €
              <span className="text-[11px] font-medium text-[color:var(--glass-ink-faint)]">
                {" "}
                {t("chomageHubHowAmountsPerMonth")}
              </span>
            </span>
          </p>
          <p className="flex flex-col">
            <span className="text-[11px] font-medium text-[color:var(--glass-ink-soft)]">
              {t("chomageHubHowAmountsIsole")}
            </span>
            <span className="text-[16px] font-bold leading-tight text-[color:var(--glass-ink)]">
              {isole} €
              <span className="text-[11px] font-medium text-[color:var(--glass-ink-faint)]">
                {" "}
                {t("chomageHubHowAmountsPerMonth")}
              </span>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
