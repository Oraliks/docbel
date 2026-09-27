import { requireAdminAuth } from "@/lib/auth-check"
import { apiError, apiOk } from "@/lib/api/response"
import { buildPrivacyInventory } from "@/lib/privacy/inventory"
import {
  enforcePrivacyRateLimit,
  invalidPrivacyRequest,
  PRIVACY_RESPONSE_HEADERS,
  privacyUserIdSchema,
  withPrivacyHeaders,
} from "@/lib/privacy/api"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return withPrivacyHeaders(auth.error)

  const limited = await enforcePrivacyRateLimit(auth.user.id, "inventory", 30)
  if (limited) return limited

  const parsed = privacyUserIdSchema.safeParse((await params).userId)
  if (!parsed.success) return invalidPrivacyRequest(parsed.error.flatten())

  const inventory = await buildPrivacyInventory(parsed.data)
  if (!inventory) {
    return apiError(404, "Compte introuvable.", {
      code: "privacy_subject_not_found",
      headers: PRIVACY_RESPONSE_HEADERS,
    })
  }
  return apiOk(inventory, { headers: PRIVACY_RESPONSE_HEADERS })
}
