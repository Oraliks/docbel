import { prisma, withDbRetry } from "@/lib/prisma"
import type { ComptesTabCounts } from "@/components/admin/comptes-tabs"

/// Compteurs du hub « Comptes & accès », partagés par les 4 pages pour un
/// badge stable d'un onglet à l'autre. Comptes d'utilisateurs par rôle (cheap :
/// 3 count()), pas de chargement de listes.
export async function getComptesTabCounts(): Promise<ComptesTabCounts> {
  const [users, partenaires, employeurs] = await Promise.all([
    withDbRetry(() => prisma.user.count()),
    withDbRetry(() => prisma.user.count({ where: { role: "partner" } })),
    withDbRetry(() => prisma.user.count({ where: { role: "employer" } })),
  ])
  return { users, partenaires, employeurs }
}
