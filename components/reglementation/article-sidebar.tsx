import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { natureMeta, naturePhrase } from "@/lib/reglementation/nature";
import type { AmendmentRef } from "@/lib/reglementation/parse-amendments";
import type { Citation } from "@/lib/reglementation/backlinks";
import type { Correspondence } from "@/lib/reglementation/ar-am-map";
import type { GlossaryEntry } from "@/lib/reglementation/glossary";
import { lookupUrl } from "@/lib/dossiers/procedures";
import type { LookupCodeRef } from "@/lib/dossiers/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionToc, type TocSection } from "./section-toc";
import type { LegalMeta, Neighbor } from "./types";

interface ArticleSidebarProps {
  meta: LegalMeta;
  refs: string[];
  sourceUrl: string | null;
  consultedOn: string;
  neighbors: Neighbor[];
  amendments?: AmendmentRef[];
  realEV?: string | null;
  citedBy?: Citation[];
  correspondences?: Correspondence[];
  sections?: TocSection[];
  definitions?: GlossaryEntry[];
  lookupRefs?: LookupCodeRef[];
}

export async function ArticleSidebar({
  meta,
  refs,
  sourceUrl,
  consultedOn,
  neighbors,
  amendments = [],
  realEV = null,
  citedBy = [],
  correspondences = [],
  sections = [],
  definitions = [],
  lookupRefs = [],
}: ArticleSidebarProps) {
  const t = await getTranslations("public.pro");
  const nature = meta.natureJuridique ? natureMeta(meta.natureJuridique) : null;
  const visibleRefs = refs.slice(0, 7);
  const hiddenCount = refs.length - visibleRefs.length;
  // Timeline la plus récente en tête.
  const timeline = [...amendments].reverse();

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 print:hidden">
      {/* Sommaire des § (articles longs) */}
      <SectionToc sections={sections} title={t("reglTocTitle")} />

      {/* Définitions utiles présentes dans l'article */}
      {definitions.length > 0 && (
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle>{t("reglDefsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {definitions.map((d) => (
              <details key={d.term} className="text-sm">
                <summary className="cursor-pointer font-medium hover:text-primary">
                  {d.term}
                </summary>
                <p className="mt-1 text-muted-foreground">{d.definition}</p>
                <Link
                  href={`/partenaire/reglementation/${encodeURIComponent(d.sourceRiolexId)}`}
                  className="text-xs text-primary hover:underline"
                >
                  {t("reglDefsSource")}
                </Link>
              </details>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Codes ONEM liés — deep-links éditoriaux vers le Lookup (legalMeta) */}
      {lookupRefs.length > 0 && (
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle>{t("reglLookupTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {lookupRefs.map((r) => (
              <div key={`${r.tableSlug}-${r.code ?? ""}`}>
                <Link
                  href={lookupUrl(r.tableSlug, r.code)}
                  className="group flex items-start gap-1.5 text-sm underline-offset-2 hover:underline"
                >
                  <Search
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-primary"
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{r.label}</span>
                    {r.code && (
                      <span className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[0.7em] text-muted-foreground">
                        {r.code}
                      </span>
                    )}
                    {r.context && (
                      <span className="block text-xs text-muted-foreground">
                        {r.context}
                      </span>
                    )}
                  </span>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Informations */}
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle>{t("reglPropsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {meta.statut && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("reglPropStatut")}</span>
              <span className="text-right">{meta.statut}</span>
            </div>
          )}
          {meta.dateEntreeVigueur && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("reglPropEv")}</span>
              <span className="text-right">{meta.dateEntreeVigueur}</span>
            </div>
          )}
          {meta.datePublication && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("reglPropPublication")}</span>
              <span className="text-right">{meta.datePublication}</span>
            </div>
          )}
          {meta.dateMoniteur && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("reglPropMb")}</span>
              <span className="text-right">{meta.dateMoniteur}</span>
            </div>
          )}
          {nature && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("reglPropNature")}</span>
              <span className="text-right">{nature.label}</span>
            </div>
          )}
          {realEV && (
            <div className="flex justify-between gap-2 border-t pt-2">
              <span className="text-muted-foreground">{t("reglPropLastEv")}</span>
              <span className="text-right font-medium">{realEV}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique des modifications (dérivé des crochets d'amendement) */}
      {timeline.length > 0 && (
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle>{t("reglTimelineTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {timeline.map((a, i) => {
                const m = a.nature ? natureMeta(a.nature) : null;
                return (
                  <li key={`${a.raw}-${i}`} className="flex gap-2.5">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${m?.accent ?? "bg-muted-foreground"}`}
                      aria-hidden
                    />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium capitalize">
                        {naturePhrase(a.nature)}
                        {a.dateActe ? ` du ${a.dateActe}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.dateEV ? `${t("reglTimelineEv")} ${a.dateEV}` : null}
                        {a.dateEV && a.dateMB ? " · " : null}
                        {a.dateMB ? `${t("reglTimelineMb")} ${a.dateMB}` : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Articles liés dans l'autre texte (AR ↔ AM) */}
      {correspondences.length > 0 && (
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle>{t("reglArAmTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {correspondences.slice(0, 8).map((c) => (
              <div key={c.riolexId}>
                <Link
                  href={`/partenaire/reglementation/${encodeURIComponent(c.riolexId)}`}
                  className="text-sm underline-offset-2 hover:underline"
                >
                  <span className="font-medium">Art. {c.articleNumber}</span>
                  <span className="text-muted-foreground"> — {c.loi}</span>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Références */}
      {refs.length > 0 && (
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle>{t("reglRefsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {visibleRefs.map((ref) => (
                <Badge key={ref} variant="outline" className="font-normal">
                  {ref}
                </Badge>
              ))}
            </div>
            {hiddenCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("reglRefsSeeAll", { count: refs.length })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cité par (backlinks dérivés des renvois internes du corpus) */}
      {citedBy.length > 0 && (
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle>{t("reglCitedBy", { count: citedBy.length })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {citedBy.slice(0, 12).map((c) => (
              <div key={c.riolexId}>
                <Link
                  href={`/partenaire/reglementation/${encodeURIComponent(c.riolexId)}`}
                  className="text-sm underline-offset-2 hover:underline"
                >
                  <span className="font-medium">Art. {c.articleNumber}</span>
                  <span className="text-muted-foreground"> — {c.loi}</span>
                </Link>
              </div>
            ))}
            {citedBy.length > 12 && (
              <p className="text-xs text-muted-foreground">
                {t("reglCitedByMore", { count: citedBy.length - 12 })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Voir aussi */}
      {neighbors.length > 0 && (
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle>{t("reglVoirAussi")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {neighbors.map((n) => (
              <div key={n.riolexId}>
                <Link
                  href={`/partenaire/reglementation/${encodeURIComponent(n.riolexId)}`}
                  className="text-sm underline-offset-2 hover:underline"
                >
                  {n.title}
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lien externe + attribution */}
      <Card size="sm">
        <CardContent className="space-y-1.5 py-3 text-xs text-muted-foreground">
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <ExternalLink className="size-3" aria-hidden />
              {t("reglOpenRiolex")}
            </a>
          )}
          <p>
            {t("reglAttribution", {
              loi: meta.loi ?? "",
              num: meta.articleNumber ?? "",
              date: consultedOn,
            })}
          </p>
          <p>{t("reglNotice")}</p>
        </CardContent>
      </Card>
    </aside>
  );
}
