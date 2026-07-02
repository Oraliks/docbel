import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Lock } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { allowedVisibilities } from "@/lib/chomage-ia/context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RIOLEX_ID_RE = /^[a-z0-9_]{5,80}$/i;

interface LegalMeta {
  riolexId?: string;
  loi?: string;
  natureJuridique?: string;
  articleNumber?: string;
  datePublication?: string | null;
  dateEntreeVigueur?: string | null;
  dateMoniteur?: string | null;
  statut?: string | null;
  abroge?: boolean;
  isOnemCommentary?: boolean;
  refs?: string[];
}

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
  let neighbors: Array<{ riolexId: string; title: string }> = [];
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
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <Link
          href="/partenaire/reglementation"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("reglBack")}
        </Link>

        <div className="space-y-2">
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

        {/* Texte de l'article */}
        <Card>
          <CardContent className="py-5">
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
              {article.content}
            </div>
          </CardContent>
        </Card>

        {/* Propriétés */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("reglPropsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {meta.statut && (
              <div>
                <div className="text-muted-foreground">{t("reglPropStatut")}</div>
                <div>{meta.statut}</div>
              </div>
            )}
            {meta.datePublication && (
              <div>
                <div className="text-muted-foreground">
                  {t("reglPropPublication")}
                </div>
                <div>{meta.datePublication}</div>
              </div>
            )}
            {meta.dateEntreeVigueur && (
              <div>
                <div className="text-muted-foreground">{t("reglPropEv")}</div>
                <div>{meta.dateEntreeVigueur}</div>
              </div>
            )}
            {meta.dateMoniteur && (
              <div>
                <div className="text-muted-foreground">{t("reglPropMb")}</div>
                <div>{meta.dateMoniteur}</div>
              </div>
            )}
            {meta.natureJuridique && (
              <div>
                <div className="text-muted-foreground">{t("reglPropNature")}</div>
                <div>{meta.natureJuridique}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Références légales détectées */}
        {refs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("reglRefsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {refs.map((ref) => (
                <Badge key={ref} variant="outline" className="font-normal">
                  {ref}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Commentaire ONEM — admin uniquement */}
        {commentary && (commentary.content ?? "").trim().length > 0 && (
          <Card className="border-amber-300/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="size-4 text-amber-600" aria-hidden />
                {t("reglCommentTitle")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("reglCommentNote")}
              </p>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap py-3 text-sm leading-relaxed">
              {commentary.content}
            </CardContent>
          </Card>
        )}

        {/* Voir aussi */}
        {neighbors.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("reglVoirAussi")}</CardTitle>
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

        <Separator />

        {/* Attribution obligatoire (source + date) */}
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            {t("reglAttribution", {
              loi: meta.loi ?? "",
              num: meta.articleNumber ?? "",
              date: consultedOn,
            })}
          </p>
          {article.sourceUrl && (
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <ExternalLink className="size-3" aria-hidden />
              {t("reglOpenRiolex")}
            </a>
          )}
          <p>{t("reglNotice")}</p>
        </div>
      </div>
    </div>
  );
}
