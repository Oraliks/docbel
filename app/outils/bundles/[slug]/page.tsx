import { redirect } from "next/navigation";

/// Redirection 308 (permanente) de l'ancienne URL `/outils/bundles/[slug]` vers
/// la page « Mon dossier » sur le front. Les dossiers vivent à `/mon-dossier`
/// en interne, mais ne sont pas listés comme « outils » — cette page redirige
/// tout appel legacy vers l'accueil des dossiers.
export default async function LegacyBundleRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  redirect("https://www.docbel.be/mon-dossier");
}
