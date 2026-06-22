import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { RulesAdmin, type AdminRule } from "@/components/admin/employeur/rules-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.employeurAssistant");
  return { title: t("rulesMetaTitle") };
}

export default async function AdminEmployeurRulesPage() {
  const t = await getTranslations("admin.employeurAssistant");
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
        <h1 className="text-2xl font-semibold tracking-tight">{t("rulesTitle")}</h1>
        <p className="text-muted-foreground">
          {t("rulesDescription")}
        </p>
      </header>
      <RulesAdmin rules={rules} />
    </div>
  );
}
