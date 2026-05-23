import { prisma } from '@/lib/prisma'

async function main() {
  const [total, withFr, withNl, withDe, withEn] = await Promise.all([
    prisma.lookupEntry.count(),
    prisma.lookupEntry.count({ where: { labelFr: { not: '' } } }),
    prisma.lookupEntry.count({ where: { labelNl: { not: '' } } }),
    prisma.lookupEntry.count({ where: { labelDe: { not: null } } }),
    prisma.lookupEntry.count({ where: { labelEn: { not: null } } }),
  ])
  console.log('Total entrées:', total)
  console.log(
    `  Avec labelFr : ${withFr} (${((withFr / total) * 100).toFixed(1)}%)`
  )
  console.log(
    `  Avec labelNl : ${withNl} (${((withNl / total) * 100).toFixed(1)}%)`
  )
  console.log(
    `  Avec labelDe : ${withDe} (${((withDe / total) * 100).toFixed(1)}%)`
  )
  console.log(
    `  Avec labelEn : ${withEn} (${((withEn / total) * 100).toFixed(1)}%)`
  )

  // Quelques échantillons multi-langues
  console.log('\nÉchantillons avec 4 langues remplies :')
  const samples = await prisma.lookupEntry.findMany({
    where: { labelDe: { not: null }, labelEn: { not: null } },
    take: 5,
    include: { table: { select: { labelFr: true } } },
  })
  for (const s of samples) {
    console.log(`  [${s.table.labelFr}] ${s.code}`)
    console.log(`    FR: ${s.labelFr}`)
    console.log(`    NL: ${s.labelNl}`)
    console.log(`    DE: ${s.labelDe}`)
    console.log(`    EN: ${s.labelEn}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
