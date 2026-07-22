// Harmonise les couleurs stockées en DB vers la palette système (one-off).
//
//  - DocumentBundle.color : toute valeur HORS-PALETTE (dont le défaut périmé
//    #7C3AED présent sur ~17/19 bundles) est VIDÉE ("") → `hueForBundle` retombe
//    alors sur le mapping code `CATEGORY_HUE` (déjà tokenisé) = couleur par
//    catégorie de vie. Les valeurs déjà système sont conservées.
//  - News.color : les hex éditoriaux hors-palette sont mappés vers le hex
//    système le plus proche.
//
// Idempotent (re-jouable sans effet de bord). ÉCRIT EN BASE.
//   Usage : pnpm exec dotenv -e .env.local -- tsx scripts/harmonize-db-colors.ts
import { prisma } from '@/lib/prisma'

// Valeurs "système" conservées telles quelles sur les bundles (hex clair).
const BUNDLE_SYSTEM = new Set(
  [
    '#5b46e5', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899',
    '#9f7cff', '#d08cff', '#ff8cc0', '#ffb070',
  ].map((s) => s.toLowerCase()),
)

// News : hex périmé -> hex système le plus proche.
const NEWS_MAP: Record<string, string> = {
  '#0e9f6e': '#10B981', // vert -> émeraude (chart-3)
  '#7c3aed': '#8B5CF6', // violet -> chart-4
  '#7e3af2': '#8B5CF6', // violet -> chart-4
  '#1a56db': '#3B82F6', // bleu -> chart-2
  '#ff2424': '#EF4444', // rouge -> destructive
}

async function main() {
  // --- Bundles : vider les couleurs hors-palette ---
  const bundles = await prisma.documentBundle.findMany({
    select: { id: true, slug: true, color: true, lifeEventCategory: true },
  })
  let cleared = 0
  let keptSystem = 0
  let clearedWithCategory = 0
  for (const b of bundles) {
    const c = (b.color ?? '').trim()
    if (!c) continue
    if (BUNDLE_SYSTEM.has(c.toLowerCase())) {
      keptSystem++
      continue
    }
    await prisma.documentBundle.update({ where: { id: b.id }, data: { color: '' } })
    cleared++
    if (b.lifeEventCategory) clearedWithCategory++
  }
  console.log(
    `Bundles: ${cleared} vidés (dont ${clearedWithCategory} avec lifeEventCategory → couleur par catégorie ; ` +
      `les ${cleared - clearedWithCategory} sans catégorie retombent sur --glass-accent-deep), ${keptSystem} déjà système.`,
  )

  // --- News : mapper vers le système ---
  const news = await prisma.news.findMany({ select: { id: true, color: true } })
  let mapped = 0
  for (const n of news) {
    const c = (n.color ?? '').trim().toLowerCase()
    const target = NEWS_MAP[c]
    if (target && target.toLowerCase() !== c) {
      await prisma.news.update({ where: { id: n.id }, data: { color: target } })
      mapped++
    }
  }
  console.log(`News: ${mapped} couleurs mappées vers la palette système.`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
