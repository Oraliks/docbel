import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { brusselsCalendarDay, parseCalendarDate } from '../calendar-date'

const mocks = vi.hoisted(() => ({ active: vi.fn(), rateLimit: vi.fn() }))
vi.mock('@/lib/baremes/getActiveBaremeData', () => ({ getActiveBaremeData: mocks.active }))
vi.mock('@/lib/utils/rate-limit', () => ({ checkRateLimit: mocks.rateLimit, getClientIp: () => '198.51.100.1' }))

import { GET } from '@/app/api/baremes/c1-thresholds/route'
const request = (query = '') => new NextRequest(`https://docbel.example.test/api/baremes/c1-thresholds${query}`)

describe('GET /api/baremes/c1-thresholds', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T21:30:00.000Z'))
    vi.resetAllMocks()
    mocks.rateLimit.mockResolvedValue({ ok: true, resetAt: Date.now() + 60_000 })
    mocks.active.mockResolvedValue(null)
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

  it.each([
    ['2026-01-15T23:30:00Z', '2026-01-16'],
    ['2026-07-15T22:30:00Z', '2026-07-16'],
    ['2026-03-28T23:30:00Z', '2026-03-29'],
    ['2026-10-24T22:30:00Z', '2026-10-25'],
    ['2026-10-21T05:30:00Z', '2026-10-21'],
  ])('accepte aujourd’hui Bruxelles à %s sous un runtime UTC', async (instant, day) => {
    vi.stubEnv('TZ', 'UTC')
    vi.setSystemTime(new Date(instant))
    const response = await GET(request(`?asOf=${day}`))
    expect(response.status).toBe(200)
    expect(mocks.active).toHaveBeenCalledWith({ asOf: day })
    expect(await response.json()).toMatchObject({ asOf: day, source: null })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('utilise le même jour civil quand asOf est absent', async () => {
    vi.setSystemTime(new Date('2026-07-15T22:30:00Z'))
    const response = await GET(request())
    expect(mocks.active).toHaveBeenCalledWith({ asOf: '2026-07-16' })
    expect((await response.json()).asOf).toBe('2026-07-16')
  })

  it.each([
    '?asOf=2026-10-22',
    '?asOf=2026-02-30',
    '?asOf=2025-02-29',
    '?asOf=2026-13-01',
    '?asOf=2026-00-01',
    '?asOf=0000-01-01',
    '?asOf=',
    '?asOf=21%2F10%2F2026',
    '?asOf=2026-10-21T00%3A00%3A00Z',
    '?asOf=2026-10-21&asOf=2026-10-21',
    '?asOf=2026-10-21&asOf=2026-10-20',
  ])('rejette un paramètre invalide, futur ou doublonné : %s', async (query) => {
    const response = await GET(request(query))
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toContain('charset=utf-8')
    expect(mocks.active).not.toHaveBeenCalled()
  })

  it('accepte le 29 février réel et un jour historique, sans repli courant', async () => {
    const response = await GET(request('?asOf=2024-02-29'))
    expect(response.status).toBe(200)
    expect(mocks.active).toHaveBeenCalledExactlyOnceWith({ asOf: '2024-02-29' })
    const body = await response.json()
    expect(body.source).toBeNull()
    expect(body.spouseProfessionalMonthly).toBeNull()
  })

  it('applique le limiteur partagé avant lecture, avec Retry-After et sans paramètres dans la clé', async () => {
    mocks.rateLimit.mockResolvedValue({ ok: false, resetAt: Date.now() + 60_000 })
    const response = await GET(request('?asOf=2026-10-21&private=do-not-copy'))
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(response.headers.get('x-ratelimit-limit')).toBe('60')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.active).not.toHaveBeenCalled()
    expect(mocks.rateLimit).toHaveBeenCalledExactlyOnceWith('baremes-c1-thresholds:198.51.100.1', { windowMs: 60_000, max: 60 })
    expect(await response.text()).not.toContain('do-not-copy')
  })

  it('répond sans cache ni détail interne quand la lecture est indisponible', async () => {
    mocks.active.mockRejectedValueOnce(new Error('private database fixture'))
    const response = await GET(request('?asOf=2026-10-21'))
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await response.json()
    expect(body.code).toBe('bareme_unavailable')
    expect(JSON.stringify(body)).not.toContain('private database fixture')
  })
  it('expose la date examinée et la provenance du fichier réellement consulté', async () => {
    mocks.active.mockResolvedValue({
      fileId: 'fixture-v1', fileName: 'fixture-v1.xlsx', validFrom: new Date('2026-01-01'),
      publishedAt: new Date('2026-02-01T12:00:00Z'), multiplicateur: null,
      amountsByCategory: {}, allAmounts: [],
    })
    const response = await GET(request('?asOf=2026-01-15&private=do-not-copy'))
    const body = await response.json()
    expect(body).toMatchObject({
      asOf: '2026-01-15',
      source: { fileId: 'fixture-v1', validFrom: '2026-01-01T00:00:00.000Z', publishedAt: '2026-02-01T12:00:00.000Z' },
      spouseProfessionalMonthly: null,
    })
    expect(JSON.stringify(body)).not.toContain('do-not-copy')
  })
})

describe('calendar-date', () => {
  it('ne dépend pas du fuseau local et conserve les années 0001–0099', () => {
    expect(brusselsCalendarDay(new Date('2026-07-15T22:30:00Z'))).toBe('2026-07-16')
    expect(parseCalendarDate('0099-01-01')?.toISOString()).toBe('0099-01-01T00:00:00.000Z')
    expect(parseCalendarDate('2026-02-30')).toBeNull()
  })
})
