import { getTranslations } from "next-intl/server";
import { loadLastScan } from "@/lib/media/dead-image-scan";
import { DeadImagesClient } from "@/components/admin/dead-images-client";

export const dynamic = "force-dynamic";

/**
 * Admin → Médias : scan des images cassées (« link-rot »).
 * Parcourt tous les champs URL-image de la base (actualités, organismes,
 * formations, avatars…) et liste celles dont l'URL ne répond plus.
 * Dernier résultat persisté dans AppSetting (pas de table dédiée).
 */
export default async function MediasAdminPage() {
  const t = await getTranslations("admin.medias");
  const initial = await loadLastScan().catch(() => null);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          {t("descriptionBefore")}{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            scripts/scan-dead-images.ts
          </code>{" "}
          {t("descriptionAfter")}
        </p>
      </div>
      <DeadImagesClient initial={initial} />
    </div>
  );
}
