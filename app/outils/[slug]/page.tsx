import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { getToolBySlug, type Tool } from "@/lib/docbel-data";
import { DocumentForm } from "@/components/docbel/document-form/document-form";
import { LegacyToolView } from "./legacy-tool-view";
import { DisabledToolView } from "./disabled-tool-view";
import { RestrictedToolView } from "@/components/docbel/restricted-tool-view";
import { deriveAudiences, isAudienceId } from "@/lib/audience";
import {
  canUseTool,
  effectiveRules,
  toViewerAccount,
  type ViewerAccount,
} from "@/lib/entitlements";

export const dynamic = "force-dynamic";
// Pas de cache : le statut "actif/désactivé" doit refléter la DB en temps
// réel. Sans ça, une désactivation côté admin laisse la page accessible
// jusqu'à expiration du cache, et l'utilisateur tombe sur l'outil au lieu
// du DisabledToolView.
export const revalidate = 0;

/**
 * Convertit un Tool DB Prisma en Tool format `lib/docbel-data` (consommé
 * par LegacyToolView via ToolPage).
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
    audience?: string | null;
  },
  cat: string,
): Tool {
  // Hash léger du cuid pour avoir un number stable côté React keys.
  let h = 0;
  for (let i = 0; i < dbTool.id.length; i++) {
    h = (h << 5) - h + dbTool.id.charCodeAt(i);
  }
  const audienceMin = isAudienceId(dbTool.audience) ? dbTool.audience : "citoyen";
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
    audiences: deriveAudiences(audienceMin),
  };
}

export default async function ToolRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Compte courant (null si anonyme) + flag billing, pour l'enforcement d'accès.
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  let viewer: ViewerAccount | null = null;
  if (session?.user?.id) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, segment: true, partnerType: true },
    });
    viewer = toViewerAccount(u);
  }
  const billingEnabled =
    (await getSetting(SETTING_KEYS.BILLING_ENABLED)) === "true";

  // 1) Cherche le Tool DB. Avec select explicite pour récupérer aussi
  // `active` (le client Prisma le supporte depuis la migration).
  const dbTool = await prisma.tool.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      type: true,
      icon: true,
      popular: true,
      timeMin: true,
      active: true,
      audience: true,
      access: true,
      section: { select: { name: true } },
      documentTemplate: { select: { status: true } },
    },
  });

  // 2) Si l'outil existe en DB et est désactivé : afficher DisabledToolView
  // plutôt qu'un 404 ou la page d'outil normale. L'utilisateur voit alors
  // un message clair "outil temporairement indisponible" avec retour au
  // catalogue.
  if (dbTool && dbTool.active === false) {
    return <DisabledToolView toolName={dbTool.name} />;
  }

  // 2.5) Enforcement d'accès par ensemble {segment, partnerType}. Un outil
  // "citoyen" reste public (canUseTool renvoie true même pour un anonyme) ;
  // sinon, seul un compte du bon segment/sous-type passe.
  if (
    dbTool &&
    !canUseTool(
      viewer,
      { access: dbTool.access, audience: dbTool.audience },
      { billingEnabled },
    )
  ) {
    const segments = [
      ...new Set(
        effectiveRules({
          access: dbTool.access,
          audience: dbTool.audience,
        }).map((rule) => rule.segment),
      ),
    ];
    return <RestrictedToolView toolName={dbTool.name} segments={segments} />;
  }

  // 3) doc_generator publié → form dynamique
  if (
    dbTool?.type === "doc_generator" &&
    dbTool.documentTemplate?.status === "published"
  ) {
    return <DocumentForm slug={slug} />;
  }

  // 4) Tool DB actif (non-doc_generator) → LegacyToolView avec les méta DB.
  //    Couvre les calc_* seedés via scripts/seed-calculators.ts.
  if (dbTool) {
    return (
      <LegacyToolView
        tool={dbToolToView(dbTool, dbTool.section?.name ?? "Outils")}
      />
    );
  }

  // 5) Fallback final : catalogue statique TOOLS_DATA. Couvre les rares
  //    outils non encore migrés vers la DB (lookup-onem partenaire, etc.).
  //    Si même là le slug est introuvable, LegacyToolView affiche son
  //    propre message "Outil introuvable" (pas un 404 brut).
  const staticTool = getToolBySlug(slug);
  if (
    staticTool &&
    !canUseTool(
      viewer,
      { access: staticTool.audiences.map((segment) => ({ segment })) },
      { billingEnabled },
    )
  ) {
    return (
      <RestrictedToolView
        toolName={staticTool.title}
        segments={staticTool.audiences}
      />
    );
  }
  return <LegacyToolView tool={staticTool || null} />;
}
