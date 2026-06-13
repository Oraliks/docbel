import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { RulesAdmin, type AdminRule } from "@/components/admin/employeur/rules-admin";

export const metadata: Metadata = { title: "Règles métier — Employeur | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminEmployeurRulesPage() {
  const rows = await prisma.employerRule.findMany({ orderBy: { code: "asc" } });
  const rules: AdminRule[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    severity: r.severity,
    sourceCode: r.sourceCode,
    internalNote: r.internalNote,
    active: r.active,
  }));

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Règles métier</h1>
        <p className="text-muted-foreground">
          Moteur déterministe de l'assistant employeur. Une règle ne peut être activée sans source
          officielle ni justification interne.
        </p>
      </header>
      <RulesAdmin rules={rules} />
    </div>
  );
}
