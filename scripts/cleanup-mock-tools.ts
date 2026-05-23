// Nettoie les "faux outils" qui n'ont pas d'implémentation réelle.
//
// Approche : KEEP-LIST. Tout outil dont le slug n'est pas dans KEEP_SLUGS
// est considéré comme mock et supprimé. Les DocumentTemplate associés
// cascade automatiquement (onDelete: Cascade dans le schéma).
//
// Réactiver un outil = retirer son slug d'ici et re-le-créer côté admin
// (ou via le seed). On évite donc d'avoir des coquilles vides dans la DB
// avant que l'implémentation soit prête.
//
// Usage : pnpm tools:cleanup-mocks            (dry-run + détail templates)
//         pnpm tools:cleanup-mocks --yes      (applique)

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')

/**
 * SEUL le seed mock initial est supprimable automatiquement. Tout outil
 * créé via l'admin (document builder, template editor) reste — l'admin
 * le supprime lui-même via le bouton dédié sur la card.
 *
 * Pour ajouter un nouveau seed-mock à purger, l'ajouter ici.
 */
const SEED_MOCKS_TO_DELETE = ['agr', 'salaire-min']

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}\n`)

  const allTools = await prisma.tool.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      description: true,
      createdAt: true,
      documentTemplate: {
        select: {
          id: true,
          version: true,
          status: true,
          sourceType: true,
          officialRef: true,
          sourceFile: { select: { name: true } },
          _count: { select: { generated: true, revisions: true, drafts: true, bundleItems: true } },
        },
      },
    },
    orderBy: { slug: 'asc' },
  })

  console.log(`État actuel : ${allTools.length} tools en DB\n`)

  for (const t of allTools) {
    const willDelete = SEED_MOCKS_TO_DELETE.includes(t.slug)
    const marker = willDelete ? '🗑 ' : '✓ '
    const tmpl = t.documentTemplate ? ` (+template v${t.documentTemplate.version} ${t.documentTemplate.status})` : ''
    console.log(`  ${marker} ${t.slug.padEnd(22)} ${t.type.padEnd(15)} ${t.name}${tmpl}`)
  }

  const toDelete = allTools.filter((t) => SEED_MOCKS_TO_DELETE.includes(t.slug))
  console.log(`\n→ ${toDelete.length} seed-mocks à supprimer, ${allTools.length - toDelete.length} conservés`)
  console.log(`  (Pour supprimer un autre outil, passe par /admin/chomage/outils.)`)

  if (toDelete.length === 0) {
    console.log('Rien à faire.')
    return
  }

  if (APPLY) {
    const result = await prisma.tool.deleteMany({
      where: { slug: { in: SEED_MOCKS_TO_DELETE } },
    })
    console.log(`\n✓ Supprimé ${result.count} tools`)
  } else {
    console.log('\nDry-run. Passe --yes pour appliquer.')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
