import type { Metadata } from "next";
import { getFormationsPageUser } from "@/lib/formations/page-auth";
import { getMyEnrollments, getMySavedTrainings, getMyResults } from "@/lib/formations/me-queries";
import { MesFormationsClient } from "@/components/formations/mes-formations-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mes formations — Docbel",
  description: "Vos inscriptions, formations sauvegardées et résultats d'orientation.",
};

export default async function MesFormationsPage() {
  const user = await getFormationsPageUser();

  if (!user) {
    return (
      <MesFormationsClient isLoggedIn={false} enrollments={[]} results={[]} serverSavedSlugs={[]} />
    );
  }

  const [enrollments, saved, results] = await Promise.all([
    getMyEnrollments(user.id),
    getMySavedTrainings(user.id),
    getMyResults(user.id),
  ]);

  return (
    <MesFormationsClient
      isLoggedIn
      enrollments={enrollments}
      results={results}
      serverSavedSlugs={saved.map((s) => s.slug)}
    />
  );
}
