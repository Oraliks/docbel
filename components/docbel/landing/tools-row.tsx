import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon, Clock3Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type Tool, getToolSlug } from "@/lib/docbel-data";
import { glyphForTool } from "@/lib/tool-glyphs";
import { cn } from "@/lib/utils";

interface LandingToolsRowProps {
  tools: Tool[];
  max?: number;
}

/** Quatre outils reels du catalogue public, classes selon leur priorite serveur. */
export async function LandingToolsRow({
  tools,
  max = 4,
}: LandingToolsRowProps) {
  const t = await getTranslations("public.home");
  const visible = tools.slice(0, Math.max(0, Math.min(max, 4)));

  return (
    <Card
      aria-labelledby="landing-tools-heading"
      className="rounded-[24px] py-5 sm:py-6"
    >
      <CardHeader className="gap-2 px-5 sm:px-7">
        <CardTitle>
          <h2
            id="landing-tools-heading"
            className="glass-display text-[25px] font-semibold leading-tight sm:text-[29px]"
          >
            {t("toolsTitleLine1")} {" "}
            <em>{t("toolsTitleEm")}</em>
          </h2>
        </CardTitle>
        <CardAction>
          <Link
            href="/outils"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "shrink-0 text-primary",
            )}
          >
            <span className="sr-only sm:not-sr-only sm:inline">
              {t.rich("seeAllTools", { br: () => " " })}
            </span>
            <ArrowRightIcon data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent className="px-5 sm:px-7">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((tool, index) => {
            const { Icon, hue } = glyphForTool(tool);
            const href = tool.href ?? `/outils/${getToolSlug(tool)}`;

            return (
              <li key={tool.id} className="min-w-0">
                <Link
                  href={href}
                  className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
                >
                  <Card
                    size="sm"
                    className="glass-interactive h-full min-h-[218px] rounded-2xl border-[color:var(--glass-border)] py-4"
                    style={{
                      background: `linear-gradient(145deg, color-mix(in oklab, ${hue} 12%, var(--glass-surface-strong)), var(--glass-surface))`,
                    }}
                  >
                    <CardHeader className="gap-3 px-4">
                      <span
                        aria-hidden
                        className="flex size-11 items-center justify-center rounded-xl"
                        style={{
                          background: `color-mix(in oklab, ${hue} 16%, transparent)`,
                          color: hue,
                        }}
                      >
                        <Icon strokeWidth={1.9} />
                      </span>
                      <CardTitle className="font-bold text-[color:var(--glass-ink)]">
                        {tool.title}
                      </CardTitle>
                      {index === 0 && tool.popular ? (
                        <Badge variant="secondary" className="w-fit">
                          {t("toolPopularBadge")}
                        </Badge>
                      ) : null}
                    </CardHeader>
                    <CardContent className="flex-1 px-4">
                      <p className="line-clamp-3 text-xs leading-relaxed text-[color:var(--glass-ink-soft)]">
                        {tool.desc}
                      </p>
                    </CardContent>
                    <CardFooter className="justify-between border-0 bg-transparent px-4 pb-0 pt-1 text-xs font-semibold text-[color:var(--glass-ink-faint)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3Icon className="size-3.5" aria-hidden />
                        {tool.time}
                      </span>
                      <span className="flex size-8 items-center justify-center rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] text-primary">
                        <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
                      </span>
                    </CardFooter>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
