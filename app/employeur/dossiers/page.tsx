import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import { listScenariosForUser } from "@/lib/employeur/queries";
import {
  labelScenarioStatus,
  labelWorkerType,
  labelContractType,
} from "@/lib/employeur/constants";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return {
    title: t("dossierListMetaTitle"),
  };
}

export const dynamic = "force-dynamic";

export default async function DossiersPage() {
  const t = await getTranslations("public.pro");
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const scenarios = await listScenariosForUser(user.id);

  return (
    <div className="w-full space-y-5 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" render={<Link href="/employeur" />}>
        <ArrowLeft /> {t("backToDashboard")}
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("dossierListTitle")}</h1>
        <Button render={<Link href="/employeur/nouveau-dossier" />}>
          <Plus /> {t("dossierNew")}
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("dossierListEmpty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((s) => (
            <Link key={s.id} href={`/employeur/dossiers/${s.id}`} className="block no-underline">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <Badge variant="outline">{labelScenarioStatus(s.status)}</Badge>
                  </div>
                  <CardDescription>
                    {labelWorkerType(s.workerType)} · {labelContractType(s.contractType)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {s.jointCommitteeNumber
                    ? t("dossierCpPrefix", { n: s.jointCommitteeNumber })
                    : ""}
                  {t("dossierChecklistCount", { count: s._count.checklists })}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
