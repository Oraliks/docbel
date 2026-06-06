import { notFound } from "next/navigation";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { tenantAccess } from "@/lib/booking/access";
import { EquipeClient } from "@/components/booking/equipe-client";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export const dynamic = "force-dynamic";

export default async function EquipePage({ params }: PageProps) {
  const { tenantId } = await params;

  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) notFound();

  const { tenant, role } = await tenantAccess(
    auth.user.id,
    auth.user.role,
    tenantId
  );
  if (!tenant || !role) notFound();
  if (role !== "owner") notFound();

  return <EquipeClient tenantId={tenantId} />;
}
