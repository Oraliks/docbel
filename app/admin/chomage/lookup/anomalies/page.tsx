import { redirect } from "next/navigation";

/// Page fusionnée dans /admin/chomage/lookup (tab Anomalies).
export default function LookupAnomaliesRedirect() {
  redirect("/admin/chomage/lookup?tab=anomalies");
}
