import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PayslipControl } from "@/components/docbel/employeur/controle/payslip-control";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";

export const metadata: Metadata = {
  title: "Contrôle de fiche | Espace Employeur",
  description:
    "Contrôle de cohérence indicatif d'une fiche de paie — détection d'incohérences potentielles, sans certification.",
};

export const dynamic = "force-dynamic";

export default async function ControlePage() {
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <Button variant="ghost" size="sm" render={<Link href="/employeur" />}>
        <ArrowLeft /> Tableau de bord
      </Button>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Contrôle de fiche</h1>
        <p className="text-muted-foreground">
          Encodez les données de votre fiche de paie : Docbel signale les incohérences
          potentielles. Ce contrôle est indicatif et ne certifie pas la conformité de la fiche.
        </p>
      </header>
      <PayslipControl />
    </div>
  );
}
