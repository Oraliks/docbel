import { ensureWriteAllowed } from "@/lib/admin/readonly-guard"
import { requireAdminAuth } from "@/lib/auth-check"
import { apiError } from "@/lib/api/response"
import { buildPrivacyInventory } from "@/lib/privacy/inventory"
import {
  deletionConfirmationBodySchema,
  enforcePrivacyRateLimit,
  invalidPrivacyRequest,
  PRIVACY_RESPONSE_HEADERS,
  privacyUserIdSchema,
  withPrivacyHeaders,
} from "@/lib/privacy/api"

/**
 * Point de confirmation volontairement non exécutable. Il verrouille déjà le
 * contrat de confirmation (sujet + empreinte exacte + gardes admin) sans rendre
 * possible un effacement avant approbation de la matrice de conservation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return withPrivacyHeaders(auth.error)

  const writeBlock = await ensureWriteAllowed()
  if (writeBlock) return withPrivacyHeaders(writeBlock)

  const limited = await enforcePrivacyRateLimit(auth.user.id, "delete", 5)
  if (limited) return limited

  const userId = privacyUserIdSchema.safeParse((await params).userId)
  const body = deletionConfirmationBodySchema.safeParse(await request.json().catch(() => null))
  if (!userId.success || !body.success || body.data.confirmUserId !== userId.data) {
    return invalidPrivacyRequest({
      params: userId.success ? undefined : userId.error.flatten(),
      body: body.success ? undefined : body.error.flatten(),
      confirmationMatches: userId.success && body.success ? body.data.confirmUserId === userId.data : undefined,
    })
  }

  const inventory = await buildPrivacyInventory(userId.data)
  if (!inventory) {
    return apiError(404, "Compte introuvable.", {
      code: "privacy_subject_not_found",
      headers: PRIVACY_RESPONSE_HEADERS,
    })
  }
  if (body.data.inventoryHash !== inventory.inventoryHash) {
    return apiError(409, "L'inventaire a changé ; l'effacement est refusé.", {
      code: "privacy_inventory_changed",
      details: { currentInventoryHash: inventory.inventoryHash },
      headers: PRIVACY_RESPONSE_HEADERS,
    })
  }

  return apiError(409, "La matrice de conservation n'est pas approuvée ; aucun effacement n'a été exécuté.", {
    code: "retention_matrix_unapproved",
    details: { inventoryHash: inventory.inventoryHash },
    headers: PRIVACY_RESPONSE_HEADERS,
  })
}
