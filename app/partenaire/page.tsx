import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { UnderConstructionPanel } from "@/components/docbel/under-construction-panel";

export const metadata: Metadata = {
  title: "Espace Partenaire | DocBel",
  description: "Espace partenaire DocBel — en construction.",
};

export const dynamic = "force-dynamic";

export default async function PartenaireRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  // Anonyme ou rôle non-partenaire → vers la landing marketing publique.
  if (!session?.user || session.user.role !== "partner") {
    redirect("/p/partenaire");
  }

  // Partenaire connecté → page "en construction". Le vrai tableau de bord
  // sera refait dans une session ultérieure, hors front website.
  return <UnderConstructionPanel space="partenaire" />;
}
