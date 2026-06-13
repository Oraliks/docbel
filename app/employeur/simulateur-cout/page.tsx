import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Calculator, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CostSimulator } from "@/components/docbel/employeur/cost/cost-simulator";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import { prisma } from "@/lib/prisma";
import { labelReliability, type ReliabilityLevel } from "@/lib/employeur/constants";

export const metadata: Metadata = {
  title: "Simulateur de coût employeur | DocBel",
  description: "Estimez le coût employeur d'un engagement (estimation structurelle, indicative).",
};

export const dynamic = "force-dynamic";

const EUR = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n)
    ? "—"
    : `${n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export default async function SimulateurCoutPage() {
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const saved = await prisma.costSimulation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      grossMonthlySalary: true,
      estimatedMonthlyEmployerCost: true,
      reliability: true,
      updatedAt: true,
    },
  });

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <header className="space-y-1">
        <Button variant="ghost" size="sm" render={<Link href="/employeur" />} className="-ml-2 mb-1">
          <ArrowLeft /> Espace employeur
        </Button>
        <div className="flex items-center gap-2">
          <Calculator className="size-6 text-primary" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Simulateur de coût employeur</h1>
        </div>
        <p className="text-muted-foreground">
          Estimez le coût total d&apos;un engagement. Estimation structurelle et indicative :
          elle ne remplace pas un calcul payroll officiel d&apos;un secrétariat social.
        </p>
      </header>

      <CostSimulator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Mes simulations enregistrées</h2>
        {saved.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Aucune simulation enregistrée pour le moment.
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y rounded-lg border">
            {saved.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {EUR(s.grossMonthlySalary)} brut · coût mensuel {EUR(s.estimatedMonthlyEmployerCost)} ·{" "}
                    {new Date(s.updatedAt).toLocaleDateString("fr-BE")}
                  </p>
                </div>
                <Badge variant="outline">
                  Fiabilité&nbsp;: {labelReliability(s.reliability as ReliabilityLevel).toLowerCase()}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
