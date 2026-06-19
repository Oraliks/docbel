// =====================================================================
//  Seed — page builder /onem/ec32 (carte de contrôle eC3.2)
// ---------------------------------------------------------------------
//  Crée (ou met à jour) la page builder au slug `onem-ec32` contenant un
//  unique bloc `ec32Page` alimenté par `ec32DefaultContent`. Idempotent :
//  réutilise l'id de bloc existant si présent. À lancer via :
//    npx tsx scripts/seed-ec32-page.ts
// =====================================================================

import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { ec32DefaultContent } from '@/lib/ec32/content'

const SLUG = 'onem-ec32'

interface StoredBlock {
  id?: string
  type?: string
  props?: unknown
}

async function main(): Promise<void> {
  const existing = await prisma.page.findFirst({ where: { slug: SLUG } })

  const metaTitle = ec32DefaultContent.seo.title
  const metaDesc = ec32DefaultContent.seo.description

  if (!existing) {
    const page = await prisma.page.create({
      data: {
        title: 'eC3.2 — Carte de contrôle (simulation)',
        slug: SLUG,
        status: 'published',
        metaTitle,
        metaDesc,
        content: [
          {
            id: nanoid(),
            type: 'ec32Page',
            props: ec32DefaultContent,
          },
        ],
      },
    })
    console.log(`[seed-ec32-page] Page créée : ${page.slug} (id ${page.id}).`)
    return
  }

  // Réutilise l'id du bloc ec32Page existant si possible (sinon nanoid).
  const blocks: StoredBlock[] = Array.isArray(existing.content)
    ? (existing.content as unknown as StoredBlock[])
    : []
  const previousId = blocks.find((b) => b?.type === 'ec32Page')?.id ?? nanoid()

  const updated = await prisma.page.update({
    where: { id: existing.id },
    data: {
      metaTitle,
      metaDesc,
      content: [
        {
          id: previousId,
          type: 'ec32Page',
          props: ec32DefaultContent,
        },
      ],
    },
  })
  console.log(
    `[seed-ec32-page] Page mise à jour : ${updated.slug} (id ${updated.id}, bloc ${previousId}).`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
