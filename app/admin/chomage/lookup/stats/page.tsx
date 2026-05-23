import { redirect } from "next/navigation";

/// Page fusionnée dans /admin/chomage/lookup (tab Statistiques).
export default function LookupStatsRedirect() {
  redirect("/admin/chomage/lookup?tab=stats");
}
