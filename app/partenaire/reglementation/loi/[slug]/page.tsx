import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { allowedVisibilities } from "@/lib/chomage-ia/context";
import { slugifyLoi, compareArticles } from "@/lib/reglementation/loi";
import { Badge } from "@/components/ui/badge";
import { NatureTile } from "@/components/reglementation/nature-badge";
import type { LegalMeta } from "@/components/reglementation/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} — Réglementation chômage | DocBel` };
}

/**
 * Sommaire d'un texte de loi du corpus RioLex : tous les articles en ordre
 * naturel, avec pastille de nature et statut. Réservé partenaires + admins.
 */
export default async function LoiSommairePage({ params }: PageProps) {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();

  const { slug } = await params;
  const isAdmin = auth.user.isAdmin === true;
  const visibilities = allowedVisibilities(isAdmin ? "admin" : "partner");
  const t = await getTranslations("public.pro");

  // Résout le slug en libellé de loi exact (les slashes de « AR 25/11/1991 »
  // ne passent pas en URL → on compare les slugs).
  const loiRows = await prisma.$queryRawUnsafe<Array<{ loi: string | null }>>(
    `SELECT DISTINCT s."legalMeta"->>'loi' AS loi
     FROM "KnowledgeSource" s
     WHERE s."domain" = 'chomage' AND s."enabled" = true
       AND s."visibility" = ANY($1::text[])
       AND s."legalMeta" IS NOT NULL
       AND COALESCE(s."legalMeta"->>'isOnemCommentary', '') <> 'true'`,
    visibilities,
  );
  const loi = loiRows
    .map((r) => r.loi)
    .find((l): l is string => !!l && slugifyLoi(l) === slug);
  if (!loi) notFound();

  const rows = await prisma.knowledgeSource.findMany({
    where: {
      domain: "chomage",
      enabled: true,
      visibility: { in: visibilities },
      legalMeta: { path: ["loi"], equals: loi },
    },
    select: { title: true, legalMeta: true },
    take: 600,
  });

  const articles = rows
    .map((r) => {
      const m = (r.legalMeta ?? {}) as LegalMeta;
      return {
        riolexId: m.riolexId ?? "",
        articleNumber: m.articleNumber ?? "",
        nature: m.natureJuridique ?? "",
        abroge: m.abroge === true,
        title: r.title,
        isComment: m.isOnemCommentary === true,
      };
    })
    .filter((a) => a.riolexId && !a.isComment)
    .sort(compareArticles);

  const nature = articles[0]?.nature ?? "";

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="w-full space-y-5">
        <Link
          href="/partenaire/reglementation"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("reglBack")}
        </Link>

        <div className="flex items-start gap-3">
          {nature && <NatureTile nature={nature} />}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{loi}</h1>
            <p className="text-sm text-muted-foreground">
              {t("reglCount", { count: articles.length })}
            </p>
          </div>
        </div>

        {/* Sommaire : grille dense d'articles cliquables */}
        <ol className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {articles.map((a) => (
            <li key={a.riolexId}>
              <Link
                href={`/partenaire/reglementation/${encodeURIComponent(a.riolexId)}`}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <span className="shrink-0 font-medium tabular-nums">
                  Art. {a.articleNumber}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {a.title}
                </span>
                {a.abroge && (
                  <Badge variant="destructive" className="shrink-0">
                    {t("reglAbroge")}
                  </Badge>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
