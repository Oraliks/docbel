import type { Metadata } from "next";
import { SpaceLanding } from "@/components/docbel/space-landing";

export const metadata: Metadata = {
  title: "Espace Employeur | DocBel",
  description:
    "Outils RH pour employeurs belges : C4, attestations sociales, calcul de preavis.",
};

export default function EmployeurRoute() {
  return <SpaceLanding audience="employeur" />;
}
