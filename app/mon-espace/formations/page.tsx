import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getFormationsPageUser } from "@/lib/formations/page-auth";
import { getMyEnrollments, getMySavedTrainings, getMyResults, getMyCertificates } from "@/lib/formations/me-queries";
import { getTrainingAccess } from "@/lib/formations/module";
import { ModuleGate } from "@/components/formations/module-gate";
import { MesFormationsClient } from "@/components/formations/mes-formations-client";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.formations");
  return {
    title: t("metaMyTrainingsTitle"),
    description: t("metaMyTrainingsDescription"),
  };
}

export default async function MesFormationsPage() {
  const user = await getFormationsPageUser();

  const { access, config } = await getTrainingAccess(
    { role: user?.role ?? null, isAdmin: user?.isAdmin },
    "citizen",
  );
  if (access === "hidden") notFound();
  if (access !== "ok")
    return <ModuleGate access={access} maintenanceMessage={config.maintenanceMessage} />;

  if (!user) {
    return (
      <MesFormationsClient
        isLoggedIn={false}
        enrollments={[]}
        results={[]}
        certificates={[]}
        serverSavedSlugs={[]}
      />
    );
  }

  const [enrollments, saved, results, certificates] = await Promise.all([
    getMyEnrollments(user.id),
    getMySavedTrainings(user.id),
    getMyResults(user.id),
    getMyCertificates(user.id),
  ]);

  return (
    <MesFormationsClient
      isLoggedIn
      enrollments={enrollments}
      results={results}
      certificates={certificates}
      serverSavedSlugs={saved.map((s) => s.slug)}
    />
  );
}
