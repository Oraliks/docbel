import { notFound } from "next/navigation";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { tenantAccess } from "@/lib/booking/access";
import { StatsClient } from "@/components/booking/stats-client";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) notFound();

  const { tenant, role } = await tenantAccess(auth.user.id, auth.user.role, tenantId);
  if (!tenant || !role) notFound();

  return <StatsClient tenantId={tenantId} isAdmin={auth.user.role === "admin"} />;
}
