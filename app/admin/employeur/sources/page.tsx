import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SourcesAdmin, type AdminSource } from "@/components/admin/employeur/sources-admin";

export const metadata: Metadata = { title: "Sources officielles — Employeur | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminEmployeurSourcesPage() {
  const rows = await prisma.employerLegalSource.findMany({ orderBy: { code: "asc" } });
  const sources: AdminSource[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    institution: r.institution,
    url: r.url,
    contentSummary: r.contentSummary,
    reliability: r.reliability,
    appliesToModules: r.appliesToModules,
    active: r.active,
    lastCheckedAt: r.lastCheckedAt ? r.lastCheckedAt.toISOString() : null,
  }));

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sources officielles</h1>
        <p className="text-muted-foreground">
          Registre des sources (S1…) citées par l'assistant employeur. Marquez-les comme vérifiées
          pour suivre leur fraîcheur.
        </p>
      </header>
      <SourcesAdmin sources={sources} />
    </div>
  );
}
