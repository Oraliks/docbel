import { requireAdminAuth } from '@/lib/auth-check'
import { apiOk } from '@/lib/api/response'
import { boundedBody, checkOrigin, rateFailure } from '@/lib/baremes-autonome/http'
import { decisionSchema } from '@/lib/baremes-autonome/request-schema'
import { saveDecision } from '@/lib/baremes-autonome/decision-service'
import { RateError } from '@/lib/baremes-autonome/service'
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  try {
    checkOrigin(request)
    const parsed = decisionSchema.safeParse(
      JSON.parse(new TextDecoder().decode(await boundedBody(request, 2 * 1024 * 1024))),
    )
    if (!parsed.success) throw new RateError('INVALID_DECISION', 400)
    return apiOk(await saveDecision((await context.params).id, parsed.data, auth.user.id), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return rateFailure(error)
  }
}
