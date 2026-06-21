/// Verrou optimiste (optimistic concurrency) pour l'édition d'un PdfForm.
///
/// On utilise `updatedAt` comme jeton de concurrence (et non `version`, qui est
/// une version de CONTENU incrémentée seulement quand `fields` change). Le client
/// renvoie au PATCH le `updatedAt` du form tel qu'il l'a chargé ; si la ligne en
/// base a un `updatedAt` différent, c'est qu'une autre session a écrit entre-temps
/// → conflit, on refuse l'écriture (HTTP 409) au lieu d'écraser silencieusement.

/// Code machine renvoyé dans le corps d'une réponse 409 de conflit d'édition.
/// Le client s'en sert pour distinguer un vrai conflit d'un autre 409.
export const STALE_WRITE_CODE = "stale_write";

/// Détermine si une écriture est « périmée » (stale) par rapport à l'état courant.
///
/// - `expected` absent (`undefined`/`null`/`""`) → `false` : rétrocompat, le verrou
///   ne s'active que si le client participe (anciens clients non bloqués).
/// - `expected` égal au timestamp courant → `false` : le client est à jour.
/// - `expected` différent du timestamp courant → `true` : conflit.
/// - `expected` non parsable en date → `true` : on traite une précondition invalide
///   comme un conflit (fail-safe : on préfère refuser une écriture douteuse plutôt
///   que de risquer un écrasement silencieux sur jeton corrompu).
///
/// La comparaison se fait toujours par timestamp (`getTime()` en ms), jamais par
/// égalité de strings brutes ou d'objets Date.
export function isStaleWrite(expected: string | null | undefined, currentMs: number): boolean {
  if (expected === null || expected === undefined || expected === "") return false;
  const expectedMs = new Date(expected).getTime();
  if (Number.isNaN(expectedMs)) return true;
  return expectedMs !== currentMs;
}
