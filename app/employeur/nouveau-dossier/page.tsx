import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EngagementWizard } from "@/components/docbel/employeur/engagement-wizard";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";

export const metadata: Metadata = {
  title: "Préparer un engagement | Espace Employeur",
  description: "Assistant « Puis-je engager ? » — checklist, alertes et sources officielles.",
};

export const dynamic = "force-dynamic";

export default async function NouveauDossierPage() {
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  return (
    <div className="w-full space-y-4 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" render={<Link href="/employeur" />}>
        <ArrowLeft /> Tableau de bord
      </Button>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Puis-je engager ?</h1>
        <p className="text-muted-foreground">
          Quelques questions simples pour préparer votre engagement et générer une checklist.
        </p>
      </header>
      <EngagementWizard />
    </div>
  );
}
