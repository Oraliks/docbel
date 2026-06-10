// Crée des DocumentBundle "draft" vides pour les dossiers à venir.
//
// Contexte : le wizard d'orientation /mon-dossier doit pouvoir router vers
// /d/<slug> sans 404, même pour des dossiers qui n'ont pas encore de contenu.
// Ce script seed donc des bundles "coquilles" — `active: true` pour qu'ils
// soient routables, mais `showOnOnboarding: false` pour ne pas polluer la
// page d'accueil tant qu'ils n'ont pas été étoffés en admin.
//
// Le dossier CT (`chomage-temporaire`) existe déjà : on ne le touche jamais.
//
// Idempotent au niveau du slug — si le bundle existe déjà, on ne fait rien.
//
// Usage : pnpm tsx scripts/seed-empty-bundles.ts        (dry run)
//         pnpm tsx scripts/seed-empty-bundles.ts --yes  (applique)
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { BundleWarning, LifeEventCategoryId } from "@/lib/bundles/types";

const APPLY = process.argv.includes("--yes");

/// Avertissement standard "ce dossier est en construction" — ajouté à tous
/// les bundles seedés ici pour que l'utilisateur comprenne qu'il atterrit
/// sur une coquille et non sur le dossier complet.
const UNDER_CONSTRUCTION_WARNING: BundleWarning = {
  id: "under-construction",
  title: "Dossier en construction",
  message:
    "Ce dossier est en construction. Reviens bientôt pour la version complète.",
  severity: "info",
};

interface EmptyBundleSeed {
  slug: string;
  name: string;
  description: string;
  lifeEventCategory: LifeEventCategoryId;
  icon: string;
  color: string;
  /// Ordre d'affichage. Le CT existant est à 0 — on commence à 10 ici pour
  /// laisser de la marge si l'admin veut intercaler d'autres bundles plus tard.
  order: number;
}

const BUNDLES: readonly EmptyBundleSeed[] = [
  {
    slug: "chomage-complet",
    name: "Chômage complet",
    description:
      "Dossier d'inscription au chômage complet après perte d'emploi (licenciement, démission, fin de CDD).",
    lifeEventCategory: "emploi",
    icon: "UserMinus",
    color: "#DC2626",
    order: 10,
  },
  {
    slug: "chomage-frontalier",
    name: "Chômage frontalier",
    description:
      "Dossier pour les travailleurs frontaliers (Belgique/France/Luxembourg/Pays-Bas) qui ouvrent ou maintiennent un droit aux allocations.",
    lifeEventCategory: "emploi",
    icon: "MapPinned",
    color: "#0EA5E9",
    order: 20,
  },
  {
    slug: "prepension",
    name: "Régime de chômage avec complément d'entreprise (RCC)",
    description:
      "Ex-prépension : ancien régime accordé à certains travailleurs licenciés en fin de carrière.",
    lifeEventCategory: "emploi",
    icon: "Clock",
    color: "#7C3AED",
    order: 30,
  },
] as const;

type SeedStatus = "created" | "exists" | "would-create";

async function seedOne(b: EmptyBundleSeed): Promise<{ status: SeedStatus; message: string }> {
  const existing = await prisma.documentBundle.findUnique({ where: { slug: b.slug } });
  if (existing) {
    return {
      status: "exists",
      message: `Existe déjà (id=${existing.id}, active=${existing.active}, order=${existing.order})`,
    };
  }

  if (!APPLY) {
    return {
      status: "would-create",
      message: `(dry-run) prêt à créer — category=${b.lifeEventCategory}, icon=${b.icon}, color=${b.color}, order=${b.order}`,
    };
  }

  const created = await prisma.documentBundle.create({
    data: {
      slug: b.slug,
      name: b.name,
      description: b.description,
      icon: b.icon,
      color: b.color,
      active: true,
      order: b.order,
      lifeEventCategory: b.lifeEventCategory,
      showOnOnboarding: false,
      vocabularyTags: [] as unknown as Prisma.InputJsonValue,
      eligibilityQuestions: [] as unknown as Prisma.InputJsonValue,
      warnings: [UNDER_CONSTRUCTION_WARNING] as unknown as Prisma.InputJsonValue,
      createdBy: "system-seed",
    },
    select: { id: true, slug: true },
  });

  return { status: "created", message: `Créé id=${created.id} — active=true, showOnOnboarding=false` };
}

async function main() {
  console.log(`Mode : ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  let createdCount = 0;
  let existsCount = 0;
  let wouldCreateCount = 0;

  for (const b of BUNDLES) {
    const res = await seedOne(b);
    const icon =
      res.status === "created" ? "[OK]" : res.status === "exists" ? "[--]" : "[..]";
    console.log(`${icon} ${b.slug.padEnd(20)} ${res.message}`);
    if (res.status === "created") createdCount++;
    else if (res.status === "exists") existsCount++;
    else wouldCreateCount++;
  }

  console.log("");
  if (APPLY) {
    console.log(`Résumé : ${createdCount} créé(s), ${existsCount} déjà présent(s).`);
  } else {
    console.log(
      `Résumé dry-run : ${wouldCreateCount} à créer, ${existsCount} déjà présent(s). Passe --yes pour appliquer.`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
