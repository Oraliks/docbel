"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import { LandingToolCard } from "./tool-card";
import { CATEGORIES, type Tool } from "@/lib/docbel-data";

interface LandingToolsProps {
  tools: Tool[];
  /** Cap the number of cards displayed. Default 8 for the home grid. */
  max?: number;
  /** Show the "Voir tous les outils" footer link. Default true. */
  showSeeAll?: boolean;
}

export function LandingTools({
  tools,
  max = 8,
  showSeeAll = true,
}: LandingToolsProps) {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState("Tous");

  const filtered = tools.filter(
    (tool) => activeCat === "Tous" || tool.cat === activeCat,
  );
  const visible = filtered.slice(0, max);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 px-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="glass-display text-[32px] font-semibold leading-none">
            Vos outils, <em>en un geste.</em>
          </h2>
          <p className="mt-1.5 text-[13px] text-[color:var(--glass-ink-soft)]">
            {tools.length} outils disponibles · pré-remplis depuis votre profil
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => {
            const active = cat === activeCat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCat(cat)}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
                  active
                    ? "border-transparent text-[color:var(--glass-bg-a)] shadow-[0_4px_14px_rgba(42,15,77,0.22)]"
                    : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55 hover:text-[color:var(--glass-ink)] dark:hover:bg-white/10"
                }`}
                style={active ? { background: "var(--glass-ink)" } : undefined}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
        {visible.map((tool, index) => (
          <LandingToolCard key={tool.id} tool={tool} index={index} />
        ))}
      </div>

      {showSeeAll ? (
        <div className="flex justify-end px-2">
          <button
            type="button"
            onClick={() => router.push("/outils")}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
          >
            Voir tous les outils
            <ArrowRightIcon className="size-3.5" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
