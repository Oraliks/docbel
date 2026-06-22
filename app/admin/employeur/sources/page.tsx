import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { SourcesAdmin, type AdminSource } from "@/components/admin/employeur/sources-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.employeurAssistant");
  return { title: t("sourcesMetaTitle") };
}

export default async function AdminEmployeurSourcesPage() {
  const t = await getTranslations("admin.employeurAssistant");
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
        <h1 className="text-2xl font-semibold tracking-tight">{t("sourcesTitle")}</h1>
        <p className="text-muted-foreground">
          {t("sourcesDescription")}
        </p>
      </header>
      <SourcesAdmin sources={sources} />
    </div>
  );
}
