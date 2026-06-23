import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { getActiveBaremeData } from '@/lib/baremes/getActiveBaremeData'
import { BAREME_SHEETS, sheetHref, type SheetEntry } from '@/lib/baremes/sheetRegistry'
import { ArrowRight, Calendar, FileSpreadsheet, Home } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Barèmes chômage ONEM — Montants officiels | DocBel',
  description:
    "Consultez les barèmes officiels de l'ONEM : allocations de chômage complet, mi-temps, temporaire, catégories spéciales et salaires horaires. Montants en vigueur par code et tranche.",
}

export const revalidate = 300

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('fr-BE')
}

export default async function BaremeHubPage() {
  const t = await getTranslations('public.outils')
  const data = await getActiveBaremeData()

  // Métadonnées par feuille (date + nombre de montants) depuis les données publiées.
  const meta = new Map<string, { count: number; validFrom: Date | null }>()
  if (data) {
    for (const entry of BAREME_SHEETS) {
      const list = data.amountsByCategory[entry.category] ?? []
      meta.set(entry.slug, { count: list.length, validFrom: list[0]?.validFrom ?? null })
    }
  }

  // Regroupement par `group` en conservant l'ordre du registre.
  const groups: { name: string; sheets: SheetEntry[] }[] = []
  for (const entry of BAREME_SHEETS) {
    let g = groups.find((x) => x.name === entry.group)
    if (!g) {
      g = { name: entry.group, sheets: [] }
      groups.push(g)
    }
    g.sheets.push(entry)
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/outils" />} className="inline-flex items-center gap-1">
              <Home className="size-3.5" />
              {t('baremeBreadcrumbTools')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('baremeBreadcrumbCurrent')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t('baremeEyebrow')}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          {t.rich('baremeTitle', { accent: (c) => <span className="italic text-primary">{c}</span> })}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t('baremeIntro')}
        </p>
        {data && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              {t('baremePublishedAt', { date: formatDate(data.publishedAt) })}
            </span>
            {data.multiplicateur != null && (
              <span>
                {t('baremeMultiplier')}{' '}
                <span className="font-semibold text-primary">
                  {data.multiplicateur.toLocaleString('fr-BE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                </span>
              </span>
            )}
          </div>
        )}
      </header>

      {!data ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <FileSpreadsheet className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('baremeEmptyTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('baremeEmptyBody')}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.name}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {g.name}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.sheets.map((entry) => {
                  const m = meta.get(entry.slug)
                  return (
                    <Link
                      key={entry.slug}
                      href={sheetHref(entry.slug)}
                      className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileSpreadsheet className="size-4.5" />
                        </span>
                        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground">{entry.title}</h3>
                      <p className="mt-1 flex-1 text-sm text-muted-foreground">{entry.description}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {m?.validFrom && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                            <Calendar className="size-3" />
                            {formatDate(m.validFrom)}
                          </span>
                        )}
                        {m && m.count > 0 && <span>{t('baremeAmounts', { count: m.count.toLocaleString('fr-BE') })}</span>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
