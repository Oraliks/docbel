import { prisma } from "@/lib/prisma";
import { fetchToolActive } from "@/lib/tools-active";
import { getToolBySlug, type Tool } from "@/lib/docbel-data";
import { DocumentForm } from "@/components/docbel/document-form/document-form";
import { LegacyToolView } from "./legacy-tool-view";
import { DisabledToolView } from "./disabled-tool-view";

export const dynamic = "force-dynamic";

/**
 * Convertit un Tool DB Prisma en Tool format `lib/docbel-data` (consommé
 * par LegacyToolView via ToolPage). On garde l'audience large par défaut
 * — affiner si besoin (cf. outils-catalog.ts pour la version "publique").
 */
function dbToolToView(
  dbTool: {
    id: string;
    name: string;
    slug: string;
    description: string;
    type: string;
    icon: string | null;
    popular: boolean;
    timeMin: number | null;
  },
  cat: string,
): Tool {
  // Hash léger du cuid pour avoir un number stable côté React keys.
  let h = 0;
  for (let i = 0; i < dbTool.id.length; i++) {
    h = (h << 5) - h + dbTool.id.charCodeAt(i);
  }
  return {
    id: Math.abs(h),
    cat,
    icon: dbTool.icon ?? "🛠️",
    title: dbTool.name,
    desc: dbTool.description,
    popular: dbTool.popular,
    time: dbTool.timeMin ? `${dbTool.timeMin} min` : "instant",
    type: dbTool.type,
    slug: dbTool.slug,
    audiences: ["citoyen", "employeur", "partenaire"],
  };
}

export default async function ToolRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 1) Cherche un Tool dynamique en base
  const dbTool = await prisma.tool.findUnique({
    where: { slug },
    include: {
      section: { select: { name: true } },
      documentTemplate: { select: { status: true } },
    },
  });

  // 2) Vérifie active via raw SQL (le client Prisma ne connaît pas encore le
  // champ tant que pnpm db:generate n'a pas tourné après la migration récente).
  // Si l'outil est en DB et désactivé : on rend la page "désactivé" plutôt
  // qu'un 404, avec le nom de l'outil pour contexte.
  if (dbTool) {
    const active = await fetchToolActive(slug);
    if (active === false) {
      return <DisabledToolView toolName={dbTool.name} />;
    }
  }

  if (
    dbTool?.type === "doc_generator" &&
    dbTool.documentTemplate?.status === "published"
  ) {
    return <DocumentForm slug={slug} />;
  }

  // 3) Si on a un Tool en DB (non doc_generator), on l'utilise comme source
  //    de vérité : title/description édités côté admin se reflètent ici.
  //    Couvre les calc_* seedés via scripts/seed-calculators.ts.
  if (dbTool) {
    return (
      <LegacyToolView
        tool={dbToolToView(dbTool, dbTool.section?.name ?? "Outils")}
      />
    );
  }

  // 4) Fallback final : catalogue statique (lib/docbel-data.ts). Couvre les
  //    rares outils non encore migrés vers la DB (préavis, bureaux, etc.
  //    qui ont en plus une config admin dédiée).
  const staticTool = getToolBySlug(slug);
  return <LegacyToolView tool={staticTool || null} />;
}
