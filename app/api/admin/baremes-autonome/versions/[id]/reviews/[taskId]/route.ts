import { requireAdminAuth } from '@/lib/auth-check'
import { apiOk } from '@/lib/api/response'
import { getReviewDetails } from '@/lib/baremes-autonome/service'
import { rateFailure } from '@/lib/baremes-autonome/http'
export async function GET(_request: Request, context: { params: Promise<{ id: string; taskId: string }> }) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  try {
    const { id, taskId } = await context.params
    return apiOk(await getReviewDetails(id, taskId), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return rateFailure(error)
  }
}
