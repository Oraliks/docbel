import { redirect } from "next/navigation";

/// Page fusionnée dans /admin/documents/settings (tab email).
export default function EmailSettingsRedirect() {
  redirect("/admin/documents/settings?tab=email");
}
