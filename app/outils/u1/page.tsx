import type { Metadata } from "next";
import { U1PublicPage } from "@/components/docbel/u1-public-page";

export const metadata: Metadata = {
  title: "Attestation U1 — institutions européennes",
  description:
    "Trouvez l'institution compétente dans chaque pays de l'EEE et en Suisse pour demander votre attestation U1 (ex-E301), l'équivalent européen du C4.",
};

export default function U1Route() {
  return <U1PublicPage />;
}
