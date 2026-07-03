import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { natureMeta, naturePhrase } from "@/lib/reglementation/nature";
import type { AmendmentRef } from "@/lib/reglementation/parse-amendments";
import type { Citation } from "@/lib/reglementation/backlinks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}: ArticleSidebarProps) {
  const t = await getTranslations("public.pro");
  const nature = meta.natureJuridique ? natureMeta(meta.natureJuridique) : null;
  const visibleRefs = refs.slice(0, 7);
  const hiddenCount = refs.length - visibleRefs.length;
  // Timeline la plus récente en tête.
  const timeline = [...amendments].reverse();

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 print:hidden">
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
