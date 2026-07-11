import { prisma } from "@/lib/prisma";
import {
  getSiteSettingsUncached,
  getSiteSettingsMeta,
} from "@/lib/site-settings.server";
import { ParametresClient } from "./parametres-client";

export const dynamic = "force-dynamic";

/**
 * Paramètres globaux du site (identité, SEO, maintenance, annonces).
 * L'auth admin est déjà garantie par `app/admin/layout.tsx`.
 */
export default async function ParametresPage() {
  const [settings, meta] = await Promise.all([
    getSiteSettingsUncached(),
    getSiteSettingsMeta(),
  ]);

  let updatedByName: string | null = null;
  if (meta.updatedBy) {
    const u = await prisma.user
      .findUnique({ where: { id: meta.updatedBy }, select: { name: true } })
      .catch(() => null);
    updatedByName = u?.name ?? null;
  }

  return (
    <ParametresClient
      initialSettings={settings}
      updatedAt={meta.updatedAt ? meta.updatedAt.toISOString() : null}
      updatedByName={updatedByName}
    />
  );
}
