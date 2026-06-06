import { StatsClient } from "@/components/booking/stats-client";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return <StatsClient tenantId={tenantId} isAdmin />;
}
