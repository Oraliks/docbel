import { CreneauxClient } from "@/components/booking/creneaux-client";

export const dynamic = "force-dynamic";

export default async function AdminCreneauxPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return <CreneauxClient tenantId={tenantId} role="owner" />;
}
