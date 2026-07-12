// Audit READ-ONLY du contenu des pages du page-builder.
//
// Passe chaque bloc de `Page.content` (et, avec --revisions, des `PageRevision`)
// à la validation STRICTE dérivée du registry et classe :
//   - ok           : le bloc valide exactement le schéma de son type
//   - unknown-type : le type n'existe plus dans le registry (bloc legacy/renommé)
//   - invalid-props: le type existe mais les props ne valident pas le schéma
//
// AUCUNE écriture en base. Sert à décider s'il faut migrer/quarantiner du contenu.
//
// Usage :
//   pnpm pages:audit                # pages publiées + brouillons
//   pnpm pages:audit -- --revisions # inclut un échantillon de révisions
//   pnpm pages:audit -- --json      # sortie JSON brute

import { prisma } from '@/lib/prisma'
import { BLOCK_SCHEMAS } from '@/lib/page-builder/schema-registry'

interface BlockLike {
  id?: unknown
  type?: unknown
  props?: unknown
}

type Verdict = 'ok' | 'unknown-type' | 'invalid-props' | 'malformed'

interface BlockFinding {
  page: string
  slug: string
  blockId: string
  type: string
  verdict: Verdict
  detail?: string
}

function classifyBlock(block: BlockLike): { verdict: Verdict; detail?: string } {
  const type = typeof block?.type === 'string' ? block.type : null
  if (!type || typeof block !== 'object' || block === null) {
    return { verdict: 'malformed', detail: 'bloc sans type valide' }
  }
  const schema = BLOCK_SCHEMAS[type]
  if (!schema) return { verdict: 'unknown-type' }
  const res = schema.safeParse(block.props)
  if (res.success) return { verdict: 'ok' }
  const first = res.error.issues[0]
  return {
    verdict: 'invalid-props',
    detail: first ? `${first.path.join('.') || '(racine)'}: ${first.message}` : 'props invalides',
  }
}

function auditContent(content: unknown, page: string, slug: string): BlockFinding[] {
  if (!Array.isArray(content)) {
    return [{ page, slug, blockId: '—', type: '—', verdict: 'malformed', detail: 'content n’est pas un tableau' }]
  }
  const findings: BlockFinding[] = []
  for (const raw of content as BlockLike[]) {
    const { verdict, detail } = classifyBlock(raw)
    if (verdict === 'ok') continue
    findings.push({
      page,
      slug,
      blockId: typeof raw?.id === 'string' ? raw.id : '—',
      type: typeof raw?.type === 'string' ? raw.type : '—',
      verdict,
      detail,
    })
  }
  return findings
}

async function main() {
  const args = process.argv.slice(2)
  const includeRevisions = args.includes('--revisions')
  const asJson = args.includes('--json')

  const pages = await prisma.page.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, status: true, content: true },
  })

  let totalBlocks = 0
  const findings: BlockFinding[] = []
  for (const p of pages) {
    if (Array.isArray(p.content)) totalBlocks += p.content.length
    findings.push(...auditContent(p.content, p.id, p.slug))
  }

  let revisionFindings: BlockFinding[] = []
  let revisionCount = 0
  if (includeRevisions) {
    const revisions = await prisma.pageRevision.findMany({
      select: { id: true, pageId: true, content: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    revisionCount = revisions.length
    for (const r of revisions) {
      revisionFindings.push(...auditContent(r.content, r.pageId, `rev:${r.id}`))
    }
  }

  const byVerdict = (list: BlockFinding[]) =>
    list.reduce<Record<string, number>>((acc, f) => {
      acc[f.verdict] = (acc[f.verdict] ?? 0) + 1
      return acc
    }, {})

  const unknownTypes = [...new Set(findings.filter((f) => f.verdict === 'unknown-type').map((f) => f.type))].sort()
  const invalidByType = findings
    .filter((f) => f.verdict === 'invalid-props')
    .reduce<Record<string, number>>((acc, f) => {
      acc[f.type] = (acc[f.type] ?? 0) + 1
      return acc
    }, {})

  const summary = {
    pages: pages.length,
    blocs: totalBlocks,
    typesEnregistres: Object.keys(BLOCK_SCHEMAS).length,
    problemesPages: byVerdict(findings),
    typesInconnus: unknownTypes,
    invalidesParType: invalidByType,
    ...(includeRevisions
      ? { revisionsExaminees: revisionCount, problemesRevisions: byVerdict(revisionFindings) }
      : {}),
  }

  if (asJson) {
    console.log(JSON.stringify({ summary, findings, revisionFindings }, null, 2))
  } else {
    console.log('\n=== Audit du contenu des pages (read-only) ===\n')
    console.log(`Pages actives         : ${summary.pages}`)
    console.log(`Blocs totaux          : ${summary.blocs}`)
    console.log(`Types enregistrés     : ${summary.typesEnregistres}`)
    console.log(`\nProblèmes (pages)     :`, summary.problemesPages)
    if (unknownTypes.length) console.log(`Types inconnus        :`, unknownTypes)
    if (Object.keys(invalidByType).length) console.log(`Invalides par type    :`, invalidByType)
    if (includeRevisions) {
      console.log(`\nRévisions examinées   : ${revisionCount}`)
      console.log(`Problèmes (révisions) :`, byVerdict(revisionFindings))
    }
    if (findings.length) {
      console.log(`\n--- Détail (max 50) ---`)
      for (const f of findings.slice(0, 50)) {
        console.log(`  [${f.verdict}] page=${f.slug} bloc=${f.blockId} type=${f.type}${f.detail ? ` — ${f.detail}` : ''}`)
      }
      if (findings.length > 50) console.log(`  … +${findings.length - 50} autres`)
    } else {
      console.log('\n✅ Aucun bloc problématique : tout le contenu valide le registry strict.')
    }
    console.log('')
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
