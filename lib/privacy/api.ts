import { z } from "zod"
import { apiError } from "@/lib/api/response"
import { rateLimitHeaders, tooManyRequests } from "@/lib/api/rate-limit-response"
import { checkRateLimit } from "@/lib/utils/rate-limit"
import { PRIVACY_EXPORT_DATASETS, PRIVACY_EXPORT_MAX_PAGE_SIZE } from "./export"

export const PRIVACY_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
}

export function withPrivacyHeaders<T extends Response>(response: T): T {
  response.headers.set("Content-Type", "application/json; charset=utf-8")
  for (const [key, value] of Object.entries(PRIVACY_RESPONSE_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

export const privacyUserIdSchema = z.string().trim().min(1).max(191).regex(/^[A-Za-z0-9_-]+$/)

export const privacyExportQuerySchema = z.object({
  dataset: z.enum(PRIVACY_EXPORT_DATASETS),
  cursor: z.string().trim().min(1).max(191).regex(/^[A-Za-z0-9_-]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(PRIVACY_EXPORT_MAX_PAGE_SIZE).default(50),
}).strict()

export const deletionPreviewBodySchema = z.object({
  expectedInventoryHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict()

export const deletionConfirmationBodySchema = z.object({
  confirmUserId: privacyUserIdSchema,
  inventoryHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()

export async function enforcePrivacyRateLimit(adminId: string, operation: string, max: number) {
  const result = await checkRateLimit(`admin-privacy:${operation}:${adminId}`, {
    windowMs: 60_000,
    max,
  })
  if (result.ok) return null
  if (result.unavailable) {
    return apiError(503, "Service temporairement indisponible.", {
      code: "rate_limit_unavailable",
      headers: {
        ...PRIVACY_RESPONSE_HEADERS,
        ...rateLimitHeaders({ limit: max, remaining: 0, resetAt: result.resetAt }),
      },
    })
  }
  const response = tooManyRequests({ limit: max, resetAt: result.resetAt })
  for (const [key, value] of Object.entries(PRIVACY_RESPONSE_HEADERS)) response.headers.set(key, value)
  return response
}

export function invalidPrivacyRequest(details?: unknown) {
  return apiError(400, "Requête de confidentialité invalide.", {
    code: "invalid_privacy_request",
    details,
    headers: PRIVACY_RESPONSE_HEADERS,
  })
}
