"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon } from "lucide-react";
import { Tool } from "@/lib/docbel-data";
import { IconDisplay } from "@/components/admin/documents/icon-picker";
import { pickToolVisual } from "@/components/docbel/landing/tool-card";
import {
  CalcCP,
  FormFlow,
  InfoPanel,
  LinkPanel,
  Tutorial,
} from "./tool-views";
import {
  CalcBrutNet,
  CalcPreavis,
  CalcPecule,
  CalcChomage,
  CalcIndemnite,
  CalcPension,
  CalcAllocsFam,
  CalcIPP,
  CalcTarifSocial,
  CalcKm,
} from "./calculators";

const VARIANT_BG: Record<string, string> = {
  a: "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
  b: "linear-gradient(135deg, var(--glass-accent-c), var(--chart-5))",
  c: "linear-gradient(135deg, var(--glass-accent-d), var(--chart-1))",
  d: "linear-gradient(135deg, color-mix(in oklab, var(--chart-3) 60%, white), var(--chart-3))",
  e: "linear-gradient(135deg, color-mix(in oklab, var(--chart-2) 55%, white), var(--glass-accent-deep))",
  f: "linear-gradient(135deg, color-mix(in oklab, var(--chart-1) 45%, white), var(--glass-accent-d))",
  g: "linear-gradient(135deg, var(--glass-accent-b), var(--glass-accent-a))",
  h: "linear-gradient(135deg, var(--glass-accent-c), var(--glass-accent-d))",
};

interface ToolPageProps {
  tool: Tool;
  accent: string;
  onBack: () => void;
  lang: string;
}

interface PreavisMetadata {
  source: string;
  lastUpdated: string;
}

export function ToolPage({ tool, accent, onBack, lang }: ToolPageProps) {
  const t = useTranslations("public.outils");
  const [preavisMetadata, setPreavisMetadata] = useState<PreavisMetadata | null>(null);
  const type = tool.type || "form";

  useEffect(() => {
    if (type !== "calc_preavis") return;

    fetch("/api/admin/preavis")
      .then((response) => response.json())
      .then((data) => {
        setPreavisMetadata({
          source: data.metadata?.source || "SPF Emploi",
          lastUpdated: data.metadata?.lastUpdated || "",
        });
      })
      .catch(() => {
        setPreavisMetadata({
          source: "SPF Emploi",
          lastUpdated: "",
        });
      });
  }, [type]);

  const visual = pickToolVisual(tool);

  return (
    <section className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition-colors outline-none hover:bg-[color:var(--glass-surface-strong)] focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
        >
          <ArrowLeftIcon className="size-4" />
          {t("back")}
        </button>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]"
          style={{ background: "var(--glass-surface)" }}
        >
          {tool.cat}
        </span>
        {tool.popular ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.05em]"
            style={{
              background: "var(--glass-pop-bg)",
              color: "var(--glass-pop-fg)",
            }}
          >
            {t("popular")}
          </span>
        ) : null}
      </div>

      <article className="glass-surface flex flex-col gap-6 p-5 sm:p-9">
        <header className="flex items-center gap-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{
              backgroundImage: VARIANT_BG[visual.variant],
            }}
          >
            <IconDisplay value={tool.icon} className="w-7 h-7" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="glass-display text-[28px] font-semibold leading-[1.1] sm:text-[32px]">
              {tool.title}
            </h1>
            <p className="text-[13.5px] text-[color:var(--glass-ink-soft)]">
              {tool.desc}
            </p>
          </div>
        </header>

        <div>
          {type === "calc_preavis" && <CalcPreavis accent={accent} />}
          {type === "calc_cp" && <CalcCP accent={accent} />}
          {/* Batch calculateurs citoyens 2026-05 — cf. components/docbel/calculators/ */}
          {type === "calc_brut_net" && <CalcBrutNet accent={accent} />}
          {type === "calc_pecule" && <CalcPecule accent={accent} />}
          {type === "calc_chomage" && <CalcChomage accent={accent} />}
          {type === "calc_indemnite" && <CalcIndemnite accent={accent} />}
          {type === "calc_pension" && <CalcPension accent={accent} />}
          {type === "calc_allocs_fam" && <CalcAllocsFam accent={accent} />}
          {type === "calc_ipp" && <CalcIPP accent={accent} />}
          {type === "calc_tarif_social" && <CalcTarifSocial accent={accent} />}
          {type === "calc_km" && <CalcKm accent={accent} />}
          {/* type "locator" retiré : le seul outil concerné (slug "bureaux")
              a sa propre page app/outils/bureaux/page.tsx qui prend la
              priorité de routing. Composants BureauLocator/Wizard supprimés. */}
          {type === "tutorial" && <Tutorial tool={tool} accent={accent} />}
          {type === "info" && <InfoPanel tool={tool} accent={accent} />}
          {type === "link" && <LinkPanel tool={tool} accent={accent} />}
          {(type === "form" || type === "doc" || type === "calc") && (
            <FormFlow tool={tool} accent={accent} lang={lang} />
          )}
        </div>

        {type === "calc_preavis" && preavisMetadata ? (
          <footer
            className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[12px] text-[color:var(--glass-ink-faint)]"
            style={{ borderTopColor: "var(--glass-ink-line)" }}
          >
            <span>
              {t("sourceLabel")}{" "}
              <span className="font-semibold text-[color:var(--glass-ink)]">
                {preavisMetadata.source}
              </span>
            </span>
            {preavisMetadata.lastUpdated ? (
              <span>
                {t("updatedLabel")}{" "}
                <span className="font-semibold text-[color:var(--glass-ink)]">
                  {preavisMetadata.lastUpdated}
                </span>
              </span>
            ) : null}
          </footer>
        ) : null}
      </article>
    </section>
  );
}
