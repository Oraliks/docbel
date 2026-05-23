import type { SearchResult } from './types'

/**
 * Panneau détail inline (pattern ONEM lookupweb) : traductions NL/DE/EN, notes
 * admin, et toutes les métadonnées spécifiques à la table (téléphone, IBAN…).
 */
export function DetailPanel({ result }: { result: SearchResult }) {
  const translations: { label: string; value: string }[] = []
  if (result.labelNl) translations.push({ label: 'Néerlandais', value: result.labelNl })
  if (result.labelDe) translations.push({ label: 'Allemand', value: result.labelDe })
  if (result.labelEn) translations.push({ label: 'Anglais', value: result.labelEn })

  const metaEntries = result.metadata ? Object.entries(result.metadata) : []

  return (
    <div className="space-y-3 text-xs">
      {translations.length > 0 && <Section title="Traductions" entries={translations} />}
      {result.notes && (
        <div>
          <SectionHeader>Note admin</SectionHeader>
          <p className="text-foreground whitespace-pre-wrap bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/40 rounded px-2 py-1.5">
            {result.notes}
          </p>
        </div>
      )}
      {metaEntries.length > 0 && (
        <Section
          title="Informations supplémentaires"
          entries={metaEntries.map(([label, value]) => ({ label, value }))}
        />
      )}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1.5">
      {children}
    </div>
  )
}

function Section({ title, entries }: { title: string; entries: { label: string; value: string }[] }) {
  return (
    <div>
      <SectionHeader>{title}</SectionHeader>
      <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
        {entries.map((e) => (
          <div key={e.label} className="flex flex-col">
            <dt className="text-[10px] text-muted-foreground">{e.label}</dt>
            <dd className="text-foreground break-words">{e.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
