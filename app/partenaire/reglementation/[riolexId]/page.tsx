import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { allowedVisibilities } from "@/lib/chomage-ia/context";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { LegalText } from "@/components/reglementation/legal-text";
import { OnemCommentary } from "@/components/reglementation/onem-commentary";
import { ArticleSidebar } from "@/components/reglementation/article-sidebar";
import { NatureTile } from "@/components/reglementation/nature-badge";
import { PrintButton } from "@/components/reglementation/print-button";
import type { LegalMeta, Neighbor } from "@/components/reglementation/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RIOLEX_ID_RE = /^[a-z0-9_-]{5,80}$/i;

interface PageProps {
  params: Promise<{ riolexId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { riolexId } = await params;
  const t = await getTranslations("public.pro");
  return { title: `${riolexId} — ${t("reglMetaTitle")}` };
}

/** Préfixe numérique d'un n° d'article ("131bis" → 131) pour le tri naturel. */
function numericPrefix(articleNumber: string): number {
  const m = /^(\d+)/.exec(articleNumber);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * Fiche d'un article du corpus légal RioLex. Réservé partenaires + admins.
 * Le commentaire ONEM (source séparée, visibility "admin") n'est rendu que
 * pour un admin — décision Oraliks 2026-07-01 : stocké, lecture admin-only
 * pour l'instant, élargissable plus tard via `visibility`.
 */
export default async function ReglementationArticlePage({ params }: PageProps) {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();

  const { riolexId: rawId } = await params;
  const riolexId = decodeURIComponent(rawId);
  if (!RIOLEX_ID_RE.test(riolexId)) notFound();

  const isAdmin = auth.user.isAdmin === true;
  const visibilities = allowedVisibilities(isAdmin ? "admin" : "partner");
  const t = await getTranslations("public.pro");

  // Texte + éventuel commentaire partagent le même legalMeta.riolexId ;
  // le flag isOnemCommentary les distingue.
  const candidates = await prisma.knowledgeSource.findMany({
    where: {
      domain: "chomage",
      enabled: true,
      visibility: { in: visibilities },
      legalMeta: { path: ["riolexId"], equals: riolexId },
    },
    select: {
      id: true,
      title: true,
      content: true,
      sourceUrl: true,
      legalMeta: true,
      folderId: true,
      updatedAt: true,
    },
    take: 10,
  });

  const article = candidates.find(
    (c) => (c.legalMeta as LegalMeta | null)?.isOnemCommentary !== true,
  );
  if (!article) notFound();
  const meta = (article.legalMeta ?? {}) as LegalMeta;

  const commentary = isAdmin
    ? candidates.find(
        (c) => (c.legalMeta as LegalMeta | null)?.isOnemCommentary === true,
      )
    : undefined;

  // « Voir aussi » : articles voisins du même texte de loi (même dossier),
  // triés par n° d'article, fenêtre autour de l'article courant.
  let neighbors: Neighbor[] = [];
  if (article.folderId) {
    const siblings = await prisma.knowledgeSource.findMany({
      where: {
        domain: "chomage",
        enabled: true,
        folderId: article.folderId,
        visibility: { in: visibilities },
      },
      select: { title: true, legalMeta: true },
      take: 400,
    });
    const sorted = siblings
      .map((s) => {
        const m = (s.legalMeta ?? {}) as LegalMeta;
        return {
          riolexId: m.riolexId ?? "",
          title: s.title,
          num: numericPrefix(m.articleNumber ?? ""),
          isComment: m.isOnemCommentary === true,
        };
      })
      .filter((s) => s.riolexId && !s.isComment)
      .sort((a, b) => a.num - b.num || a.riolexId.localeCompare(b.riolexId));
    const idx = sorted.findIndex((s) => s.riolexId === riolexId);
    neighbors = sorted
      .slice(Math.max(0, idx - 3), idx + 4)
      .filter((s) => s.riolexId !== riolexId)
      .slice(0, 6);
  }

  const refs = Array.isArray(meta.refs) ? meta.refs.slice(0, 20) : [];
  const consultedOn = new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "short",
  }).format(article.updatedAt);

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="w-full space-y-5">
        {/* Fil d'Ariane + retour — masqués à l'impression */}
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Link
            href="/partenaire/reglementation"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("reglBack")}
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <nav className="text-sm text-muted-foreground" aria-label="Fil d'Ariane">
            <span>Réglementation</span>
            {meta.loi && (
              <>
                <span className="mx-1.5 text-muted-foreground/40">›</span>
                <span>{meta.loi}</span>
              </>
            )}
            {meta.articleNumber && (
              <>
                <span className="mx-1.5 text-muted-foreground/40">›</span>
                <span>Art. {meta.articleNumber}</span>
              </>
            )}
          </nav>
        </div>

        {/* En-tête : icône nature + titre + badges + actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            {meta.natureJuridique && (
              <NatureTile nature={meta.natureJuridique} />
            )}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{meta.loi ?? ""}</Badge>
                <Badge variant="secondary">Art. {meta.articleNumber ?? ""}</Badge>
                {meta.abroge === true && (
                  <Badge variant="destructive">{t("reglAbroge")}</Badge>
                )}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {article.title}
              </h1>
            </div>
          </div>

          {/* Barre d'actions — masquée à l'impression */}
          <div className="flex shrink-0 items-center gap-2 print:hidden">
            <PrintButton label={t("reglPrint")} />
            {article.sourceUrl && (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="size-4" aria-hidden />
                {t("reglOpenRiolex")}
              </a>
            )}
          </div>
        </div>

        {/* Grille principale 1 col (mobile) / 2 cols (lg+) — 1 col à l'impression */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] print:block">
          {/* Colonne principale */}
          <article className="space-y-6">
            <LegalText raw={article.content} />

            {/* Références légales inline */}
            {refs.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {t("reglRefsTitle")}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {refs.map((ref) => (
                    <Badge key={ref} variant="outline" className="font-normal">
                      {ref}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Commentaire ONEM — admin uniquement */}
            {commentary && (commentary.content ?? "").trim().length > 0 && (
              <OnemCommentary raw={commentary.content} />
            )}

            {/* Attribution imprimable — masquée à l'écran, visible à l'impression */}
            <div className="hidden space-y-1 text-xs text-muted-foreground print:block">
              <Separator className="mb-3" />
              <p>
                {t("reglAttribution", {
                  loi: meta.loi ?? "",
                  num: meta.articleNumber ?? "",
                  date: consultedOn,
                })}
              </p>
              {article.sourceUrl && (
                <p>{article.sourceUrl}</p>
              )}
              <p>{t("reglNotice")}</p>
            </div>
          </article>

          {/* Sidebar collante — print:hidden géré dans ArticleSidebar */}
          <ArticleSidebar
            meta={meta}
            refs={refs}
            sourceUrl={article.sourceUrl ?? null}
            consultedOn={consultedOn}
            neighbors={neighbors}
          />
        </div>
      </div>
    </div>
  );
}
