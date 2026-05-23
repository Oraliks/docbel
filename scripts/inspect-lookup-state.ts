// Affiche l'état actuel du lookup en DB + ce qui est dans Downloads/JSON.
import { prisma } from '@/lib/prisma'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { extractOnemExportName } from '@/lib/lookup/matchFileName'

const DIR = 'C:/Users/Admin/Downloads/JSON'

async function main() {
  const tables = await prisma.lookupTable.findMany({
    select: {
      id: true,
      slug: true,
      labelFr: true,
      exportName: true,
      entriesCount: true,
      category: { select: { labelFr: true } },
    },
    orderBy: [{ categoryId: 'asc' }, { labelFr: 'asc' }],
  })

  const totalEntries = await prisma.lookupEntry.count()

  const files = await readdir(DIR).catch(() => [])
  const csvs = files.filter((f) => /-export_(fr|nl|de|en)\.csv$/i.test(f))

  const tablesByExportName = new Map<string, (typeof tables)[number]>()
  for (const t of tables) {
    if (t.exportName) tablesByExportName.set(t.exportName, t)
  }

  const matched: string[] = []
  const unmatched: { fileName: string; exportName: string; hint: string }[] = []
  for (const file of csvs) {
    const exportName = extractOnemExportName(file)
    if (tablesByExportName.has(exportName)) {
      matched.push(file)
    } else {
      let hint = ''
      try {
        const head = (await readFile(path.join(DIR, file), 'utf-8')).split('\n')[0]
        hint = head.replace('Liste des lookups: ', '').trim()
      } catch {
        // ignore
      }
      unmatched.push({ fileName: file, exportName, hint })
    }
  }

  console.log(`\n=== DB ===`)
  console.log(`Tables: ${tables.length}`)
  console.log(`Tables avec exportName: ${[...tablesByExportName.values()].length}`)
  console.log(`Tables alimentées (entriesCount > 0): ${tables.filter((t) => t.entriesCount > 0).length}`)
  console.log(`Total entrées: ${totalEntries}`)

  console.log(`\n=== Fichiers Downloads/JSON ===`)
  console.log(`CSV trouvés: ${csvs.length}`)
  console.log(`Matchés (auto-import OK): ${matched.length}`)
  console.log(`Non matchés (mapping requis): ${unmatched.length}`)

  if (unmatched.length > 0) {
    console.log(`\n=== Non matchés ===`)
    for (const u of unmatched) {
      console.log(`  ${u.fileName}`)
      console.log(`    exportName: "${u.exportName}"`)
      if (u.hint && u.hint !== u.exportName) {
        console.log(`    1ère ligne: "${u.hint}"`)
      }
    }
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
