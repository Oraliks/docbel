import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon, Clock3Icon } from "lucide-react";
import { type Tool, getToolSlug } from "@/lib/docbel-data";
import { glyphForTool } from "@/lib/tool-glyphs";

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
  max = 8,
}: LandingToolsRowProps) {
  const t = await getTranslations("public.home");
  const visible = tools.slice(0, max);

  return (
    <section
      aria-labelledby="landing-tools-heading"
      className="glass-surface relative overflow-hidden p-4 sm:p-6 lg:p-7"
    >
      <div
        aria-hidden
        data-a11y-secondary="true"
        className="pointer-events-none absolute -right-20 -bottom-24 size-60 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--glass-accent-c)" }}
      />

      <header className="relative mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
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
          className="glass-interactive inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[12.5px] font-bold text-[color:var(--glass-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
        >
          {t.rich("seeAllTools", { br: () => " " })}
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      </header>

      <ul className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visible.map((tool, index) => {
          const { Icon, hue } = glyphForTool(tool);
          const href = tool.href ?? `/outils/${getToolSlug(tool)}`;
          const tint = `color-mix(in oklab, ${hue} 14%, transparent)`;

          return (
            <li key={tool.id} className="min-w-0">
              <Link
                href={href}
                className="glass-interactive group flex h-full min-h-[150px] flex-col rounded-[20px] border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
              >
                <span className="flex items-start justify-between gap-3">
                  <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--glass-border)] transition-transform duration-200 group-active:scale-95 motion-reduce:transition-none"
                    style={{ background: tint, color: hue }}
                  >
                    <Icon className="size-5" strokeWidth={1.9} />
                  </span>
                  {index === 0 && tool.popular && (
                    <span className="rounded-full bg-[color:var(--glass-pop-bg)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-pop-fg)]">
                      {t("toolPopularBadge")}
                    </span>
                  )}
                </span>

                <span className="mt-3 block text-[14px] font-bold leading-snug text-[color:var(--glass-ink)]">
                  {tool.title}
                </span>
                <span className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-[color:var(--glass-ink-soft)]">
                  {tool.desc}
                </span>

                <span className="mt-auto flex items-center justify-between gap-3 pt-3 text-[11px] font-semibold text-[color:var(--glass-ink-faint)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3Icon className="size-3.5" aria-hidden />
                    {tool.time}
                  </span>
                  <ArrowRightIcon
                    className="size-4 text-[color:var(--glass-accent-deep)] transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
