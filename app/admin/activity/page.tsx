import { prisma } from "@/lib/prisma";
import type { ActivityItem } from "@/components/admin/activity-log";
import { ActivityClient } from "@/components/admin/activity-client";

// Server Component : les 100 dernières activités sont récupérées côté serveur
// (le tri `createdAt DESC` est désormais indexé) et passées à l'île client qui
// gère recherche + filtres. Plus de fetch on-mount ni de spinner client.
// L'attente est couverte par app/admin/loading.tsx.
export default async function ActivityPage() {
  const rows = await prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // `action`/`resource` sont stockés en `String` côté DB mais typés en union
  // côté UI — les valeurs écrites par l'app correspondent toujours à l'union.
  const initialActivities: ActivityItem[] = rows.map((a) => ({
    id: a.id,
    user: a.user,
    action: a.action as ActivityItem["action"],
    resource: a.resource as ActivityItem["resource"],
    resourceName: a.resourceName,
    timestamp: a.createdAt.toISOString(),
    details: a.details ?? undefined,
  }));

  return <ActivityClient initialActivities={initialActivities} />;
}
