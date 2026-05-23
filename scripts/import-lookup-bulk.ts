// Import en lot des CSV exportés depuis le lookup ONEM.
// Lit tous les *-export_fr.csv (ou _nl.csv) d'un dossier, match chaque fichier
// à une LookupTable via exportName, et lance l'import. Les fichiers non matchés
// sont listés en fin de run pour discussion.
//
// Usage :
//   pnpm exec tsx scripts/import-lookup-bulk.ts                 (défaut: ~/Downloads)
//   pnpm exec tsx scripts/import-lookup-bulk.ts <chemin-dossier>

import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { importLookupCsv } from '@/lib/lookup/importLookupCsv'
import { extractOnemExportName } from '@/lib/lookup/matchFileName'

const DEFAULT_DIR =
  process.platform === 'win32'
    ? path.join(process.env.USERPROFILE ?? 'C:/Users/Admin', 'Downloads')
    : path.join(process.env.HOME ?? '', 'Downloads')

interface MatchedFile {
  fileName: string
  fullPath: string
  exportName: string
  tableId: string
  tableLabel: string
}

interface UnmatchedFile {
  fileName: string
  exportName: string
}

async function main() {
  const dir = process.argv[2] || DEFAULT_DIR
  console.log(`\n📁 Scan : ${dir}\n`)

  const files = await readdir(dir).catch(() => [])
  const csvs = files.filter((f) => /-export_(fr|nl|de|en)\.csv$/i.test(f))

  if (csvs.length === 0) {
    console.log('Aucun fichier *-export_*.csv trouvé dans ce dossier.')
    process.exit(0)
  }

  console.log(`${csvs.length} CSV détectés.\n`)

  // Charger toutes les tables avec exportName
  const tables = await prisma.lookupTable.findMany({
    select: {
      id: true,
      exportName: true,
      labelFr: true,
      category: { select: { labelFr: true } },
    },
  })
  const byExportName = new Map<string, (typeof tables)[number]>()
  for (const t of tables) {
    if (t.exportName) byExportName.set(t.exportName, t)
  }

  // Match chaque fichier
  const matched: MatchedFile[] = []
  const unmatched: UnmatchedFile[] = []
  for (const file of csvs) {
    const exportName = extractOnemExportName(file)
    const table = byExportName.get(exportName)
    if (table) {
      matched.push({
        fileName: file,
        fullPath: path.join(dir, file),
        exportName,
        tableId: table.id,
        tableLabel: `${table.category.labelFr} · ${table.labelFr}`,
      })
    } else {
      unmatched.push({ fileName: file, exportName })
    }
  }

  console.log(`✓ ${matched.length} fichiers matchés`)
  console.log(`✗ ${unmatched.length} fichiers non matchés\n`)

  if (matched.length === 0) {
    console.log('Rien à importer.')
    await summarizeUnmatched(unmatched)
    process.exit(0)
  }

  // Confirmation interactive
  const args = new Set(process.argv.slice(2))
  if (!args.has('--yes') && !args.has('-y')) {
    console.log('Aperçu des imports prévus :')
    for (const m of matched.slice(0, 20)) {
      console.log(`  ${m.fileName.padEnd(50)} → ${m.tableLabel}`)
    }
    if (matched.length > 20) {
      console.log(`  ... et ${matched.length - 20} autres`)
    }
    console.log(`\nLance avec --yes pour confirmer l'import.\n`)
    await summarizeUnmatched(unmatched)
    process.exit(0)
  }

  // Import en série
  let totalInserted = 0
  let totalUpdated = 0
  let totalUnchanged = 0
  let totalErrors = 0

  for (const m of matched) {
    process.stdout.write(`→ ${m.fileName.padEnd(50)} `)
    try {
      const csvContent = await readFile(m.fullPath, 'utf-8')
      const result = await importLookupCsv({
        tableId: m.tableId,
        csvContent,
        fileName: m.fileName,
        importedBy: 'bulk-import-cli',
      })
      totalInserted += result.inserted
      totalUpdated += result.updated
      totalUnchanged += result.unchanged
      totalErrors += result.errors.length
      console.log(
        `✓ ${String(result.inserted).padStart(4)} ins, ${String(result.updated).padStart(3)} maj, ${String(result.unchanged).padStart(4)} inch${result.errors.length > 0 ? `, ⚠ ${result.errors.length} err` : ''}`
      )
    } catch (err) {
      totalErrors++
      console.log(`✗ ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\n📊 Total :`)
  console.log(`   ${totalInserted} entrées insérées`)
  console.log(`   ${totalUpdated} entrées mises à jour`)
  console.log(`   ${totalUnchanged} entrées inchangées`)
  if (totalErrors > 0) console.log(`   ⚠ ${totalErrors} erreurs`)

  await summarizeUnmatched(unmatched)
}

async function summarizeUnmatched(unmatched: UnmatchedFile[]) {
  if (unmatched.length === 0) return
  console.log(`\n⚠ Fichiers non matchés (${unmatched.length}) :`)
  console.log(`  Pour les associer à une table, ajoute l'exportName dans :`)
  console.log(`  lib/data/lookup-onem-seed.json puis lance \`pnpm seed:lookup\`.\n`)
  for (const u of unmatched) {
    // Lire la 1ère ligne pour info contextuelle
    const fullPath = path.join(
      path.dirname(process.argv[2] || DEFAULT_DIR),
      'Downloads',
      u.fileName
    )
    let hint = ''
    try {
      const head = (await readFile(fullPath, 'utf-8')).split('\n')[0]
      hint = head.replace('Liste des lookups: ', '').trim()
    } catch {
      // ignore
    }
    console.log(`  ${u.fileName.padEnd(50)} → exportName: "${u.exportName}"${hint && hint !== u.exportName ? ` (1ère ligne CSV: "${hint}")` : ''}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
