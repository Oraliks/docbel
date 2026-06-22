import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChartColumn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfFormsList } from "@/components/admin/pdf-forms/forms-list";

export const dynamic = "force-dynamic";

export default async function PdfFormsPage() {
  const t = await getTranslations("admin.pdf");
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("formsTitle")}</h1>
          <p className="text-muted-foreground mt-2">{t("formsIntro")}</p>
        </div>
        <Button
          render={<Link href="/admin/pdf/analytics" prefetch={false} />}
          variant="outline"
          size="sm"
        >
          <ChartColumn className="size-4" />
          {t("analytics")}
        </Button>
      </div>
      <PdfFormsList />
    </div>
  );
}
