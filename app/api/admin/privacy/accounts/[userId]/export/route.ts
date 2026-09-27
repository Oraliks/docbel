import { requireAdminAuth } from "@/lib/auth-check"
import { apiError, apiOk } from "@/lib/api/response"
import { exportPrivacyDataset } from "@/lib/privacy/export"
import { buildPrivacyInventory } from "@/lib/privacy/inventory"
import {
  enforcePrivacyRateLimit,
  invalidPrivacyRequest,
  PRIVACY_RESPONSE_HEADERS,
  privacyExportQuerySchema,
  privacyUserIdSchema,
  withPrivacyHeaders,
} from "@/lib/privacy/api"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return withPrivacyHeaders(auth.error)

  const limited = await enforcePrivacyRateLimit(auth.user.id, "export", 20)
  if (limited) return limited

  const userId = privacyUserIdSchema.safeParse((await params).userId)
  const url = new URL(request.url)
  const query = privacyExportQuerySchema.safeParse({
    dataset: url.searchParams.get("dataset"),
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  })
  if (!userId.success || !query.success) {
    return invalidPrivacyRequest({
      params: userId.success ? undefined : userId.error.flatten(),
      query: query.success ? undefined : query.error.flatten(),
    })
  }

  const inventory = await buildPrivacyInventory(userId.data)
  if (!inventory) {
    return apiError(404, "Compte introuvable.", {
      code: "privacy_subject_not_found",
      headers: PRIVACY_RESPONSE_HEADERS,
    })
  }

  const page = await exportPrivacyDataset({
    userId: userId.data,
    dataset: query.data.dataset,
    cursor: query.data.cursor,
    limit: query.data.limit,
  })
  return apiOk(
    {
      version: inventory.version,
      subject: inventory.subject,
      inventoryHash: inventory.inventoryHash,
      ...page,
    },
    {
      headers: {
        ...PRIVACY_RESPONSE_HEADERS,
        "Content-Disposition": `attachment; filename="docbel-privacy-${userId.data}-${query.data.dataset}.json"`,
      },
    },
  )
}
