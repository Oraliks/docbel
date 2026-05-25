import { revalidatePath } from "next/cache";
import { memoCacheInvalidatePrefix } from "@/lib/memo-cache";

/** Préfixe pour les listes admin (/api/admin/bureaux?…). */
export const BUREAUX_LIST_CACHE_PREFIX = "admin:bureaux:list:";

/** Préfixe pour le résolveur public (/api/bureaux/resolve?cp=…). */
export const BUREAUX_RESOLVE_CACHE_PREFIX = "bureaus:resolve:";

/**
 * Invalide tous les caches liés aux bureaux après un write.
 * À appeler dans tout POST/PUT/DELETE/PATCH qui modifie la table Bureau
 * ou les relations qui apparaissent dans la liste admin ou le résolveur.
 */
export function invalidateBureauCaches(): void {
  revalidatePath("/api/bureaux", "layout");
  revalidatePath("/api/bureaux/resolve", "layout");
  memoCacheInvalidatePrefix(BUREAUX_LIST_CACHE_PREFIX);
  memoCacheInvalidatePrefix(BUREAUX_RESOLVE_CACHE_PREFIX);
}
