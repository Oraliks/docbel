import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { allowedVisibilities } from "@/lib/chomage-ia/context";
import {
  getCompareArticle,
  getCorpusRiolexIds,
  type CompareArticle,
} from "@/lib/reglementation/get-article";
import { loiToPrefix, type RefContext } from "@/lib/reglementation/resolve-ref";
import { Badge } from "@/components/ui/badge";
import { LegalText } from "@/components/reglementation/legal-text";
import { ComparePicker } from "@/components/reglementation/compare-picker";
import { NatureTile } from "@/components/reglementation/nature-badge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Comparer deux articles — Réglementation | DocBel",
};

interface PageProps {
  searchParams: Promise<{ a?: string; b?: string }>;
}

function ColumnHeader({ article }: { article: CompareArticle }) {
  return (
    <div className="flex items-start gap-2.5">
      {article.meta.natureJuridique && (
        <NatureTile nature={article.meta.natureJuridique} />
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{article.meta.loi ?? ""}</Badge>
          <Badge variant="secondary">Art. {article.meta.articleNumber ?? ""}</Badge>
          {article.meta.abroge === true && (
            <Badge variant="destructive">Abrogé</Badge>
          )}
        </div>
        <Link
          href={`/partenaire/reglementation/${encodeURIComponent(article.riolexId)}`}
          className="mt-1 block font-semibold tracking-tight hover:underline"
        >
          {article.title}
        </Link>
      </div>
    </div>
  );
}

/**
 * Comparaison côte à côte de deux articles (duo AR ↔ AM au guichet).
 * URL partageable `?a=…&b=…`. Réservé partenaires + admins.
 */
export default async function ComparerPage({ searchParams }: PageProps) {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();

  const isAdmin = auth.user.isAdmin === true;
  const visibilities = allowedVisibilities(isAdmin ? "admin" : "partner");
  const t = await getTranslations("public.pro");

  const { a = "", b = "" } = await searchParams;
  const [colA, colB, corpusIds] = await Promise.all([
    a ? getCompareArticle(a, visibilities) : Promise.resolve(null),
    b ? getCompareArticle(b, visibilities) : Promise.resolve(null),
    getCorpusRiolexIds(visibilities),
  ]);

  const ctx = (art: CompareArticle | null): RefContext => ({
    currentPrefix: loiToPrefix(art?.meta.loi),
    exists: (id) => corpusIds.has(id),
  });

  const column = (art: CompareArticle | null, side: "a" | "b") => (
    <div className="min-w-0 space-y-4">
      <ComparePicker
        a={a}
        b={b}
        side={side}
        placeholder={t("reglComparePick")}
      />
      {art ? (
        <div className="space-y-4">
          <ColumnHeader article={art} />
          <LegalText raw={art.content} refContext={ctx(art)} />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t("reglCompareEmpty")}
        </p>
      )}
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="w-full space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/partenaire/reglementation"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("reglBack")}
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">
            {t("reglCompareTitle")}
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {column(colA, "a")}
          {column(colB, "b")}
        </div>
      </div>
    </div>
  );
}
