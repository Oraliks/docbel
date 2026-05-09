import type { Metadata } from "next";
import { CommissionsParitairesPage } from "@/components/docbel/commissions-paritaires-page";

export const metadata: Metadata = {
  title: "Commissions paritaires belges",
  description:
    "Liste officielle des commissions paritaires (CP) et sous-commissions belges, avec recherche par code, numéro ou secteur.",
};

export default function CommissionsParitairesRoute() {
  return <CommissionsParitairesPage />;
}
