import { redirect } from "next/navigation";

/// Page fusionnée dans /admin/documents/config (tab Presets validation).
export default function PresetsRedirect() {
  redirect("/admin/documents/config?tab=presets");
}
