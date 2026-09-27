import { requireAdminAuth } from "@/lib/auth-check"
import { apiError, apiOk } from "@/lib/api/response"
import { buildDeletionPreview, buildPrivacyInventory } from "@/lib/privacy/inventory"
import {
  deletionPreviewBodySchema,
  enforcePrivacyRateLimit,
  invalidPrivacyRequest,
  PRIVACY_RESPONSE_HEADERS,
  privacyUserIdSchema,
  withPrivacyHeaders,
} from "@/lib/privacy/api"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return withPrivacyHeaders(auth.error)

  const limited = await enforcePrivacyRateLimit(auth.user.id, "deletion-preview", 20)
  if (limited) return limited

  const userId = privacyUserIdSchema.safeParse((await params).userId)
  const body = deletionPreviewBodySchema.safeParse(await request.json().catch(() => null))
  if (!userId.success || !body.success) {
    return invalidPrivacyRequest({
      params: userId.success ? undefined : userId.error.flatten(),
      body: body.success ? undefined : body.error.flatten(),
    })
  }

  const inventory = await buildPrivacyInventory(userId.data)
  if (!inventory) {
    return apiError(404, "Compte introuvable.", {
      code: "privacy_subject_not_found",
      headers: PRIVACY_RESPONSE_HEADERS,
    })
  }
  if (body.data.expectedInventoryHash && body.data.expectedInventoryHash !== inventory.inventoryHash) {
    return apiError(409, "L'inventaire a changé ; générez un nouvel aperçu.", {
      code: "privacy_inventory_changed",
      details: { currentInventoryHash: inventory.inventoryHash },
      headers: PRIVACY_RESPONSE_HEADERS,
    })
  }

  return apiOk(buildDeletionPreview(inventory), { headers: PRIVACY_RESPONSE_HEADERS })
}
