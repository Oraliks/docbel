import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getMethodologies,
  getMethodologyBySlug,
} from "@/lib/calculators/_methodology";
import { MethodologyCard } from "@/components/admin/calculateurs/methodology-card";
import {
  AssetsManager,
  type CalculatorAsset,
} from "@/components/admin/calculateurs/assets-manager";
import { ReviewBanner } from "@/components/admin/calculateurs/review-banner";

/**
 * Page admin : fiche méthodologie d'UN calculateur, accessible via le
 * bouton "Méthodologie" sur la card admin de l'outil
 * (cf. ToolsCardsView pour les types `calc_*`).
 *
 * Source de la fiche : `lib/calculators/_methodology.ts`. Les chiffres
 * (constantes, barèmes) sont liés au code de calcul par construction
 * quand le fichier `.ts` exporte ses constantes ; sinon ils sont
 * redéclarés dans methodology avec mention "SYNC".
 *
 * Le titre / description publique de l'outil sont éditables côté admin
 * via la card parente (PATCH /api/tools/[slug]). Cette fiche-ci montre
 * la version actuelle pour le contexte mais ne l'édite pas.
 */
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return getMethodologies().map((m) => ({ slug: m.slug }));
}

export default async function MethodologyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const methodology = getMethodologyBySlug(slug);
  if (!methodology) {
    notFound();
  }

  // On va aussi récupérer l'enregistrement DB pour afficher la version
  // courante du title/desc édité par l'admin (pour info, à côté de la
  // version "pitch" qui vient de la methodology technique).
  const dbTool = await prisma.tool.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      popular: true,
      active: true,
      lastReviewedAt: true,
      nextReviewDue: true,
    },
  });

  // Sources officielles attachées au calc (URLs externes, PDFs téléchargeables)
  const rawAssets = await prisma.calculatorAsset.findMany({
    where: { slug },
    orderBy: [{ order: "asc" }, { uploadedAt: "desc" }],
  });
  const assets: CalculatorAsset[] = rawAssets.map((a) => ({
    ...a,
    uploadedAt: a.uploadedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-5 px-4 py-6 lg:px-6">
      {/* Breadcrumb / retour ----------------------------------------- */}
      <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <Link
          href="/admin/chomage/outils/calculateurs"
          className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Tous les calculateurs
        </Link>
        <span>/</span>
        <span className="truncate">{methodology.title}</span>
      </nav>

      {/* Bandeau revue annuelle (si Tool existe en DB) -------------- */}
      {dbTool ? (
        <ReviewBanner
          slug={slug}
          lastReviewedAt={
            dbTool.lastReviewedAt ? dbTool.lastReviewedAt.toISOString() : null
          }
          nextReviewDue={
            dbTool.nextReviewDue ? dbTool.nextReviewDue.toISOString() : null
          }
        />
      ) : null}

      {/* Version DB éditée par l'admin (si présente) ----------------- */}
      {dbTool ? (
        <section className="rounded-xl border border-border bg-muted/30 p-4">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Version publique éditable (table Tool)
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground">
                Titre affiché
              </div>
              <div className="text-[14px] font-semibold text-foreground">
                {dbTool.name}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground">
                État
              </div>
              <div className="text-[13px] text-foreground">
                {dbTool.active ? "✓ actif" : "✗ désactivé"}
                {dbTool.popular ? " · ★ populaire" : ""}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Description affichée
              </div>
              <p className="text-[13px] leading-relaxed text-foreground">
                {dbTool.description}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] text-muted-foreground">
            Pour éditer le titre ou la description, utilise les contrôles dans
            la liste{" "}
            <Link
              href="/admin/chomage/outils"
              className="font-medium text-foreground hover:underline"
            >
              /admin/chomage/outils
            </Link>{" "}
            (ou directement l&apos;API <code>PATCH /api/tools/{slug}</code>).
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-amber-300/40 bg-amber-50/30 p-4 text-[12.5px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
          <strong className="font-semibold">⚠️ Pas d&apos;entrée DB</strong>{" "}
          pour le slug <code className="font-mono">{slug}</code>. Lance{" "}
          <code className="font-mono">pnpm tsx scripts/seed-calculators.ts</code>{" "}
          pour seeder cet outil.
        </section>
      )}

      {/* Sources officielles & PDFs téléchargeables ----------------- */}
      <AssetsManager slug={slug} initialAssets={assets} />

      {/* Fiche méthodologie complète --------------------------------- */}
      <MethodologyCard data={methodology} assets={assets} />

      {/* Liens rapides ----------------------------------------------- */}
      <section className="flex flex-wrap gap-3 text-[12.5px]">
        <a
          href={`/outils/${methodology.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-semibold text-foreground hover:bg-muted"
        >
          Tester l&apos;outil public
          <ExternalLink className="size-3" />
        </a>
        <Link
          href="/admin/chomage/outils"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-semibold text-foreground hover:bg-muted"
        >
          Retour à la liste des outils
        </Link>
      </section>
    </div>
  );
}
