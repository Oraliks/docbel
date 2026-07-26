import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangleIcon,
  ClockIcon,
  GraduationCapIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";
import { getOrgPageUser } from "@/lib/formations/page-auth";
import { getOrgContext, getOrgStats } from "@/lib/formations/org-queries";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORG_STATUS_LABELS, type FormationOrgStatus } from "@/lib/formations/constants";

export const metadata: Metadata = { title: "Espace Organisme | Docbel" };
export const dynamic = "force-dynamic";

export default async function OrganismeHomePage() {
  const user = await getOrgPageUser("organisme");
  if (!user) redirect("/formations/proposer");

  const { orgIds } = await getOrgContext(user.id, user.role);
  const [stats, orgs] = await Promise.all([
    getOrgStats(orgIds),
    orgIds.length
      ? prisma.formationOrganization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true, status: true, reviewNote: true, rejectedReason: true },
        })
      : Promise.resolve([]),
  ]);

  const org = orgs[0] ?? null;
  const pending = org?.status === "pending";
  const blocked = org?.status === "suspended" || org?.status === "rejected";

  return (
    <div className="w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {org?.name ?? "Mon organisme"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez votre catalogue de formations et votre équipe.
          </p>
        </div>
        {org && (
          <Badge variant={org.status === "active" ? "default" : "outline"}>
            {ORG_STATUS_LABELS[org.status as FormationOrgStatus] ?? org.status}
          </Badge>
        )}
      </div>

      {pending && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <ClockIcon className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Votre organisation est en cours de validation.</p>
              <p className="text-muted-foreground">
                Vous pouvez déjà préparer vos formations en brouillon. La publication sera
                possible dès que Docbel aura validé votre organisation.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {blocked && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">
                {org?.status === "rejected"
                  ? "Votre demande n'a pas été retenue."
                  : "Votre organisation est suspendue."}
              </p>
              {(org?.rejectedReason || org?.reviewNote) && (
                <p className="text-muted-foreground">{org.rejectedReason || org.reviewNote}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Formations" value={stats.total} />
        <StatCard label="Publiées" value={stats.published} />
        <StatCard label="En validation" value={stats.pendingReview} />
        <StatCard label="Inscriptions à traiter" value={stats.pendingEnrollments} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button render={<Link href="/organisme/formations/nouvelle" />}>
            <PlusIcon /> Créer une formation
          </Button>
          <Button variant="outline" render={<Link href="/organisme/formations" />}>
            <GraduationCapIcon /> Mes formations
          </Button>
          <Button variant="outline" render={<Link href="/organisme/equipe" />}>
            <UsersIcon /> Mon équipe
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
