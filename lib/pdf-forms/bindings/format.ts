// Formatage partagé pour le stamping des widgets AcroForm.
//
// Extrait de `filler.ts` pour que le moteur de bindings (module PUR, aucun
// import fs/prisma) puisse l'utiliser sans créer d'import croisé.
// `filler.ts` continue de l'importer d'ici — c'est la même fonction, plus une
// seule source de vérité.

/// Reformate une date ISO (YYYY-MM-DD) vers le format FR (DD/MM/YYYY) utilisé
/// sur les formulaires officiels ONEM. Toute autre valeur est renvoyée telle
/// quelle (idempotent : sûr si l'utilisateur a déjà saisi en format FR, ou
/// si la valeur est vide).
export function formatDateFR(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}
