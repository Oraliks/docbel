import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth-check'
import { apiOk } from '@/lib/api/response'
import { publishVersion, RateError } from '@/lib/baremes-autonome/service'
import { boundedBody, checkOrigin, rateFailure } from '@/lib/baremes-autonome/http'

const snapshotSchema = z.object({ candidateId: z.string().min(1).max(100), candidateRevision: z.string().length(64), referenceId: z.string().max(100).nullable(), referenceRevision: z.string().length(64).nullable(), generation: z.number().int().nonnegative(), digest: z.string().length(64) }).strict()
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
