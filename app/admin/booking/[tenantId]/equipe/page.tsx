import { EquipeClient } from "@/components/booking/equipe-client";

export const dynamic = "force-dynamic";

export default async function AdminEquipePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return <EquipeClient tenantId={tenantId} />;
}
