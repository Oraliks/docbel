// Audit de fraîcheur des référentiels (Lookup ONEM) — NOTRE côté.
//
// HONNÊTETÉ sur la source ONEM : services.onem.be/lookupweb est une application
// JSF (navigation par conversationId, rendu côté JS, pas de point d'API publique
// ni d'URL stable par table). Il n'existe donc PAS de moyen fiable de comparer
// automatiquement nos comptes à ceux de l'ONEM depuis un script.
//
// Ce rapport couvre donc ce que NOUS stockons (entriesCount, lastImportedAt) et,
// en option, accepte un JSON de comptes ONEM *capturés manuellement* pour produire
// un diff « à ré-importer ».
//
// Usage:
//   pnpm exec tsx scripts/lookup-onem-freshness-audit.ts
//   pnpm exec tsx scripts/lookup-onem-freshness-audit.ts --json
//   pnpm exec tsx scripts/lookup-onem-freshness-audit.ts ./onem-counts.json
//   pnpm exec tsx scripts/lookup-onem-freshness-audit.ts ./onem-counts.json --json
// (ou via le script package.json : pnpm lookup:audit [chemin.json] [--json])
//
// Format du JSON ONEM attendu : { "<slug>": <nombreOnem>, ... }

import { readFileSync } from 'node:fs'
import { prisma } from '@/lib/prisma'

// Drapeau de fraîcheur de NOTRE côté.
type Flag = 'VIDE' | 'JAMAIS IMPORTE' | 'OK'

interface TableRow {
  slug: string
  prefix: string
  labelFr: string
  entriesCount: number
  lastImportedAt: Date | null
  flag: Flag
}

interface CategoryGroup {
  category: string
  tables: TableRow[]
}

// Formate une date d'import en libellé lisible (ou 'jamais' si absente).
function formatImportDate(date: Date | null): string {
  if (!date) return 'jamais'
  return date.toLocaleString('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Détermine le drapeau de fraîcheur d'une table.
function computeFlag(entriesCount: number, lastImportedAt: Date | null): Flag {
  if (entriesCount === 0) return 'VIDE'
  if (lastImportedAt === null) return 'JAMAIS IMPORTE'
  return 'OK'
}

// Charge le JSON de comptes ONEM capturés manuellement, s'il est fourni en argument.
// On ignore les flags (--json) et on ne retient que le 1er argument ressemblant à un chemin.
function loadOnemCounts(pathArg: string | undefined): Record<string, number> | null {
  if (!pathArg) return null
  try {
    const raw = readFileSync(pathArg, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.error(`Le JSON ONEM "${pathArg}" doit être un objet { "slug": nombre, ... }.`)
      process.exit(1)
    }
    const result: Record<string, number> = {}
    for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        console.error(`Le JSON ONEM contient une valeur non numérique pour "${slug}".`)
        process.exit(1)
      }
      result[slug] = value
    }
    return result
  } catch (err) {
    console.error(`Impossible de lire le JSON ONEM "${pathArg}" :`, err)
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const wantsJson = args.includes('--json')
  // Premier argument qui n'est pas un flag => chemin du JSON ONEM optionnel.
  const onemPathArg = args.find((arg) => !arg.startsWith('--'))
  const onemCounts = loadOnemCounts(onemPathArg)

  const tables = await prisma.lookupTable.findMany({
    select: {
      slug: true,
      prefix: true,
      labelFr: true,
      entriesCount: true,
      lastImportedAt: true,
      category: { select: { labelFr: true } },
    },
  })

  // Regroupement par catégorie (label FR), trié par catégorie puis par prefix.
  const byCategoryMap = new Map<string, TableRow[]>()
  for (const t of tables) {
    const categoryLabel = t.category.labelFr
    const row: TableRow = {
      slug: t.slug,
      prefix: t.prefix,
      labelFr: t.labelFr,
      entriesCount: t.entriesCount,
      lastImportedAt: t.lastImportedAt,
      flag: computeFlag(t.entriesCount, t.lastImportedAt),
    }
    const list = byCategoryMap.get(categoryLabel)
    if (list) list.push(row)
    else byCategoryMap.set(categoryLabel, [row])
  }

  const byCategory: CategoryGroup[] = [...byCategoryMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([category, rows]) => ({
      category,
      tables: rows.sort((a, b) => a.prefix.localeCompare(b.prefix, 'fr')),
    }))

  // Totaux globaux.
  const totalTables = tables.length
  const totalEntries = tables.reduce((sum, t) => sum + t.entriesCount, 0)
  const totalEmpty = tables.filter((t) => t.entriesCount === 0).length
  const totalNeverImported = tables.filter((t) => t.lastImportedAt === null).length

  // --- Sortie JSON optionnelle ---
  if (wantsJson) {
    const report = {
      generatedAt: new Date().toISOString(),
      totals: {
        tables: totalTables,
        entries: totalEntries,
        empty: totalEmpty,
        neverImported: totalNeverImported,
      },
      byCategory: byCategory.map((group) => ({
        category: group.category,
        tables: group.tables.map((t) => ({
          slug: t.slug,
          prefix: t.prefix,
          labelFr: t.labelFr,
          entriesCount: t.entriesCount,
          lastImportedAt: t.lastImportedAt ? t.lastImportedAt.toISOString() : null,
          flag: t.flag,
        })),
      })),
    }
    console.log(JSON.stringify(report, null, 2))
  }

  // --- Rapport console lisible ---
  console.log('\n=== Audit de fraîcheur — Lookup ONEM (notre côté) ===\n')
  for (const group of byCategory) {
    console.log(`# ${group.category}`)
    for (const t of group.tables) {
      console.log(
        `  [${t.flag.padEnd(14)}] ${t.prefix.padEnd(10)} ${t.slug}\n` +
          `      "${t.labelFr}"\n` +
          `      count: ${t.entriesCount} · dernier import: ${formatImportDate(t.lastImportedAt)}`
      )
    }
    console.log('')
  }

  console.log('--- Résumé ---')
  console.log(`  Total tables          : ${totalTables}`)
  console.log(`  Total entrées         : ${totalEntries}`)
  console.log(`  Tables vides          : ${totalEmpty}`)
  console.log(`  Jamais importées      : ${totalNeverImported}`)

  // --- Diff optionnel avec les comptes ONEM capturés manuellement ---
  if (onemCounts) {
    console.log(`\n--- Diff comptes ONEM (source : ${onemPathArg}) ---`)
    // Index de nos comptes par slug pour un lookup rapide.
    const ourCountBySlug = new Map<string, number>()
    for (const t of tables) ourCountBySlug.set(t.slug, t.entriesCount)

    let toReimport = 0
    let upToDate = 0
    let unknownSlugs = 0

    for (const [slug, onemCount] of Object.entries(onemCounts)) {
      const ourCount = ourCountBySlug.get(slug)
      if (ourCount === undefined) {
        console.log(`  ${slug}: slug inconnu chez nous (présent uniquement dans le JSON ONEM)`)
        unknownSlugs++
        continue
      }
      if (ourCount !== onemCount) {
        console.log(`  ${slug}: ${ourCount} chez nous / ${onemCount} ONEM -> RE-IMPORTER`)
        toReimport++
      } else {
        console.log(`  ${slug}: ${ourCount} chez nous / ${onemCount} ONEM -> à jour`)
        upToDate++
      }
    }

    console.log(
      `\n  Diff : ${toReimport} à ré-importer, ${upToDate} à jour` +
        (unknownSlugs > 0 ? `, ${unknownSlugs} slug(s) inconnu(s)` : '')
    )
  } else {
    console.log(
      `\nNote : aucun JSON de comptes ONEM fourni. La source ONEM (lookupweb, app JSF` +
        ` sans API publique) n'est pas comparable automatiquement. Pour un diff,` +
        ` passez un chemin vers un JSON { "slug": nombre, ... } capturé manuellement.`
    )
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
