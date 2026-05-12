import type { Metadata } from "next";
import { GlossairePage } from "@/components/docbel/glossaire-page";

export const metadata: Metadata = {
  title: "Glossaire des sigles administratifs",
  description:
    "Définitions des sigles utilisés par l'administration belge : ONEM, CAPAC, RIS, AGR, C4, BCE et plus encore.",
};

export default function GlossaireRoute() {
  return <GlossairePage />;
}
