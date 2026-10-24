import { requireAdminAuth } from '@/lib/auth-check'
import { apiOk } from '@/lib/api/response'
import { importVersion, listVersions, RateError } from '@/lib/baremes-autonome/service'
import { boundedBody, checkOrigin, rateFailure } from '@/lib/baremes-autonome/http'

export const runtime = 'nodejs'
export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  try { return apiOk(await listVersions(), { headers: { 'Cache-Control': 'private, no-store' } }) }
  catch (error) { return rateFailure(error) }
}
export async function POST(request: Request) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  try {
    checkOrigin(request)
    const body = await boundedBody(request, 6 * 1024 * 1024)
    const form = await new Response(body as BodyInit, { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData()
    const file = form.get('file')
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.xlsx') || file.size > 5 * 1024 * 1024) throw new RateError('INVALID_FILE')
    return apiOk(await importVersion(Buffer.from(await file.arrayBuffer()), file.name, auth.user.id), { status: 201 })
  } catch (error) { return rateFailure(error) }
}
