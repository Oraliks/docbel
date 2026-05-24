import type { Metadata } from "next";
import { SpaceLanding } from "@/components/docbel/space-landing";
import { filterByAudience, getPublicCatalog } from "@/lib/outils-catalog";

export const metadata: Metadata = {
  title: "Espace Employeur | DocBel",
  description:
    "Outils RH pour employeurs belges : C4, attestations sociales, calcul de preavis.",
};

export const dynamic = "force-dynamic";

export default async function EmployeurRoute() {
  // Catalogue serveur filtré par audience. Un employeur voit les outils
  // marqués "citoyen" (visibles par tous) ET "employeur" (réservés employeur+
  // partenaire). Pas les outils "partenaire".
  const all = await getPublicCatalog();
  const tools = filterByAudience(all, "employeur");
  return <SpaceLanding audience="employeur" tools={tools} />;
}
