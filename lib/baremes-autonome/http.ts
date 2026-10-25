import { apiError } from '@/lib/api/response'
import { RateError } from './service'

export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) throw new RateError('FORBIDDEN_ORIGIN', 403)
}
export async function boundedBody(request: Request, limit: number): Promise<Uint8Array> {
  if (Number(request.headers.get('content-length')) > limit) throw new RateError('INVALID_FILE', 413)
  const reader = request.body?.getReader()
  if (!reader) throw new RateError('INVALID_FILE', 400)
  const parts: Uint8Array[] = []
  let size = 0
  while (true) {
    const result = await reader.read()
    if (result.done) break
    size += result.value.length
    if (size > limit) { await reader.cancel(); throw new RateError('INVALID_FILE', 413) }
    parts.push(result.value)
  }
  return new Uint8Array(Buffer.concat(parts))
}
export function rateFailure(error: unknown) {
  if (error instanceof RateError) return apiError(error.status, error.code, { code: error.code })
  return apiError(500, 'SERVICE_UNAVAILABLE', { code: 'SERVICE_UNAVAILABLE' })
}
