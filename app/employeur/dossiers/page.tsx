import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Mes dossiers | Espace Employeur",
};

export const dynamic = "force-dynamic";

export default async function DossiersPage() {
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const scenarios = await listScenariosForUser(user.id);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <Button variant="ghost" size="sm" render={<Link href="/employeur" />}>
        <ArrowLeft /> Tableau de bord
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mes dossiers</h1>
        <Button render={<Link href="/employeur/nouveau-dossier" />}>
          <Plus /> Nouveau dossier
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aucun dossier pour le moment.
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
                  {s.jointCommitteeNumber ? `CP ${s.jointCommitteeNumber} · ` : ""}
                  {s._count.checklists} checklist(s)
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
