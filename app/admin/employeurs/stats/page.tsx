import { getPartnerStats } from "@/lib/partner-stats";
import { SegmentStatsView } from "@/components/admin/partenaires/segment-stats-view";

export const dynamic = "force-dynamic";

export default async function EmployerStatsPage() {
  const stats = await getPartnerStats("employeur");
  return <SegmentStatsView stats={stats} variant="employeur" />;
}
