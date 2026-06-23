import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return {
    title: t("costMetaTitle"),
    description: t("costMetaDesc"),
  };
}

export const dynamic = "force-dynamic";

const EUR = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n)
    ? "—"
    : `${n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export default async function SimulateurCoutPage() {
  const t = await getTranslations("public.pro");
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
          <ArrowLeft /> {t("backToEmployerSpace")}
        </Button>
        <div className="flex items-center gap-2">
          <Calculator className="size-6 text-primary" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">{t("costTitle")}</h1>
        </div>
        <p className="text-muted-foreground">{t("costIntro")}</p>
      </header>

      <CostSimulator />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("costSavedTitle")}</h2>
        {saved.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {t("costSavedEmpty")}
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
                    {t("costSavedLine", {
                      gross: EUR(s.grossMonthlySalary),
                      cost: EUR(s.estimatedMonthlyEmployerCost),
                      date: new Date(s.updatedAt).toLocaleDateString("fr-BE"),
                    })}
                  </p>
                </div>
                <Badge variant="outline">
                  {t("costReliabilityLabel", {
                    value: labelReliability(s.reliability as ReliabilityLevel).toLowerCase(),
                  })}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
