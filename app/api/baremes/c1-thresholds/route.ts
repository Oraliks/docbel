import { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError, apiOk } from '@/lib/api/response'
import { tooManyRequests } from '@/lib/api/rate-limit-response'
import { getActiveBaremeData } from '@/lib/baremes/getActiveBaremeData'
import { getC1BaremeThresholds, formatC1BaremeSource } from '@/lib/baremes/c1-thresholds'
import { brusselsCalendarDay, parseCalendarDate } from '@/lib/baremes/calendar-date'
import { checkRateLimit, getClientIp } from '@/lib/utils/rate-limit'

const asOfSchema = z.array(z.string().refine((value) => parseCalendarDate(value) !== null)).max(1)
const cacheHeaders = { 'Cache-Control': 'no-store' }

/**
 * Seuils familiaux issus des publications DocBel connues au moment de la lecture.
 * `asOf` est un jour civil Europe/Brussels (YYYY-MM-DD), pas un instant.
 */
export async function GET(request: NextRequest) {
  const rateLimit = await checkRateLimit(`baremes-c1-thresholds:${getClientIp(request)}`, {
    windowMs: 60_000,
    max: 60,
  })
  if (!rateLimit.ok) {
    const response = tooManyRequests({ limit: 60, resetAt: rateLimit.resetAt })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  const parsed = asOfSchema.safeParse(new URL(request.url).searchParams.getAll('asOf'))
  if (!parsed.success) {
    return apiError(400, 'Date de consultation invalide', { code: 'invalid_as_of', headers: cacheHeaders })
  }
  const today = brusselsCalendarDay()
  const asOf = parsed.data[0] ?? today
  if (asOf > today) {
    return apiError(400, 'La date de consultation ne peut pas être future', { code: 'future_as_of', headers: cacheHeaders })
  }

  try {
    const data = await getActiveBaremeData({ asOf })
    const thresholds = getC1BaremeThresholds(data)
    return apiOk(
      { ...thresholds, asOf, sourceLabel: formatC1BaremeSource(thresholds) },
      { headers: cacheHeaders },
    )
  } catch {
    return apiError(503, 'Les barèmes sont temporairement indisponibles', {
      code: 'bareme_unavailable',
      headers: cacheHeaders,
    })
  }
}
