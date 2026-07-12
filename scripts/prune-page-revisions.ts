// Purge des révisions de page selon la politique de rétention
// (30 récentes + 1/jour au-delà — voir lib/page-builder/revision-retention.ts).
//
// SÉCURITÉ : DRY-RUN par défaut (aucune écriture). Le rapport indique ce qui
// SERAIT supprimé. La suppression réelle n'a lieu qu'avec `--apply`.
//
// Usage :
//   pnpm pages:prune-revisions            # dry-run (lecture seule)
//   pnpm pages:prune-revisions -- --apply # applique la purge (destructif)
//   pnpm pages:prune-revisions -- --keep-recent 50

import { prisma } from '@/lib/prisma'
import { planRetention } from '@/lib/page-builder/revision-retention'

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const keepIdx = args.indexOf('--keep-recent')
  const keepRecent = keepIdx !== -1 ? Number(args[keepIdx + 1]) : 30
  if (!Number.isFinite(keepRecent) || keepRecent < 0) {
    console.error('--keep-recent doit être un entier ≥ 0')
    process.exit(1)
  }

  const pages = await prisma.page.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true },
  })

  let totalRevs = 0
  let totalDelete = 0
  const toDelete: string[] = []
  const perPage: Array<{ slug: string; total: number; keep: number; del: number }> = []

  for (const page of pages) {
    const revisions = await prisma.pageRevision.findMany({
      where: { pageId: page.id },
      select: { id: true, createdAt: true },
    })
    totalRevs += revisions.length
    const plan = planRetention(revisions, { keepRecent })
    if (plan.delete.length > 0) {
      totalDelete += plan.delete.length
      toDelete.push(...plan.delete)
      perPage.push({
        slug: page.slug,
        total: revisions.length,
        keep: plan.keep.length,
        del: plan.delete.length,
      })
    }
  }

  console.log('\n=== Rétention des révisions de page ===')
  console.log(`Mode              : ${apply ? 'APPLY (destructif)' : 'DRY-RUN (lecture seule)'}`)
  console.log(`Politique         : ${keepRecent} récentes + 1/jour au-delà`)
  console.log(`Pages             : ${pages.length}`)
  console.log(`Révisions totales : ${totalRevs}`)
  console.log(`À supprimer       : ${totalDelete}`)
  if (perPage.length) {
    console.log('\n--- Pages concernées ---')
    for (const p of perPage.sort((a, b) => b.del - a.del)) {
      console.log(`  ${p.slug}: ${p.total} → garde ${p.keep}, supprime ${p.del}`)
    }
  } else {
    console.log('\n✅ Rien à purger : toutes les pages sont sous la politique de rétention.')
  }

  if (apply && toDelete.length > 0) {
    // Supprime par lots pour ne pas dépasser les limites de paramètres SQL.
    const BATCH = 500
    let done = 0
    for (let i = 0; i < toDelete.length; i += BATCH) {
      const batch = toDelete.slice(i, i + BATCH)
      const res = await prisma.pageRevision.deleteMany({ where: { id: { in: batch } } })
      done += res.count
    }
    console.log(`\n🗑️  ${done} révisions supprimées.`)
  } else if (!apply && totalDelete > 0) {
    console.log('\nℹ️  Dry-run — relancez avec `--apply` pour supprimer réellement.')
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
