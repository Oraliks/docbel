"use client";

import React, { useEffect, useState } from "react";
import { ClockIcon } from "./icons";
import { Tool } from "@/lib/docbel-data";
import {
  CalcPreavis,
  CalcAGR,
  CalcCP,
  Locator,
  Tutorial,
  InfoPanel,
  LinkPanel,
  FormFlow,
} from "./tool-views";

interface ToolPageProps {
  tool: Tool;
  accent: string;
  onBack: () => void;
  lang: string;
}

interface PreavisMetadata {
  source: string;
  lastUpdated: string;
  note?: string;
}

export function ToolPage({ tool, accent, onBack, lang }: ToolPageProps) {
  const type = tool.type || "form";
  const [preavisMetadata, setPreavisMetadata] = useState<PreavisMetadata | null>(null);

  useEffect(() => {
    if (type === "calc_preavis") {
      fetch("/api/admin/preavis")
        .then((res) => res.json())
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
    }
  }, [type]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-7 text-xs text-muted-foreground">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-transparent cursor-pointer font-semibold text-muted-foreground transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{ "--accent": accent } as React.CSSProperties}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Retour
        </button>
        <span className="text-secondary-foreground">›</span>
        <span>{tool.cat}</span>
        <span className="text-secondary-foreground">›</span>
        <span className="text-foreground font-semibold">{tool.title}</span>
      </div>

      <div className="p-7 bg-surface rounded-2xl border border-border shadow-sm">
        {type === "calc_preavis" && <CalcPreavis accent={accent} />}
        {type === "calc_agr" && <CalcAGR accent={accent} />}
        {type === "calc_cp" && <CalcCP accent={accent} />}
        {type === "locator" && <Locator tool={tool} accent={accent} />}
        {type === "tutorial" && <Tutorial tool={tool} accent={accent} />}
        {type === "info" && <InfoPanel tool={tool} accent={accent} />}
        {type === "link" && <LinkPanel tool={tool} accent={accent} />}
        {(type === "form" || type === "doc" || type === "calc") && (
          <FormFlow tool={tool} accent={accent} lang={lang} />
        )}

        {/* Metadata footer for preavis calculator */}
        {type === "calc_preavis" && preavisMetadata && (
          <div className="mt-8 pt-6 border-t border-border/30 text-xs text-muted-foreground flex items-center justify-between">
            <div>
              Source: <span className="font-medium">{preavisMetadata.source}</span>
            </div>
            {preavisMetadata.lastUpdated && (
              <div>
                Mise à jour: <span className="font-medium">{preavisMetadata.lastUpdated}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
