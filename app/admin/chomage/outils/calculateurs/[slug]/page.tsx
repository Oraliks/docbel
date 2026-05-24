import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getMethodologies,
  getMethodologyBySlug,
  getLastUpdatedAt,
  RELIABILITY_LABELS,
} from "@/lib/calculators/_methodology";
import { type CalculatorAsset } from "@/components/admin/calculateurs/assets-manager";

// Sections atomiques
import { MethodologyHeader } from "@/components/admin/calculateurs/sections/header";
import {
  MethodologyTabs,
  type MethodologyTabSpec,
} from "@/components/admin/calculateurs/sections/tabs";
import {
  MethodologyStatusGrid,
  type MethodologyStatusItem,
} from "@/components/admin/calculateurs/sections/status-grid";
import { MethodologyBrief } from "@/components/admin/calculateurs/sections/brief";
import { MethodologyInputsOutputs } from "@/components/admin/calculateurs/sections/inputs-outputs";
import { MethodologyFormulasTable } from "@/components/admin/calculateurs/sections/formulas-table";
import { MethodologySidebar } from "@/components/admin/calculateurs/sections/sidebar";
import { MethodologySourcesList } from "@/components/admin/calculateurs/sections/sources-list";
import { MethodologyConstantsTable } from "@/components/admin/calculateurs/sections/constants-table";
import { MethodologyMaintenanceSection } from "@/components/admin/calculateurs/sections/maintenance-section";
import { MethodologyPdfsSection } from "@/components/admin/calculateurs/sections/pdfs-section";
import { OverviewExtras } from "@/components/admin/calculateurs/sections/overview-extras";

/**
 * Fiche méthodologie d'un calculateur (admin).
 *
 * Layout 2 colonnes : contenu central (orchestré selon l'onglet actif via
 * `searchParams.tab`) + sidebar droite sticky avec aperçu rapide, infos
 * pratiques, intégration et état de santé.
 *
 * La même structure fonctionne pour les 10 calculateurs : tous les
 * composants reçoivent `data: CalcMethodology` et dégradent proprement
 * quand un champ optionnel (briefMeta, inputsDetailed, outputs…) est absent.
 *
 * Source de la fiche : `lib/calculators/_methodology.ts`. La table `Tool`
 * fournit les métadonnées DB (lastReviewedAt, createdAt/updatedAt, active).
 */
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return getMethodologies().map((m) => ({ slug: m.slug }));
}

const VALID_TABS = [
  "apercu",
  "sources",
  "formules",
  "constantes",
  "pdfs",
  "maintenance",
] as const;

type TabId = (typeof VALID_TABS)[number];

function resolveTab(raw: string | undefined): TabId {
  if (!raw) return "apercu";
  return (VALID_TABS as readonly string[]).includes(raw)
    ? (raw as TabId)
    : "apercu";
}

export default async function MethodologyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab: rawTab } = await searchParams;
  const methodology = getMethodologyBySlug(slug);
  if (!methodology) {
    notFound();
  }

  const activeTab = resolveTab(rawTab);

  // Fetch DB tool + assets
  const [dbTool, rawAssets] = await Promise.all([
    prisma.tool.findUnique({
      where: { slug },
      select: {
        name: true,
        description: true,
        popular: true,
        active: true,
        lastReviewedAt: true,
        nextReviewDue: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.calculatorAsset.findMany({
      where: { slug },
      orderBy: [{ order: "asc" }, { uploadedAt: "desc" }],
    }),
  ]);

  const assets: CalculatorAsset[] = rawAssets.map((a) => ({
    ...a,
    uploadedAt: a.uploadedAt.toISOString(),
  }));

  // ----- Sidebar tool meta (sérialisation ISO) -----
  const sidebarTool = dbTool
    ? {
        description: dbTool.description,
        active: dbTool.active,
        lastReviewedAt: dbTool.lastReviewedAt
          ? dbTool.lastReviewedAt.toISOString()
          : null,
        nextReviewDue: dbTool.nextReviewDue
          ? dbTool.nextReviewDue.toISOString()
          : null,
        createdAt: dbTool.createdAt
          ? dbTool.createdAt.toISOString()
          : null,
        updatedAt: dbTool.updatedAt
          ? dbTool.updatedAt.toISOString()
          : null,
      }
    : null;

  // ----- Status grid items (4 cards, onglet Aperçu) -----
  const lastUpdated = getLastUpdatedAt(methodology);
  const isPublished = dbTool?.active !== false;
  const statusItems: MethodologyStatusItem[] = [
    {
      label: "Statut",
      value: isPublished ? "Publié" : "Désactivé",
      hint: lastUpdated
        ? new Date(lastUpdated).toLocaleDateString("fr-BE", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : undefined,
      variant: isPublished ? "success" : "default",
    },
    {
      label: "Version",
      value: String(methodology.year),
      hint: "Données barèmes",
    },
    {
      label: "Portée",
      value: methodology.badges?.[0] ?? "Belgique",
      hint: methodology.category ?? "Salarié",
    },
    {
      label: "Fiabilité",
      value: RELIABILITY_LABELS[methodology.reliability],
      hint: methodology.badges?.[1],
      variant:
        methodology.reliability === "high"
          ? "success"
          : methodology.reliability === "medium"
            ? "warning"
            : "danger",
    },
  ];

  // ----- Tabs spec -----
  const tabs: MethodologyTabSpec[] = [
    { id: "apercu", label: "Aperçu" },
    { id: "sources", label: "Sources", count: methodology.sources.length },
    { id: "formules", label: "Formules", count: methodology.formulas.length },
    {
      id: "constantes",
      label: "Constantes & barèmes",
      count: methodology.constants.length,
    },
    { id: "pdfs", label: "PDFs attachés", count: assets.length },
    { id: "maintenance", label: "Maintenance" },
  ];

  const publicUrl = `/outils/${slug}`;

  // ----- Contenu central par onglet -----
  let mainContent: React.ReactNode;
  switch (activeTab) {
    case "sources":
      mainContent = <MethodologySourcesList sources={methodology.sources} />;
      break;
    case "formules":
      mainContent = (
        <MethodologyFormulasTable formulas={methodology.formulas} />
      );
      break;
    case "constantes":
      mainContent = (
        <MethodologyConstantsTable constants={methodology.constants} />
      );
      break;
    case "pdfs":
      mainContent = (
        <MethodologyPdfsSection slug={slug} assets={assets} />
      );
      break;
    case "maintenance":
      mainContent = (
        <MethodologyMaintenanceSection
          slug={slug}
          guide={methodology.maintenanceGuide}
          lastReviewedAt={sidebarTool?.lastReviewedAt ?? null}
          nextReviewDue={sidebarTool?.nextReviewDue ?? null}
        />
      );
      break;
    case "apercu":
    default:
      mainContent = (
        <div className="flex flex-col gap-4">
          <MethodologyStatusGrid items={statusItems} />
          <MethodologyBrief
            description={methodology.reliabilityNote}
            items={methodology.briefMeta}
          />
          <MethodologyInputsOutputs
            inputs={methodology.inputsDetailed}
            inputsSimple={methodology.inputs}
            outputs={methodology.outputs}
            detailUrl={`?tab=formules`}
          />
          <MethodologyFormulasTable
            formulas={methodology.formulas}
            limit={5}
            fullUrl={`?tab=formules`}
          />
          <OverviewExtras
            pedagogyIntro={methodology.pedagogyIntro}
            differentiators={methodology.differentiators}
            limitations={methodology.limitations}
          />
        </div>
      );
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-6 lg:px-6">
      {/* Zone 1 : Header (breadcrumb + titre + badges + actions) */}
      <MethodologyHeader
        data={methodology}
        dbTool={dbTool}
        publicUrl={publicUrl}
      />

      {/* Zone 2 : Tabs */}
      <MethodologyTabs activeTab={activeTab} tabs={tabs} />

      {/* Zone 3 : Layout 2 colonnes (contenu / sidebar) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Contenu central */}
        <div className="flex min-w-0 flex-col gap-4">{mainContent}</div>

        {/* Sidebar — toujours visible (pas dans les tabs) */}
        <MethodologySidebar
          data={methodology}
          dbTool={sidebarTool}
          assets={assets}
          publicUrl={publicUrl}
        />
      </div>

      {/* Pas d'entrée DB : alerte explicite ----------------------- */}
      {!dbTool ? (
        <section className="rounded-xl border border-amber-300/40 bg-amber-50/30 p-4 text-[12.5px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
          <strong className="font-semibold">
            Pas d&apos;entrée DB pour ce slug.
          </strong>{" "}
          Lance{" "}
          <code className="font-mono">
            pnpm tsx scripts/seed-calculators.ts
          </code>{" "}
          pour seeder cet outil.
        </section>
      ) : null}
    </div>
  );
}
