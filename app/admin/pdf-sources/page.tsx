import { requireAdminAuth } from "@/lib/auth-check";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PdfSourceInspector } from "@/components/admin/pdf-sources/pdf-source-inspector";

export const dynamic = "force-dynamic";

/// Inspecteur des PDFs sources commités sous private/pdfs/.
/// Sert à voir, côte à côte, le PDF rendu et la liste de ses widgets
/// AcroForm — pour le mapping initial des dossiers (chômage temporaire,
/// complet, etc.).
export default async function PdfSourcesPage() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) redirect("/login");

  const t = await getTranslations("admin.pdf");

  return (
    <div className="flex h-[calc(100svh-2rem)] flex-col gap-3 p-4 lg:p-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("sourcesTitle")}</h1>
        <p className="text-xs text-muted-foreground">
          {t.rich("sourcesIntro", {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <PdfSourceInspector />
      </div>
    </div>
  );
}
