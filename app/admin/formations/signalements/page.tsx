import { listReports, getReportCounts } from "@/lib/formations/admin-queries";
import { SignalementsClient } from "./signalements-client";

export const dynamic = "force-dynamic";

export default async function SignalementsPage() {
  const [reports, counts] = await Promise.all([
    listReports(),
    getReportCounts(),
  ]);

  return <SignalementsClient reports={reports} counts={counts} />;
}
