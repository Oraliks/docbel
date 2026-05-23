import { redirect } from "next/navigation";

/// Page fusionnée dans /admin/chomage/lookup (tab Import en lot).
export default function LookupImportBatchRedirect() {
  redirect("/admin/chomage/lookup?tab=import");
}
