"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  BanknoteIcon,
  CalculatorIcon,
  CarIcon,
  ClockIcon,
  EuroIcon,
  FileTextIcon,
  type LucideIcon,
  MapPinIcon,
  PercentIcon,
  ScaleIcon,
  ShieldIcon,
  UmbrellaIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { type Tool, getToolSlug } from "@/lib/docbel-data";

interface ToolGlyph {
  Icon: LucideIcon;
  /** Teinte unique : sert d'icône (pleine) ET de fond (mix translucide). */
  hue: string;
}

/**
 * Icône + teinte par outil, calquées sur la maquette de la home (≠
 * `pickToolVisual` qui sert la grille /outils avec des dégradés saturés).
 * Ici : pastille douce (teinte mixée en translucide → s'adapte clair/sombre)
 * + icône pleine teinte. Clé = slug stable ; fallback générique pour tout
 * outil hors maquette (la rangée reste cohérente si le catalogue évolue).
 */
const TOOL_GLYPHS: Record<string, ToolGlyph> = {
  preavis: { Icon: ScaleIcon, hue: "#F97316" },
  bureaux: { Icon: MapPinIcon, hue: "#8B5CF6" },
  "brut-net": { Icon: CalculatorIcon, hue: "#EC4899" },
  "pecule-vacances": { Icon: UmbrellaIcon, hue: "#FB923C" },
  "indemnite-rupture": { Icon: ShieldIcon, hue: "#7C3AED" },
  "pension-estimation": { Icon: EuroIcon, hue: "#10B981" },
  "allocations-familiales": { Icon: UsersIcon, hue: "#3B82F6" },
  "ipp-simulateur": { Icon: PercentIcon, hue: "#F59E0B" },
  "allocations-chomage": { Icon: BanknoteIcon, hue: "#14B8A6" },
  "tarif-social-energie": { Icon: ZapIcon, hue: "#EAB308" },
  "frais-kilometriques": { Icon: CarIcon, hue: "#06B6D4" },
};

const FALLBACK_GLYPH: ToolGlyph = {
  Icon: FileTextIcon,
  hue: "var(--glass-accent-deep)",
};

function glyphFor(tool: Tool): ToolGlyph {
  return TOOL_GLYPHS[getToolSlug(tool)] ?? FALLBACK_GLYPH;
}

interface LandingToolsRowProps {
  tools: Tool[];
  /** Nombre max d'icônes avant « Voir tous ». Défaut 8 (maquette). */
  max?: number;
}

/**
 * Espace outils version "rangée compacte" (maquette home) : un seul bandeau
 * verre = bloc titre à gauche + strip d'icônes pastel + « Voir tous les
 * outils ». Sous lg, le strip défile horizontalement. Remplace la grille de
 * cartes (`LandingTools`) sur la home uniquement — /outils garde son catalogue.
 */
export function LandingToolsRow({ tools, max = 8 }: LandingToolsRowProps) {
  const router = useRouter();
  const visible = tools.slice(0, max);

  // Colonne cliquable partagée par les outils ET le bouton « Voir tous » :
  // largeur fixe (strip scrollable) sous lg, équi-répartie (flex-1) au-delà.
  const itemBase =
    "group flex w-[88px] shrink-0 flex-col items-center gap-2 rounded-2xl px-1.5 py-2 text-center outline-none transition-colors hover:bg-white/45 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:hover:bg-white/[0.06] lg:w-auto lg:flex-1";

  return (
    <section className="glass-surface flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:gap-8 lg:p-7">
      <div className="shrink-0 lg:max-w-[190px]">
        <h2 className="glass-display text-[26px] font-semibold leading-[1.1]">
          Vos outils,
          <br />
          <em>en un geste.</em>
        </h2>
        <p className="mt-2 text-[12px] leading-snug text-[color:var(--glass-ink-faint)]">
          {tools.length} outils disponibles · pré-remplis depuis votre profil
        </p>
      </div>

      <div className="-mx-6 flex items-stretch gap-1 overflow-x-auto px-6 pb-1 lg:mx-0 lg:flex-1 lg:gap-2 lg:overflow-visible lg:px-0 lg:pb-0">
        {visible.map((tool) => {
          const { Icon, hue } = glyphFor(tool);
          const href = tool.href ?? `/outils/${getToolSlug(tool)}`;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => router.push(href)}
              className={itemBase}
            >
              <span
                className="flex size-[52px] items-center justify-center rounded-2xl transition-transform group-hover:-translate-y-0.5"
                style={{
                  background: `color-mix(in oklab, ${hue} 18%, transparent)`,
                  color: hue,
                }}
              >
                <Icon className="size-6" strokeWidth={1.9} />
              </span>
              <span className="line-clamp-2 min-h-[30px] text-[12px] font-bold leading-tight tracking-tight text-[color:var(--glass-ink)]">
                {tool.title}
              </span>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[color:var(--glass-ink-faint)]">
                <ClockIcon className="size-3" />
                {tool.time}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => router.push("/outils")}
          className={itemBase}
        >
          <span className="flex size-[52px] items-center justify-center rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink)] transition-transform group-hover:translate-x-0.5">
            <ArrowRightIcon className="size-5" />
          </span>
          <span className="line-clamp-2 min-h-[30px] text-[12px] font-bold leading-tight tracking-tight text-[color:var(--glass-ink-soft)]">
            Voir tous les outils
          </span>
        </button>
      </div>
    </section>
  );
}
