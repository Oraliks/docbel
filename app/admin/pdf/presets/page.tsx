import { getTranslations } from "next-intl/server";
import { PdfPresetsManager } from "@/components/admin/pdf-forms/presets-manager";

export const dynamic = "force-dynamic";

export default async function PdfPresetsPage() {
  const t = await getTranslations("admin.pdf");
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t("presetsTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("presetsIntro")}</p>
      </div>
      <PdfPresetsManager />
    </div>
  );
}
