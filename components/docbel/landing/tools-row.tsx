import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon, Clock3Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { type Tool, getToolSlug } from "@/lib/docbel-data";
import { glyphForTool } from "@/lib/tool-glyphs";
import { cn } from "@/lib/utils";

interface LandingToolsRowProps {
  tools: Tool[];
  max?: number;
}

/**
 * Catalogue court, entierement lisible sur mobile. Les titres ne dependent
 * plus d'un hover et aucun element ne flotte en boucle.
 */
export async function LandingToolsRow({
  tools,
  max = 3,
}: LandingToolsRowProps) {
  const t = await getTranslations("public.home");
  const visible = tools.slice(0, Math.max(0, Math.min(max, 3)));

  return (
    <section
      aria-labelledby="landing-tools-heading"
      className="glass-surface p-4 sm:p-6 lg:p-7"
    >
      <header className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
        <h2
          id="landing-tools-heading"
          className="glass-display text-[27px] font-semibold leading-[1.05] sm:text-[32px]"
        >
          {t("toolsTitleLine1")} {" "}
          <em className="text-[color:var(--glass-accent-deep)]">
            {t("toolsTitleEm")}
          </em>
        </h2>
        <Link
          href="/outils"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 w-fit")}
        >
          {t.rich("seeAllTools", { br: () => " " })}
          <ArrowRightIcon data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
        </Link>
      </header>

      <ul className="flex flex-col lg:flex-row">
        {visible.map((tool, index) => {
          const { Icon, hue } = glyphForTool(tool);
          const href = tool.href ?? `/outils/${getToolSlug(tool)}`;
          const tint = `color-mix(in oklab, ${hue} 14%, transparent)`;

          return (
            <li key={tool.id} className="flex min-w-0 flex-1 flex-col lg:flex-row">
              <Link
                href={href}
                className="glass-interactive group flex min-h-24 flex-1 items-center gap-3 rounded-xl px-2 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] lg:px-5"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: tint, color: hue }}
                >
                  <Icon className="size-5" strokeWidth={1.9} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold leading-snug text-[color:var(--glass-ink)]">
                      {tool.title}
                    </span>
                    {index === 0 && tool.popular ? (
                      <Badge variant="secondary">{t("toolPopularBadge")}</Badge>
                    ) : null}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-[color:var(--glass-ink-soft)]">
                    {tool.desc}
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--glass-ink-faint)]">
                    <Clock3Icon className="size-3.5" aria-hidden />
                    {tool.time}
                  </span>
                </span>
                <ArrowRightIcon className="shrink-0 text-[color:var(--glass-accent-deep)] rtl:rotate-180" aria-hidden />
              </Link>
              {index < visible.length - 1 ? (
                <>
                  <Separator className="lg:hidden" />
                  <Separator orientation="vertical" className="hidden lg:block" />
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
