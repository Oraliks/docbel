import type { Metadata } from "next";
import { SpaceLanding } from "@/components/docbel/space-landing";

export const metadata: Metadata = {
  title: "Espace Partenaire | DocBel",
  description:
    "Espace partenaire DocBel : CPAS, syndicats, mutuelles. Suivi de dossiers et tableau de bord.",
};

export default function PartenaireRoute() {
  return <SpaceLanding audience="partenaire" />;
}
