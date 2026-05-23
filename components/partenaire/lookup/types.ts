export interface SearchResult {
  id: string
  code: string
  labelFr: string
  labelNl: string
  labelDe: string | null
  labelEn: string | null
  validFrom: string | null
  validUntil: string | null
  notes: string | null
  metadata: Record<string, string> | null
  similarity: number
  table: {
    slug: string
    labelFr: string
    prefix: string
    category: { slug: string; labelFr: string }
  }
}

export interface TableInfo {
  id: string
  slug: string
  labelFr: string
  prefix: string
  group: string | null
  entriesCount: number
}

export interface CategoryInfo {
  slug: string
  labelFr: string
  tables: TableInfo[]
}

export interface PickableTable extends TableInfo {
  categoryLabel?: string
}

export interface ResultGroup {
  tableSlug: string
  tableLabel: string
  tablePrefix: string
  categoryLabel: string
  topScore: number
  rows: SearchResult[]
}

export type ColumnKey = 'code' | 'fr' | 'validity' | 'notes' | 'source'

export interface ColumnDef {
  key: ColumnKey
  label: string
  defaultVisible: boolean
}

export const COLUMNS: ColumnDef[] = [
  { key: 'code', label: 'Code', defaultVisible: true },
  { key: 'fr', label: 'Description', defaultVisible: true },
  { key: 'validity', label: "Validité (depuis · jusqu'au)", defaultVisible: true },
  { key: 'notes', label: 'Notes admin', defaultVisible: false },
  { key: 'source', label: 'Source ONEM (table)', defaultVisible: true },
]
