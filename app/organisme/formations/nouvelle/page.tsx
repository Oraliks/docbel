import type { Metadata } from "next";
import { OrgFormationsNewPage } from "@/components/formations/org/server-pages";

export const metadata: Metadata = { title: "Créer une formation | Espace Organisme" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <OrgFormationsNewPage segment="organisme" />;
}
