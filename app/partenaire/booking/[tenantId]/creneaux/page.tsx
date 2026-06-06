import { notFound } from "next/navigation";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { tenantAccess } from "@/lib/booking/access";
import { CreneauxClient } from "@/components/booking/creneaux-client";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export const dynamic = "force-dynamic";

export default async function CreneauxPage({ params }: PageProps) {
  const { tenantId } = await params;

  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) notFound();

  const { tenant, role } = await tenantAccess(
    auth.user.id,
    auth.user.role,
    tenantId
  );
  if (!tenant || !role) notFound();

  return <CreneauxClient tenantId={tenantId} role={role} />;
}
