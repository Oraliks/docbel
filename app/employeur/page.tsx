import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { UnderConstructionPanel } from "@/components/docbel/under-construction-panel";

export const metadata: Metadata = {
  title: "Espace Employeur | DocBel",
  description: "Espace employeur DocBel — en construction.",
};

export const dynamic = "force-dynamic";

export default async function EmployeurRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  // Anonyme ou rôle non-employeur → vers la landing marketing publique.
  if (!session?.user || session.user.role !== "employer") {
    redirect("/p/employeur");
  }

  // Employeur connecté → page "en construction". Le vrai tableau de bord
  // sera refait dans une session ultérieure, hors front website.
  return <UnderConstructionPanel space="employeur" />;
}
