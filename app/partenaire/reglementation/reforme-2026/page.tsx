import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { allowedVisibilities } from "@/lib/chomage-ia/context";
import { extractReformPassages } from "@/lib/reglementation/reform";
import { compareArticles, slugifyLoi } from "@/lib/reglementation/loi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Réforme 2026 — Réglementation | DocBel",
};

interface ReformArticle {
  riolexId: string;
  loi: string;
  articleNumber: string;
  title: string;
  abroge: boolean;
  passages: string[];
}

/**
 * Explorateur de la réforme chômage (Loi-programme 18/07/2025, EV 01/03/2026) :
 * les articles touchés, groupés par loi, avec les passages modifiés surlignés.
 */
export default async function Reforme2026Page() {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();

  const visibilities = allowedVisibilities(
    auth.user.isAdmin ? "admin" : "partner",
  );

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      rid: string | null;
      loi: string | null;
      art: string | null;
      title: string;
      abroge: string | null;
      content: string | null;
    }>
  >(
    `SELECT s."legalMeta"->>'riolexId' AS rid,
            s."legalMeta"->>'loi' AS loi,
            s."legalMeta"->>'articleNumber' AS art,
            s."title" AS title,
            s."legalMeta"->>'abroge' AS abroge,
            s."content" AS content
     FROM "KnowledgeSource" s
     WHERE s."domain" = 'chomage' AND s."enabled" = true
       AND s."visibility" = ANY($1::text[])
       AND s."legalMeta" IS NOT NULL
       AND COALESCE(s."legalMeta"->>'isOnemCommentary', '') <> 'true'
       AND s."content" ILIKE '%Loi-programme 18.7.2025%'`,
    visibilities,
  );

  const articles: ReformArticle[] = rows
    .filter((r) => r.rid)
    .map((r) => ({
      riolexId: r.rid as string,
      loi: r.loi ?? "",
      articleNumber: r.art ?? "",
      title: r.title,
      abroge: r.abroge === "true",
      passages: extractReformPassages(r.content ?? ""),
    }))
    .sort(compareArticles);

  // Groupe par loi.
  const byLoi = new Map<string, ReformArticle[]>();
  for (const a of articles) {
    const arr = byLoi.get(a.loi);
    if (arr) arr.push(a);
    else byLoi.set(a.loi, [a]);
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/partenaire/reglementation"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Réglementation
          </Link>
          <h1 className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Sparkles className="size-5 text-orange-500" aria-hidden />
            Réforme 2026
          </h1>
          <Badge className="border-orange-200 bg-orange-50 text-orange-700">
            {articles.length} articles
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Articles modifiés ou abrogés par la Loi-programme du 18/07/2025 (Moniteur
          du 29/07, entrée en vigueur le <strong>01/03/2026</strong>). Les passages
          modifiés repérables dans le texte sont surlignés ci-dessous.
        </p>

        {[...byLoi.entries()].map(([loi, list]) => (
          <section key={loi} className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Link
                href={`/partenaire/reglementation/loi/${slugifyLoi(loi)}`}
                className="hover:text-foreground hover:underline"
              >
                {loi}
              </Link>
              <Badge variant="outline">{list.length}</Badge>
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {list.map((a) => (
                <Card key={a.riolexId} className="break-inside-avoid">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <Link
                        href={`/partenaire/reglementation/${encodeURIComponent(a.riolexId)}`}
                        className="hover:underline"
                      >
                        Art. {a.articleNumber}
                      </Link>
                      {a.abroge && <Badge variant="destructive">Abrogé</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">{a.title}</p>
                    {a.passages.length > 0 ? (
                      <ul className="space-y-1.5">
                        {a.passages.slice(0, 4).map((p, i) => (
                          <li
                            key={i}
                            className="rounded-md bg-orange-50 px-2.5 py-1.5 text-sm text-orange-900"
                          >
                            {p}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Link
                        href={`/partenaire/reglementation/${encodeURIComponent(a.riolexId)}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Voir les modifications dans l’article →
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
