"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { natureMeta } from "@/lib/reglementation/nature";
import { NatureTile } from "./nature-badge";
import { renderHeadline } from "./highlight";
import { PinButton } from "./pins-recents";
import type { ResultItem } from "./types";

export function ResultCard({ item }: { item: ResultItem }) {
  const t = useTranslations("public.pro");
  const m = natureMeta(item.natureJuridique);

  return (
    <Card className="relative overflow-hidden transition-colors hover:bg-accent/40">
      {/* Liseré gauche coloré selon la nature juridique */}
      <span className={`absolute inset-y-0 left-0 w-1 ${m.accent}`} />

      {/* Épingle */}
      <div className="absolute right-2 top-2">
        <PinButton
          item={{
            riolexId: item.riolexId,
            loi: item.loi,
            articleNumber: item.articleNumber,
            title: item.title,
          }}
        />
      </div>

      <CardContent className="flex gap-3 py-3 pl-4 pr-10">
        <NatureTile nature={item.natureJuridique} />

        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Ligne 1 : titre + badge statut */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/partenaire/reglementation/${encodeURIComponent(item.riolexId)}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              {item.title}
            </Link>
            {item.abroge ? (
              <Badge variant="destructive">{t("reglAbroge")}</Badge>
            ) : (
              <Badge variant="success">{t("reglStatutVigueur")}</Badge>
            )}
            {item.reforme2026 && (
              <Badge className="border-orange-200 bg-orange-50 text-orange-700">
                {t("reglReforme2026")}
              </Badge>
            )}
          </div>

          {/* Ligne 2 : badges loi / article / date EV / lien RioLex */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{item.loi}</Badge>
            <Badge variant="secondary">Art. {item.articleNumber}</Badge>
            {item.lastEV && (
              <span title="Dernière modification (entrée en vigueur)">
                {t("reglModifiedOn", { date: item.lastEV })}
              </span>
            )}
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ExternalLink className="size-3" aria-hidden />
                RioLex
              </a>
            )}
          </div>

          {/* Ligne 3 : extrait surligné */}
          {item.headline && (
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {renderHeadline(item.headline)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
