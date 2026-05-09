import { redirect } from "next/navigation";

/// Page fusionnée dans /admin/documents/settings (tab rgpd).
export default function RgpdSettingsRedirect() {
  redirect("/admin/documents/settings?tab=rgpd");
}
