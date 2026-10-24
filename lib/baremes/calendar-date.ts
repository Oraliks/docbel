/**
 * Jour civil utilisé par les consultations de barèmes et la situation familiale.
 * La locale technique ne règle que la sérialisation ISO ; le fuseau est explicite.
 */
export function brusselsCalendarDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** Le Date retourné représente un jour civil (UTC minuit), pas une heure à Bruxelles. */
export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1) return null
  const result = new Date(`${value}T00:00:00.000Z`)
  return result.getUTCFullYear() === year
    && result.getUTCMonth() === month - 1
    && result.getUTCDate() === day
    ? result
    : null
}

export type BaremePublicationDateStatus = 'missing' | 'future' | 'applicable'

/** Règle unique partagée par la publication serveur et son état admin. */
export function baremePublicationDateStatus(validFrom: Date | null, now = new Date()): BaremePublicationDateStatus {
  if (!validFrom) return 'missing'
  return validFrom > parseCalendarDate(brusselsCalendarDay(now))! ? 'future' : 'applicable'
}
