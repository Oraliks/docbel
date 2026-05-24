"use client";

import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Tool } from "@/lib/docbel-data";
import { IconDisplay } from "@/components/admin/documents/icon-picker";
import { pickToolVisual } from "@/components/docbel/landing/tool-card";
import {
  CalcAGR,
  CalcCP,
  CalcPreavis,
  FormFlow,
  InfoPanel,
  LinkPanel,
  Tutorial,
} from "./tool-views";

const VARIANT_BG: Record<string, string> = {
  a: "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
  b: "linear-gradient(135deg, var(--glass-accent-c), #E060A0)",
  c: "linear-gradient(135deg, var(--glass-accent-d), #FF8050)",
  d: "linear-gradient(135deg, #80E0C0, #40C0A0)",
  e: "linear-gradient(135deg, #80B0FF, #5060FF)",
  f: "linear-gradient(135deg, #FFE070, var(--glass-accent-d))",
  g: "linear-gradient(135deg, #D08CFF, var(--glass-accent-a))",
  h: "linear-gradient(135deg, #FF8CC0, #FFB070)",
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
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition-colors outline-none hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
        >
          <ArrowLeftIcon className="size-4" />
          Retour
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
            Populaire
          </span>
        ) : null}
      </div>

      <article className="glass-surface flex flex-col gap-6 p-7 sm:p-9">
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
          {type === "calc_agr" && <CalcAGR accent={accent} />}
          {type === "calc_cp" && <CalcCP accent={accent} />}
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
              Source :{" "}
              <span className="font-semibold text-[color:var(--glass-ink)]">
                {preavisMetadata.source}
              </span>
            </span>
            {preavisMetadata.lastUpdated ? (
              <span>
                Mise à jour :{" "}
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
