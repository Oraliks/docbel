import Link from 'next/link'
import { BAREME_SHEETS, sheetHref } from '@/lib/baremes/sheetRegistry'

/** Pills de navigation entre les feuilles de barème (server component). */
export function BaremeSheetNav({ activeSlug }: { activeSlug: string }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Feuilles de barème">
      {BAREME_SHEETS.map((s) => {
        const active = s.slug === activeSlug
        return (
          <Link
            key={s.slug}
            href={sheetHref(s.slug)}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                : 'rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
            }
          >
            {s.navLabel}
          </Link>
        )
      })}
    </nav>
  )
}
