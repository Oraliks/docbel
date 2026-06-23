import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EngagementWizard } from "@/components/docbel/employeur/engagement-wizard";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return {
    title: t("engageMetaTitle"),
    description: t("engageMetaDesc"),
  };
}

export const dynamic = "force-dynamic";

export default async function NouveauDossierPage() {
  const t = await getTranslations("public.pro");
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  return (
    <div className="w-full space-y-4 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" render={<Link href="/employeur" />}>
        <ArrowLeft /> {t("backToDashboard")}
      </Button>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("engageTitle")}</h1>
        <p className="text-muted-foreground">{t("engageIntro")}</p>
      </header>
      <EngagementWizard />
    </div>
  );
}
