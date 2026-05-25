import { headers } from "next/headers";
import { cache } from "react";
import { auth, type AuthSession } from "@/lib/auth";

/**
 * Lit la session côté serveur (Server Components, layouts, API routes).
 *
 * cookieCache est activé sur Better Auth (lib/auth.ts) : cet appel ne
 * touche pas la DB tant que le cookie session-cache est valide (~5 min),
 * donc c'est suffisamment rapide pour le root layout sans bloquer la
 * première peinture.
 *
 * `cache()` mémorise le résultat pour la durée de la requête : si plusieurs
 * server components du même render appellent ce helper, on ne refait pas
 * le lookup à chaque fois.
 */
export const getServerAuthSession = cache(async (): Promise<AuthSession> => {
  return auth.api.getSession({ headers: await headers() });
});
