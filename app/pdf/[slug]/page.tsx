import { redirect } from "next/navigation";

/// Ancienne URL publique `/pdf/[slug]` → redirige vers `/document/[slug]`.
/// Conservé pour ne pas casser d'éventuels liens déjà partagés.
export default async function LegacyPdfRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/document/${slug}`);
}
