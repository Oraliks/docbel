import type { Metadata } from "next";
import { OrgFormationsListPage } from "@/components/formations/org/server-pages";

export const metadata: Metadata = { title: "Mes formations | Espace Employeur" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <OrgFormationsListPage segment="employeur" />;
}
