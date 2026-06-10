import { redirect } from "next/navigation";

/// Redirection 308 (permanente) de l'ancienne URL `/outils/bundles/[slug]` vers
/// la nouvelle URL canonique `/d/[slug]`. Préserve la query string (eg.
/// `?resume=…` pour la reprise d'un parcours). À conserver tant que d'anciens
/// liens (bookmarks, emails de reprise, partage externe) circulent.
export default async function LegacyBundleRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/d/${slug}`);
}
