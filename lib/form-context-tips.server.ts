import "server-only";
import { prisma } from "@/lib/prisma";
import { memoCache, memoCacheInvalidate } from "@/lib/memo-cache";
import { logActivity } from "@/lib/activity-logger";
import {
  FORM_CONTEXT_TIPS_KEY,
  FORM_CONTEXT_TIPS_CACHE_KEY,
  FORM_CONTEXT_TIPS_DEFAULTS,
  formContextTipsSchema,
  parseFormContextTips,
  mergeFormContextTips,
  type FormContextTips,
  type TipEntry,
} from "@/lib/form-context-tips";

/**
 * Lectures / écritures DB des infos importantes contextuelles (cf.
 * `lib/form-context-tips.ts` pour le schéma pur). Cache `memo-cache` invalidé
 * à l'écriture. Résilient aux cold-starts Neon (P1001) → retombe sur les
 * défauts, jamais de crash sur une valeur lue à chaque page vue.
 */

const FORM_CONTEXT_TIPS_TTL_MS = 60_000;

/** Lecture directe (non cachée) — pour l'admin qui doit voir l'état frais. */
export async function getFormContextTipsDictUncached(): Promise<FormContextTips> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: FORM_CONTEXT_TIPS_KEY },
    });
    if (!row?.value) return FORM_CONTEXT_TIPS_DEFAULTS;
    return parseFormContextTips(JSON.parse(row.value));
  } catch {
    return FORM_CONTEXT_TIPS_DEFAULTS;
  }
}

/** Dictionnaire complet mergé (DB sur défauts), caché — pour le front. */
export function getFormContextTipsDict(): Promise<FormContextTips> {
  return memoCache(
    FORM_CONTEXT_TIPS_CACHE_KEY,
    FORM_CONTEXT_TIPS_TTL_MS,
    getFormContextTipsDictUncached,
  );
}

/** Entrées d'un formulaire (défauts si absent). Jamais de throw. */
export async function getFormContextTips(formSlug: string): Promise<TipEntry[]> {
  const dict = await getFormContextTipsDict();
  return dict[formSlug]?.entries ?? [];
}

/** Métadonnées d'édition (qui / quand) pour l'affichage admin. */
export async function getFormContextTipsMeta(): Promise<{
  updatedAt: Date | null;
  updatedBy: string | null;
}> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: FORM_CONTEXT_TIPS_KEY },
      select: { updatedAt: true, updatedBy: true },
    });
    return { updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null };
  } catch {
    return { updatedAt: null, updatedBy: null };
  }
}

export type SetFormContextTipsResult =
  | { ok: true; tips: FormContextTips }
  | {
      ok: false;
      issues: { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> };
    };

/**
 * Écrit le dictionnaire : fusionne le patch de l'éditeur sur l'état FRAÎCHEMENT
 * relu (comme `setSiteSettings`) — une sauvegarde à partir d'un état obsolète
 * n'efface plus un formulaire ajouté entre-temps par un autre admin (les
 * `entries` d'un formulaire présent dans le patch sont remplacées ; un
 * formulaire absent du patch est préservé). Valide STRICTEMENT (Zod), persiste,
 * journalise, invalide le cache. Contrairement à la lecture (résiliente),
 * l'écriture REJETTE une valeur invalide au lieu de retomber sur les défauts.
 */
export async function setFormContextTips(
  next: unknown,
  updatedBy: string | null = null,
): Promise<SetFormContextTipsResult> {
  const current = await getFormContextTipsDictUncached();
  const parsed = formContextTipsSchema.safeParse(mergeFormContextTips(current, next));
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.flatten() };
  }
  await prisma.appSetting.upsert({
    where: { key: FORM_CONTEXT_TIPS_KEY },
    create: {
      key: FORM_CONTEXT_TIPS_KEY,
      value: JSON.stringify(parsed.data),
      updatedBy,
    },
    update: { value: JSON.stringify(parsed.data), updatedBy },
  });
  memoCacheInvalidate(FORM_CONTEXT_TIPS_CACHE_KEY);
  if (updatedBy) {
    await logActivity(updatedBy, "updated", "setting", FORM_CONTEXT_TIPS_KEY);
  }
  return { ok: true, tips: parsed.data };
}
