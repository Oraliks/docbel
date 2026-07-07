import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 3600 // refresh once per hour

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const baseUrl = `${url.protocol}//${url.host}`

  const [pages, news, pdfForms] = await Promise.all([
    prisma.page.findMany({
      where: { status: 'published', deletedAt: null },
      select: { slug: true, updatedAt: true },
    }),
    prisma.news?.findMany?.({
      where: { status: 'published' },
      select: { slug: true, updatedAt: true },
    }).catch(() => []) ?? [],
    // Formulaires PDF avec URL publique SEO stable (Phase 3 du plan
    // bindings). On n'expose QUE les publications qui ont un `publicPath` :
    // les autres restent accessibles par slug interne mais ne sont pas
    // canonisées pour indexation (le plan §3.2 réserve l'attribution au
    // cas par cas — actuellement seul `onem/c1`).
    prisma.pdfForm.findMany({
      where: { status: 'published', active: true, publicPath: { not: null } },
      select: { publicPath: true, updatedAt: true },
    }),
  ])

  const entries: { loc: string; lastmod?: string; priority: number }[] = []

  // Root
  entries.push({ loc: baseUrl, priority: 1.0 })

  // Static main pages
  entries.push({ loc: `${baseUrl}/actualites`, priority: 0.8 })
  entries.push({ loc: `${baseUrl}/contact`, priority: 0.6 })

  // Pages built with the page builder
  for (const p of pages) {
    entries.push({
      loc: `${baseUrl}/${p.slug}`,
      lastmod: p.updatedAt.toISOString(),
      priority: 0.7,
    })
  }

  // News articles
  for (const n of news) {
    entries.push({
      loc: `${baseUrl}/actualites/${n.slug}`,
      lastmod: n.updatedAt.toISOString(),
      priority: 0.6,
    })
  }

  // Formulaires PDF avec URL publique (SEO). Chaque publicPath = 1 seule
  // entrée sitemap (pas de duplicate avec le slug interne — l'URL slug
  // renvoie un 308 vers le publicPath, canoniquement indexé).
  for (const f of pdfForms) {
    if (!f.publicPath) continue;
    entries.push({
      loc: `${baseUrl}/document/${f.publicPath}`,
      lastmod: f.updatedAt.toISOString(),
      priority: 0.7,
    })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
    <priority>${e.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
