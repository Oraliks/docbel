import { headers, cookies } from "next/headers";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { localizeRecords } from "@/lib/i18n/content";
import { loadMesDemarches } from "@/lib/bundles/mes-demarches";
import { MesDemarchesClient } from "@/components/docbel/mes-demarches-client";

export const dynamic = "force-dynamic";

/// Cookie de continuité anonyme posé par le wizard/runner (cf. `app/d/[slug]/page.tsx`).
/// Bloc de résolution session copié À L'IDENTIQUE (même constante, même ordre
/// userId puis sessionId) — ne jamais élargir le périmètre d'ownership ici.
const BUNDLE_COOKIE = "beldoc-bundle-session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.dossier");
  return {
    title: t("mesDemarchesMetaTitle"),
    description: t("mesDemarchesSubtitle"),
  };
}

export default async function MesDemarchesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(BUNDLE_COOKIE)?.value || null;

  const groups = await loadMesDemarches({ userId, sessionId });

  // `loadMesDemarches` renvoie `bundle.name` BRUT (FR, décision Task 3.1) —
  // on le localise ici, avec le même mécanisme que `/d/[slug]` et
  // `/mon-dossier` (`localizeRecords`, no-op si locale=fr). Un seul appel
  // batché pour tous les dossiers de la page plutôt qu'un appel par groupe.
  const locale = await getLocale();
  // Spread en objets frais : `MesDemarchesBundleMeta` est une interface
  // nommée (sans signature d'index), non structurellement assignable au
  // paramètre générique `T extends Record<string, unknown>` de
  // `localizeRecords` — contrairement aux lignes Prisma brutes utilisées par
  // /d/[slug] et /mon-dossier, qui satisfont ce constraint nativement.
  const localizedBundles = await localizeRecords(
    "DocumentBundle",
    groups.map((g) => ({ ...g.bundle })),
    ["name"],
    locale,
  );
  const localizedGroups = groups.map((g, i) => ({
    ...g,
    bundle: localizedBundles[i] ?? g.bundle,
  }));

  return <MesDemarchesClient groups={localizedGroups} />;
}
