import "server-only";
import { prisma } from "@/lib/prisma";
import { memoCache, memoCacheInvalidate } from "@/lib/memo-cache";
import { logActivity } from "@/lib/activity-logger";
import {
  SITE_SETTINGS_KEY,
  SITE_SETTINGS_CACHE_KEY,
  SITE_SETTINGS_DEFAULTS,
  siteSettingsSchema,
  parseSiteSettings,
  deepMergeSettings,
  type SiteSettings,
} from "@/lib/site-settings";

/**
 * Lectures / écritures DB des paramètres globaux (cf. `lib/site-settings.ts`
 * pour le schéma pur). Cache via `memo-cache` (convention du repo), invalidé
 * à chaque écriture. Résilient aux cold-starts Neon (P1001) → retombe sur les
 * défauts, jamais de crash sur une valeur lue à chaque page vue.
 */

/** TTL du cache in-process : les réglages changent rarement. */
const SITE_SETTINGS_TTL_MS = 60_000;

/** Lecture directe (non cachée) — pour l'admin qui doit voir l'état frais. */
export async function getSiteSettingsUncached(): Promise<SiteSettings> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SITE_SETTINGS_KEY },
    });
    if (!row?.value) return SITE_SETTINGS_DEFAULTS;
    return parseSiteSettings(JSON.parse(row.value));
  } catch {
    // Cold-start Neon ou JSON illisible → défauts sûrs, jamais de crash.
    return SITE_SETTINGS_DEFAULTS;
  }
}

/**
 * Lecture cachée (60 s) — pour le front (metadata, header, footer, gate
 * maintenance, bannière). Le fetcher ne throw jamais (défauts en repli), donc
 * `memoCache` résout toujours.
 */
export function getSiteSettings(): Promise<SiteSettings> {
  return memoCache(
    SITE_SETTINGS_CACHE_KEY,
    SITE_SETTINGS_TTL_MS,
    getSiteSettingsUncached
  );
}

/** Métadonnées d'édition (qui / quand) pour l'affichage admin. */
export async function getSiteSettingsMeta(): Promise<{
  updatedAt: Date | null;
  updatedBy: string | null;
}> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SITE_SETTINGS_KEY },
      select: { updatedAt: true, updatedBy: true },
    });
    return { updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null };
  } catch {
    return { updatedAt: null, updatedBy: null };
  }
}

export type SetSiteSettingsResult =
  | { ok: true; settings: SiteSettings }
  | {
      ok: false;
      issues: {
        formErrors: string[];
        fieldErrors: Record<string, string[] | undefined>;
      };
    };

/**
 * Écrit un patch partiel : merge sur l'existant, valide STRICTEMENT (Zod),
 * persiste, journalise, invalide le cache.
 *
 * ⚠️ Contrairement à la lecture (`parseSiteSettings`, résiliente), l'écriture
 * REJETTE un patch invalide (`{ ok: false, issues }`) au lieu de retomber sur
 * les défauts — sinon un patch fautif écraserait toute la config.
 */
export async function setSiteSettings(
  patch: unknown,
  updatedBy: string | null = null
): Promise<SetSiteSettingsResult> {
  const current = await getSiteSettingsUncached();
  const parsed = siteSettingsSchema.safeParse(deepMergeSettings(current, patch));
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.flatten() };
  }
  const next = parsed.data;
  await prisma.appSetting.upsert({
    where: { key: SITE_SETTINGS_KEY },
    create: { key: SITE_SETTINGS_KEY, value: JSON.stringify(next), updatedBy },
    update: { value: JSON.stringify(next), updatedBy },
  });
  memoCacheInvalidate(SITE_SETTINGS_CACHE_KEY);
  if (updatedBy) {
    await logActivity(updatedBy, "updated", "setting", "site_settings");
  }
  return { ok: true, settings: next };
}
