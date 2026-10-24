import { requireAdminAuth } from '@/lib/auth-check'
import { getSource } from '@/lib/baremes-autonome/service'
import { rateFailure } from '@/lib/baremes-autonome/http'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error
  try {
    const source = await getSource((await context.params).id)
    return new Response(new Uint8Array(source.original), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reference.xlsx"; filename*=UTF-8''${encodeURIComponent(source.name)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) { return rateFailure(error) }
}
