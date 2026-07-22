"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  Building2Icon,
  CalculatorIcon,
  CalendarRangeIcon,
  ClockIcon,
  FileTextIcon,
  HeartIcon,
  type LucideIcon,
  PhoneIcon,
  ScaleIcon,
  StarIcon,
} from "lucide-react";
import { type Tool, getToolSlug } from "@/lib/docbel-data";

interface ToolVisual {
  Icon: LucideIcon;
  variant: "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
}

// Map a tool to an icon + color variant. Index breaks ties between tools that
// match the same predicate so two C-prefixed forms don't paint identically.
export function pickToolVisual(tool: Tool, index = 0): ToolVisual {
  const t = tool.title.toLowerCase();
  if (
    t.includes("c1") ||
    t.includes("c4") ||
    t.includes("chômage") ||
    t.includes("temporaire")
  )
    return { Icon: FileTextIcon, variant: index % 2 === 0 ? "a" : "b" };
  if (t.includes("préavis") || t.includes("preavis"))
    return { Icon: ScaleIcon, variant: "c" };
  if (t.includes("agr") || t.includes("calcul") || t.includes("salaire"))
    return { Icon: CalculatorIcon, variant: "d" };
  if (t.includes("bureau") || t.includes("organisme") || t.includes("onem"))
    return { Icon: Building2Icon, variant: "e" };
  if (t.includes("cpas") || t.includes("aide") || t.includes("ris"))
    return { Icon: HeartIcon, variant: "f" };
  if (t.includes("reprise") || t.includes("emploi"))
    return { Icon: CalendarRangeIcon, variant: "g" };
  return { Icon: PhoneIcon, variant: "h" };
}

const VARIANT_BG: Record<ToolVisual["variant"], string> = {
  a: "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
  b: "linear-gradient(135deg, var(--glass-accent-c), var(--chart-5))",
  c: "linear-gradient(135deg, var(--glass-accent-d), var(--chart-1))",
  d: "linear-gradient(135deg, color-mix(in oklab, var(--chart-3) 60%, white), var(--chart-3))",
  e: "linear-gradient(135deg, color-mix(in oklab, var(--chart-2) 55%, white), var(--glass-accent-deep))",
  f: "linear-gradient(135deg, color-mix(in oklab, var(--chart-1) 45%, white), var(--glass-accent-d))",
  g: "linear-gradient(135deg, var(--glass-accent-b), var(--glass-accent-a))",
  h: "linear-gradient(135deg, var(--glass-accent-c), var(--glass-accent-d))",
};

const VARIANT_SHADOW: Record<ToolVisual["variant"], string> = {
  a: "0 6px 20px color-mix(in oklab, var(--glass-accent-a) 35%, transparent)",
  b: "0 6px 20px color-mix(in oklab, var(--chart-5) 35%, transparent)",
  c: "0 6px 20px color-mix(in oklab, var(--chart-1) 35%, transparent)",
  d: "0 6px 20px color-mix(in oklab, var(--chart-3) 35%, transparent)",
  e: "0 6px 20px color-mix(in oklab, var(--chart-2) 35%, transparent)",
  f: "0 6px 20px color-mix(in oklab, var(--chart-1) 40%, transparent)",
  g: "0 6px 20px color-mix(in oklab, var(--glass-accent-b) 30%, transparent)",
  h: "0 6px 20px color-mix(in oklab, var(--glass-accent-c) 30%, transparent)",
};

interface LandingToolCardProps {
  tool: Tool;
  /** Index in the surrounding list — used as a tie-breaker for the icon variant. */
  index?: number;
}

export function LandingToolCard({ tool, index = 0 }: LandingToolCardProps) {
  const router = useRouter();
  const t = useTranslations("public.home");
  const visual = pickToolVisual(tool, index);
  const Icon = visual.Icon;

  // Si le tool a un `href` explicite (ex: /partenaire/lookup-onem), on l'utilise.
  // Sinon routage par slug : /outils/{slug}.
  const targetHref = tool.href ?? `/outils/${getToolSlug(tool)}`;

  return (
    <button
      type="button"
      onClick={() => router.push(targetHref)}
      className="glass-surface glass-interactive relative flex min-h-[210px] flex-col gap-3.5 p-5 text-left"
    >
      <span
        className="flex size-12 items-center justify-center rounded-2xl text-white"
        style={{
          backgroundImage: VARIANT_BG[visual.variant],
          boxShadow: VARIANT_SHADOW[visual.variant],
        }}
      >
        <Icon className="size-5" />
      </span>
      <div className="text-[15.5px] font-bold tracking-tight">{tool.title}</div>
      <p className="flex-1 text-[12.5px] leading-[1.45] text-[color:var(--glass-ink-soft)]">
        {tool.desc}
      </p>
      <div className="flex items-center justify-between border-t border-[color:var(--glass-ink-line)] pt-3 text-[11.5px] font-semibold text-[color:var(--glass-ink-faint)]">
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon className="size-3" />
          {tool.time}
        </span>
        {tool.popular ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-[0.05em]"
            style={{
              background: "var(--glass-pop-bg)",
              color: "var(--glass-pop-fg)",
            }}
          >
            <StarIcon className="size-2.5" strokeWidth={2.4} />
            {t("toolPopularBadge")}
          </span>
        ) : (
          <span
            className="flex size-6 items-center justify-center rounded-full"
            style={{
              background: "var(--glass-ink)",
              color: "var(--glass-bg-a)",
            }}
          >
            <ArrowRightIcon className="size-3" strokeWidth={2.4} />
          </span>
        )}
      </div>
    </button>
  );
}
