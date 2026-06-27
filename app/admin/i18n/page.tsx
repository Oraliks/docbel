import { redirect } from "next/navigation";
import { requireAdminAuth } from "@/lib/auth-check";

export const dynamic = "force-dynamic";

export default async function I18nAdminPage() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) redirect("/login");
  redirect("/admin/i18n/nl");
}
