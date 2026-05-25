/**
 * Micro-cache mémoire in-process avec TTL et déduplication des fetches en vol.
 *
 * Utilisation typique : agrégations DB lourdes pingées en boucle par le
 * dashboard de monitoring. Évite de refaire la même query 100x/min sur
 * des données qui changent lentement.
 *
 * Notes Vercel serverless :
 *  - Le cache vit le temps de l'instance Lambda. Une nouvelle instance =
 *    cache vide (cold start). C'est OK : c'est un cache opportuniste,
 *    pas une source de vérité.
 *  - Plusieurs instances en parallèle = plusieurs caches indépendants.
 *    Pas de cohérence garantie, mais on s'en fout pour du monitoring.
 *
 * Si une autre requête arrive pendant qu'un fetch est déjà en cours pour
 * la même clé, on lui retourne la même promesse (pas de stampede).
 */

interface Entry<T> {
  /** Valeur résolue. null tant que le 1er fetch n'a pas abouti. */
  value: T | null;
  /** Promesse en vol — partagée si plusieurs callers tombent en même temps. */
  pending: Promise<T> | null;
  /** Date.now() de la dernière résolution réussie. */
  resolvedAt: number;
}

const store = new Map<string, Entry<unknown>>();

export async function memoCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as Entry<T> | undefined;

  if (existing) {
    // Fresh hit
    if (existing.value !== null && now - existing.resolvedAt < ttlMs) {
      return existing.value;
    }
    // Fetch déjà en cours : on s'y abonne au lieu d'en lancer un autre
    if (existing.pending) return existing.pending;
  }

  const pending = fetcher()
    .then((v) => {
      store.set(key, { value: v, pending: null, resolvedAt: Date.now() });
      return v;
    })
    .catch((err) => {
      // En cas d'erreur, on garde la valeur précédente si on en a une.
      // pending null pour permettre un retry au prochain appel.
      const prev = store.get(key) as Entry<T> | undefined;
      store.set(key, {
        value: prev?.value ?? null,
        pending: null,
        resolvedAt: prev?.resolvedAt ?? 0,
      });
      throw err;
    });

  store.set(key, {
    value: existing?.value ?? null,
    pending,
    resolvedAt: existing?.resolvedAt ?? 0,
  });
  return pending;
}

/** Invalide manuellement une clé (utile après un write côté admin). */
export function memoCacheInvalidate(key: string): void {
  store.delete(key);
}

/** Invalide toutes les clés qui commencent par un préfixe. */
export function memoCacheInvalidatePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
