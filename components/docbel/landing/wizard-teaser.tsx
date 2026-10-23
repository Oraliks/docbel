import { cache } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Info } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { canToolBeViewedBy, filterByAudience, getPublicCatalog } from "@/lib/outils-catalog";
import { isAudienceId } from "@/lib/audience";
import { getToolSlug } from "@/lib/docbel-data";
import { glyphForTool } from "@/lib/tool-glyphs";

/** Même catalogue public pour les deux zones, sans réintroduire un outil désactivé. */
export const loadHomeCatalog = cache(async () => {
  try {
    const [catalog, t] = await Promise.all([getPublicCatalog(), getTranslations()]);
    const citizenTools = filterByAudience(catalog, "citoyen");
    // Les href statiques contournent historiquement la déduplication du catalogue.
    // Le contrôle est borné au nombre exact de slugs concernés, sans nouvelle source.
    const linkedSlugs = [...new Set(citizenTools.filter((tool) => tool.href).map(getToolSlug))];
    const linkedRows = linkedSlugs.length > 0 ? await prisma.tool.findMany({
      where: { slug: { in: linkedSlugs } },
      select: { slug: true, active: true, audience: true },
      take: linkedSlugs.length,
    }) : [];
    const disabledSlugs = new Set(linkedRows.filter((tool) => !tool.active || (isAudienceId(tool.audience) && !canToolBeViewedBy(tool.audience, "citoyen"))).map((tool) => tool.slug));
    const seen = new Set<string>();
    return citizenTools.filter((tool) => {
      const slug = getToolSlug(tool);
      if (disabledSlugs.has(slug) || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    }).map((tool) => ({
      ...tool,
      title: tool.titleKey ? t(tool.titleKey as Parameters<typeof t>[0]) : tool.title,
      desc: tool.descKey ? t(tool.descKey as Parameters<typeof t>[0]) : tool.desc,
      time: tool.timeKey ? t(tool.timeKey as Parameters<typeof t>[0]) : tool.time,
    }));
  } catch {
    return null;
  }
});

/** Trois outils réellement utilisables, issus du catalogue et de ses métadonnées. */
export async function WizardTeaser() {
  const [t, tools] = await Promise.all([getTranslations("public.home"), loadHomeCatalog()]);
  const visible = [...(tools ?? [])].sort((a, b) => Number(b.popular) - Number(a.popular)).slice(0, 3);
  return (
    <section aria-labelledby="wizard-teaser-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="wizard-teaser-heading" className="text-[24px] font-semibold leading-tight tracking-[-0.025em] sm:text-[27px]">{t("designSituationsTitle")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t("designSituationsDescription")}</p>
        </div>
        <Link href="/mon-dossier" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[color:var(--glass-accent-deep)] underline underline-offset-4"><ArrowRight className="size-4 rtl:rotate-180" aria-hidden />{t("designJourneys")}</Link>
      </div>
      {visible.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-3">
          {visible.map((tool) => {
            const { Icon } = glyphForTool(tool);
            return (
              <li key={tool.id} className="min-w-0">
                <Link href={tool.href ?? `/outils/${getToolSlug(tool)}`} className="glass-surface glass-interactive group flex h-full min-h-[210px] flex-col rounded-[20px] border border-[color:var(--glass-border)] p-5 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-[color:var(--glass-accent-soft)] text-[color:var(--glass-accent-deep)]" aria-hidden><Icon className="size-5" /></span>
                    <ArrowRight className="size-4 text-[color:var(--glass-ink-faint)] rtl:rotate-180" aria-hidden />
                  </div>
                  <h3 className="text-base font-semibold leading-snug tracking-[-0.02em]">{tool.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{tool.desc}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : <p role={tools === null ? "status" : undefined} className="glass-surface flex items-start gap-3 rounded-[20px] border border-[color:var(--glass-border)] p-5 text-sm leading-relaxed text-[color:var(--glass-ink-soft)]"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />{t(tools === null ? "designToolsUnavailable" : "designToolsEmpty")}</p>}
    </section>
  );
}
