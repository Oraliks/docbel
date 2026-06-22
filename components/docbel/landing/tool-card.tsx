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
  b: "linear-gradient(135deg, var(--glass-accent-c), #E060A0)",
  c: "linear-gradient(135deg, var(--glass-accent-d), #FF8050)",
  d: "linear-gradient(135deg, #80E0C0, #40C0A0)",
  e: "linear-gradient(135deg, #80B0FF, #5060FF)",
  f: "linear-gradient(135deg, #FFE070, var(--glass-accent-d))",
  g: "linear-gradient(135deg, #D08CFF, var(--glass-accent-a))",
  h: "linear-gradient(135deg, #FF8CC0, #FFB070)",
};

const VARIANT_SHADOW: Record<ToolVisual["variant"], string> = {
  a: "0 6px 20px rgba(159,124,255,0.35)",
  b: "0 6px 20px rgba(255,140,192,0.35)",
  c: "0 6px 20px rgba(255,176,112,0.35)",
  d: "0 6px 20px rgba(128,224,192,0.35)",
  e: "0 6px 20px rgba(128,176,255,0.35)",
  f: "0 6px 20px rgba(255,224,112,0.40)",
  g: "0 6px 20px rgba(208,140,255,0.30)",
  h: "0 6px 20px rgba(255,140,192,0.30)",
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
