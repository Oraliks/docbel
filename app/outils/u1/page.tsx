import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { U1PublicPage } from "@/components/docbel/u1-public-page";
import { DisabledToolView } from "../[slug]/disabled-tool-view";

export const metadata: Metadata = {
  title: "Attestation U1 — institutions européennes",
  description:
    "Trouvez l'institution compétente dans chaque pays de l'EEE et en Suisse pour demander votre attestation U1 (ex-E301), l'équivalent européen du C4.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function U1Route() {
  const dbTool = await prisma.tool.findUnique({
    where: { slug: "u1" },
    select: { name: true, active: true },
  });
  if (dbTool && dbTool.active === false) {
    return <DisabledToolView toolName={dbTool.name} />;
  }
  return <U1PublicPage />;
}
