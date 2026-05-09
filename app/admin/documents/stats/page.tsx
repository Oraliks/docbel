import { redirect } from "next/navigation";

/// Page fusionnée avec /admin/documents/analytics. Redirection permanente.
export default function DocumentStatsRedirect() {
  redirect("/admin/documents/analytics?tab=stats");
}
