"use client";

// Mini-moteur « Quelle commission paritaire ? » pour la landing employeur.
// Ne calcule rien lui-même : il pousse vers l'outil complet
// /outils/commissions-paritaires en préremplissant la recherche via ?q=
// (paramètre lu par components/docbel/commissions-paritaires-page.tsx).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, Building2Icon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { GLASS_INPUT } from "@/lib/glass-classes";

const TOOL_PATH = "/outils/commissions-paritaires";

/// Secteurs fréquents côté employeurs — un clic pousse la recherche directement.
const SUGGESTIONS = ["Construction", "Horeca", "Transport"] as const;

export function CpFinderTeaser() {
  const router = useRouter();
  const [term, setTerm] = useState("");

  const goTo = (raw: string) => {
    const q = raw.trim();
    // Champ vide → on ouvre quand même l'outil (informatif, jamais bloquant).
    router.push(q ? `${TOOL_PATH}?q=${encodeURIComponent(q)}` : TOOL_PATH);
  };

  return (
    <aside
      className="glass-surface relative overflow-hidden p-6 sm:p-8"
      aria-labelledby="cp-finder-title"
    >
      {/* Halo décoratif diffus, dans l'esprit des cartes dégradées du site. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full"
        style={{
          background:
            "color-mix(in oklab, var(--glass-accent-a) 22%, transparent)",
          filter: "blur(48px)",
        }}
      />

      <div className="relative grid items-center gap-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col gap-3">
          <span
            className="flex size-12 items-center justify-center rounded-2xl text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
              boxShadow: "0 6px 20px color-mix(in oklab, var(--glass-accent-a) 35%, transparent)",
            }}
          >
            <Building2Icon className="size-5" strokeWidth={2.2} />
          </span>
          <h3
            id="cp-finder-title"
            className="text-[20px] font-bold tracking-tight sm:text-[22px]"
          >
            Quelle commission paritaire pour votre entreprise ?
          </h3>
          <p className="text-[12.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
            La commission paritaire (CP) détermine les barèmes, les préavis et
            les conditions sectorielles applicables à vos travailleurs.
          </p>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            goTo(term);
          }}
        >
          <label htmlFor="cp-finder-input" className="sr-only">
            Secteur d&apos;activité ou numéro de commission paritaire
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
              <Input
                id="cp-finder-input"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Ex. : boulangerie, garage, 124…"
                className={`${GLASS_INPUT} h-12 pl-11`}
              />
            </div>
            <button
              type="submit"
              className="glass-cta inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-[14px] font-bold"
            >
              Trouver
              <ArrowRightIcon className="size-4" strokeWidth={2.4} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
              Essayez :
            </span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => goTo(s)}
                className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 py-1.5 text-[12px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 hover:text-[color:var(--glass-ink)] motion-reduce:transition-none dark:hover:bg-white/10"
              >
                {s}
              </button>
            ))}
          </div>
        </form>
      </div>
    </aside>
  );
}
