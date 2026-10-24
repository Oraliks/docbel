import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth-check'
import { apiOk } from '@/lib/api/response'
import { getWorkspace, RateError } from '@/lib/baremes-autonome/service'
import { rateFailure } from '@/lib/baremes-autonome/http'

const querySchema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), q: z.string().max(160).optional(), sheet: z.string().max(120).optional(), kind: z.enum(['modified', 'added', 'absent', 'unchanged']).optional() })
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  try {
    const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!query.success) throw new RateError('INVALID_QUERY', 400)
    return apiOk(await getWorkspace((await context.params).id, query.data), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return rateFailure(error) }
}
