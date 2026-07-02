import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { natureMeta } from "@/lib/reglementation/nature";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LegalMeta, Neighbor } from "./types";

interface ArticleSidebarProps {
  meta: LegalMeta;
  refs: string[];
  sourceUrl: string | null;
  consultedOn: string;
  neighbors: Neighbor[];
}

export async function ArticleSidebar({
  meta,
  refs,
  sourceUrl,
  consultedOn,
  neighbors,
}: ArticleSidebarProps) {
  const t = await getTranslations("public.pro");
  const nature = meta.natureJuridique ? natureMeta(meta.natureJuridique) : null;
  const visibleRefs = refs.slice(0, 7);
  const hiddenCount = refs.length - visibleRefs.length;

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
        </CardContent>
      </Card>

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
