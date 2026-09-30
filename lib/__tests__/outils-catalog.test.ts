import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), localize: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { tool: { findMany: mocks.findMany } } }))
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }))
vi.mock('@/lib/i18n/content', () => ({ localizeRecords: mocks.localize }))
vi.mock('@/lib/docbel-data', () => ({
  TOOLS_DATA: [
    { id: 1, slug: 'disabled', title: 'Disabled', type: 'calc_preavis' },
    { id: 2, slug: 'legacy', title: 'Legacy', type: 'calc_preavis' },
    { id: 3, slug: 'external', title: 'External', href: '/partenaire/lookup' },
  ],
  toolSlug: (title: string) => title.toLowerCase(),
}))

import { getPublicCatalog } from '@/lib/outils-catalog'

function row(id: string, active = true) {
  return {
    id, slug: id, name: id, description: 'Description', active,
    type: 'calc_preavis', icon: null, popular: false, timeMin: 5,
    order: 0, audience: 'citoyen', createdAt: new Date('2026-09-30'),
  }
}

describe('catalogue public', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.localize.mockImplementation(async (_: string, rows: ReturnType<typeof row>[]) =>
      rows.map((tool) => ({ ...tool, name: `NL ${tool.name}` })),
    )
  })

  it('utilise une lecture et ne traduit que les outils actifs sans ressusciter les désactivés', async () => {
    mocks.findMany.mockResolvedValue([row('active'), row('disabled', false)])
    const catalog = await getPublicCatalog()
    expect(mocks.findMany).toHaveBeenCalledOnce()
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }))
    expect(mocks.localize).toHaveBeenCalledWith('Tool', [row('active')], ['name', 'description'], 'nl')
    expect(catalog.map((tool) => tool.slug)).toEqual(['active', 'legacy', 'external'])
    expect(catalog[0].title).toBe('NL active')
  })

  it('continue au-delà du premier lot et préserve les exclusions statiques de la dernière page', async () => {
    const firstPage = Array.from({ length: 200 }, (_, i) => row(`tool-${i}`))
    mocks.findMany.mockResolvedValueOnce(firstPage).mockResolvedValueOnce([row('disabled', false), row('last')])
    const catalog = await getPublicCatalog()
    expect(mocks.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      cursor: { id: 'tool-199' }, skip: 1, take: 200,
    }))
    expect(catalog).toHaveLength(203)
    expect(catalog.some((tool) => tool.slug === 'last')).toBe(true)
    expect(catalog.some((tool) => tool.slug === 'disabled')).toBe(false)
  })

  it('propage un échec DB plutôt que de réafficher des outils désactivés par défaut', async () => {
    mocks.findMany.mockRejectedValue(new Error('DB unavailable'))
    await expect(getPublicCatalog()).rejects.toThrow('DB unavailable')
    expect(mocks.localize).not.toHaveBeenCalled()
  })
})
