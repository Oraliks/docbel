import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Ban, GitCompare } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { allowedVisibilities } from "@/lib/chomage-ia/context";
import {
  extractAmendments,
  sortAmendmentsByEV,
  latestEV,
} from "@/lib/reglementation/parse-amendments";
import { parseLegalText } from "@/lib/reglementation/parse-legal-text";
import { loiToPrefix, type RefContext } from "@/lib/reglementation/resolve-ref";
import { getCitedBy } from "@/lib/reglementation/backlinks";
import { getCorrespondences } from "@/lib/reglementation/ar-am-map";
import { getCorpusRiolexIds } from "@/lib/reglementation/get-article";
import { deriveThemes } from "@/lib/reglementation/themes";
import { getGlossary, termsInText } from "@/lib/reglementation/glossary";
import { sectionAnchor } from "@/components/reglementation/legal-text";
import { ConventionsLegend } from "@/components/reglementation/conventions-legend";
import { CitationGraph, type GraphNode } from "@/components/reglementation/citation-graph";
import { InArticleFind } from "@/components/reglementation/in-article-find";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { slugifyLoi } from "@/lib/reglementation/loi";
import { LegalText } from "@/components/reglementation/legal-text";
import { TextSettings } from "@/components/reglementation/text-settings";
import { ReadingMode } from "@/components/reglementation/reading-mode";
import { OnemCommentary } from "@/components/reglementation/onem-commentary";
import { ArticleSidebar } from "@/components/reglementation/article-sidebar";
import { ArticlePager, type PagerLink } from "@/components/reglementation/article-pager";
import { CopyButton } from "@/components/reglementation/copy-button";
import { PinButton, RecordVisit } from "@/components/reglementation/pins-recents";
import { NoteEditor } from "@/components/reglementation/note-editor";
import { DossierPicker } from "@/components/reglementation/dossier-picker";
import { ReportButton } from "@/components/reglementation/report-button";
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

  // « Voir aussi » + pagination : articles voisins du même texte de loi
  // (même dossier), triés par n° d'article.
  let neighbors: Neighbor[] = [];
  let prev: PagerLink | null = null;
  let next: PagerLink | null = null;
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
          articleNumber: m.articleNumber ?? "",
          num: numericPrefix(m.articleNumber ?? ""),
          isComment: m.isOnemCommentary === true,
        };
      })
      .filter((s) => s.riolexId && !s.isComment)
      .sort((a, b) => a.num - b.num || a.riolexId.localeCompare(b.riolexId));
    const idx = sorted.findIndex((s) => s.riolexId === riolexId);
    if (idx > 0) prev = { riolexId: sorted[idx - 1].riolexId, articleNumber: sorted[idx - 1].articleNumber };
    if (idx >= 0 && idx < sorted.length - 1)
      next = { riolexId: sorted[idx + 1].riolexId, articleNumber: sorted[idx + 1].articleNumber };
    neighbors = sorted
      .slice(Math.max(0, idx - 3), idx + 4)
      .filter((s) => s.riolexId !== riolexId)
      .slice(0, 6);
  }

  const refs = Array.isArray(meta.refs) ? meta.refs.slice(0, 20) : [];
  const consultedOn = new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "short",
  }).format(article.updatedAt);

  // Historique des modifications dérivé des crochets d'amendement du texte.
  // `latestEV` = vraie dernière entrée en vigueur (la dateEntreeVigueur de
  // legalMeta est constante par loi → trompeuse ; on la corrige ici).
  const amendments = sortAmendmentsByEV(extractAmendments(article.content));
  const realEV = latestEV(amendments);
  const isReforme = /Loi-programme 18\.7\.2025/i.test(article.content ?? "");
  const themes = deriveThemes(article.content);

  // Item dénormalisé (épingle / dossier / note) + adresse admin pour signalement.
  const regItem = {
    riolexId,
    loi: meta.loi ?? "",
    articleNumber: meta.articleNumber ?? "",
    title: article.title,
  };
  const adminEmail = process.env.CONTACT_EMAIL_FROM ?? "";

  // Le lien RioLex (source interne) n'est exposé qu'aux admins (demande Oraliks).
  const riolexUrl = isAdmin ? article.sourceUrl : null;

  // Ensemble des riolexId visibles → on ne relie un renvoi qu'à une fiche
  // existante (renvoi vers une loi hors corpus reste du texte brut).
  const corpusIds = await getCorpusRiolexIds(visibilities);
  const refContext: RefContext = {
    currentPrefix: loiToPrefix(meta.loi),
    exists: (id) => corpusIds.has(id),
  };

  // Backlinks « cité par » (graphe dérivé des renvois, mémoïsé en mémoire).
  const citedBy = await getCitedBy(riolexId);
  // Correspondances AR ↔ AM (règle / exécution).
  const correspondences = await getCorrespondences(riolexId);

  // Nœuds du graphe de liens (correspondances + cité par, dédupliqués).
  const graphNodes: GraphNode[] = [
    ...correspondences.map((c) => ({
      riolexId: c.riolexId,
      articleNumber: c.articleNumber,
      loi: c.loi,
      kind: "corr" as const,
    })),
    ...citedBy.map((c) => ({
      riolexId: c.riolexId,
      articleNumber: c.articleNumber,
      loi: c.loi,
      kind: "cite" as const,
    })),
  ].filter((n, i, arr) => arr.findIndex((x) => x.riolexId === n.riolexId) === i);

  // Sommaire des § + définitions présentes dans l'article.
  const sections = parseLegalText(article.content)
    .filter((b) => b.type === "section" && b.marker)
    .map((b) => ({ marker: b.marker as string, anchor: sectionAnchor(b.marker) }));
  const glossary = await getGlossary();
  const definitions = termsInText(glossary, article.content);

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="w-full space-y-5">
        {/* Enregistre la visite pour l'historique « Consultés récemment » */}
        <RecordVisit item={regItem} />

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
          <nav className="text-sm text-muted-foreground" aria-label={t("reglBreadcrumb")}>
            <Link href="/partenaire/reglementation" className="hover:text-foreground">
              Réglementation
            </Link>
            {meta.loi && (
              <>
                <span className="mx-1.5 text-muted-foreground/40">›</span>
                <Link
                  href={`/partenaire/reglementation/loi/${slugifyLoi(meta.loi)}`}
                  className="hover:text-foreground"
                >
                  {meta.loi}
                </Link>
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
                {isReforme && (
                  <Badge className="border-orange-200 bg-orange-50 text-orange-700">
                    {t("reglReforme2026")}
                  </Badge>
                )}
                {realEV && !meta.abroge && (
                  <Badge variant="outline" className="font-normal text-muted-foreground">
                    {t("reglFreshness", { date: realEV })}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {article.title}
              </h1>
              {themes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 print:hidden">
                  {themes.map((th) => (
                    <Link
                      key={th.key}
                      href={`/partenaire/reglementation?theme=${th.key}`}
                      className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      #{th.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Barre d'actions — masquée à l'impression */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 print:hidden">
            <PinButton item={regItem} />
            <DossierPicker item={regItem} label={t("reglAddToDossier")} />
            <CopyButton
              value={t("reglCitation", {
                loi: meta.loi ?? "",
                num: meta.articleNumber ?? "",
                title: article.title,
                date: consultedOn,
              })}
              label={t("reglCopyRef")}
              copiedLabel={t("reglCopied")}
            />
            <Link
              href={`/partenaire/reglementation/comparer?a=${encodeURIComponent(riolexId)}`}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <GitCompare className="size-4" aria-hidden />
              {t("reglCompare")}
            </Link>
            <PrintButton label={t("reglPrint")} />
            <ReportButton
              adminEmail={adminEmail}
              loi={meta.loi ?? ""}
              articleNumber={meta.articleNumber ?? ""}
              label={t("reglReport")}
            />
            {riolexUrl && (
              <a
                href={riolexUrl}
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

        {/* Bandeau « article abrogé » — visible aussi à l'impression */}
        {meta.abroge === true && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{t("reglAbrogeBanner")}</p>
          </div>
        )}

        {/* Grille principale 1 col (mobile) / 2 cols (lg+) — 1 col à l'impression */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] print:block">
          {/* Colonne principale */}
          <article className="space-y-6">
            <ArticlePager
              prev={prev}
              next={next}
              labelPrev={t("reglPrev")}
              labelNext={t("reglNext")}
            />

            <div className="flex justify-end">
              <InArticleFind label={t("reglFindInArticle")} />
            </div>

            <TextSettings>
              <ReadingMode title={article.title} label={t("reglReadingMode")}>
                <LegalText raw={article.content} refContext={refContext} />
              </ReadingMode>
            </TextSettings>

            <ConventionsLegend />

            <NoteEditor
              riolexId={riolexId}
              label={t("reglNoteLabel")}
              placeholder={t("reglNotePlaceholder")}
            />

            <CitationGraph
              center={meta.articleNumber ?? "?"}
              nodes={graphNodes}
              label={t("reglGraphLabel")}
            />

            {/* Commentaire ONEM — admin uniquement */}
            {commentary && (commentary.content ?? "").trim().length > 0 && (
              <OnemCommentary raw={commentary.content} corpusIds={[...corpusIds]} />
            )}

            <ArticlePager
              prev={prev}
              next={next}
              labelPrev={t("reglPrev")}
              labelNext={t("reglNext")}
            />

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
              {riolexUrl && (
                <p>{riolexUrl}</p>
              )}
              <p>{t("reglNotice")}</p>
            </div>
          </article>

          {/* Sidebar collante — print:hidden géré dans ArticleSidebar */}
          <ArticleSidebar
            meta={meta}
            refs={refs}
            sourceUrl={riolexUrl}
            consultedOn={consultedOn}
            neighbors={neighbors}
            amendments={amendments}
            realEV={realEV}
            citedBy={citedBy}
            correspondences={correspondences}
            sections={sections}
            definitions={definitions}
          />
        </div>
      </div>
    </div>
  );
}
