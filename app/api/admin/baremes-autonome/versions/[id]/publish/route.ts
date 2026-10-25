import { snapshotSchema } from '@/lib/baremes-autonome/request-schema'
import { requireAdminAuth } from '@/lib/auth-check'
import { apiOk } from '@/lib/api/response'
import { publishVersion, RateError } from '@/lib/baremes-autonome/service'
import { boundedBody, checkOrigin, rateFailure } from '@/lib/baremes-autonome/http'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  try {
    checkOrigin(request)
    const result = snapshotSchema.safeParse(JSON.parse(new TextDecoder().decode(await boundedBody(request, 4096))))
    if (!result.success) throw new RateError('INVALID_SNAPSHOT', 400)
    return apiOk(await publishVersion((await context.params).id, result.data, auth.user.id))
  } catch (error) { return rateFailure(error) }
}
