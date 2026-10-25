import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import { createHash } from 'crypto'

export interface ImportLookupCsvInput {
  /** ID de la LookupTable cible. */
  tableId: string
  /** Contenu brut du CSV (texte). */
  csvContent: string
  /** Nom du fichier source (pour traçabilité). */
  fileName?: string
  /** Email de l'admin qui importe. */
  importedBy?: string
}

export interface LookupDiffEntry {
  code: string
  oldLabelFr?: string
  newLabelFr?: string
  oldLabelNl?: string
  newLabelNl?: string
  oldLabelDe?: string | null
  newLabelDe?: string | null
  oldLabelEn?: string | null
  newLabelEn?: string | null
  oldValidFrom?: string | null
  newValidFrom?: string | null
  oldValidUntil?: string | null
  newValidUntil?: string | null
  oldMetadata?: unknown
  newMetadata?: unknown
  changedFields?: string[]
}

export interface LookupImportDiff {
  added: LookupDiffEntry[]      // Nouveaux codes
  modified: LookupDiffEntry[]   // Codes existants avec labels changés
  absentFromExport: LookupDiffEntry[] // Présents en DB, absents de cet export; jamais expirés automatiquement
}

export interface PreparedLookupEntry {
  code: string
  labelFr: string
  labelNl: string
  labelDe: string | null
  labelEn: string | null
  validFrom: string | null
  validUntil: string | null
  metadata: Record<string, string> | null
  existingId: string | null
}

export interface PreparedLookupImport {
  entries: PreparedLookupEntry[]
  diff: LookupImportDiff
  totalRows: number
  errors: { row: number; message: string }[]
}

export interface LookupEntrySnapshot {
  id: string; code: string; validFrom: Date | null; validUntil: Date | null;
  labelFr: string; labelNl: string; labelDe: string | null; labelEn: string | null;
  metadata: Prisma.JsonValue | null;
}

export interface ImportLookupCsvResult {
  inserted: number
  updated: number
  unchanged: number
  errors: { row: number; message: string }[]
  totalRows: number
  diff: LookupImportDiff
}

const REQUIRED_HEADERS = ['code', 'description'] as const
export const LOOKUP_IMPORT_PARSER_VERSION = 'lookup-csv-2'

/**
 * Import un CSV exporté depuis services.onem.be/lookupweb dans une LookupTable.
 *
 * Format CSV attendu (en-têtes détectées par mots-clés, ordre libre) :
 *  - "Code" → entry.code
 *  - "Date de début" / "Begindatum" / "Date début" → entry.validFrom
 *  - "Date de fin" / "Einddatum" → entry.validUntil
 *  - "Description française" / "Beschrijving frans" → entry.labelFr
 *  - "Description néerlandaise" / "Beschrijving nederlands" → entry.labelNl
 *
 * Upsert par (tableId, code, validFrom). Les entrées existantes non listées
 * dans le CSV ne sont pas supprimées (préservation de l'historique).
 */
export async function importLookupCsv(
  input: ImportLookupCsvInput
): Promise<ImportLookupCsvResult> {
  const { createLookupImportProposal, publishLookupImportProposal } = await import('./importWorkflow')
  const created = await createLookupImportProposal({
    tableId: input.tableId,
    csvContent: input.csvContent,
    fileName: input.fileName,
    createdBy: input.importedBy ?? 'unknown',
  })
  if (created.state === 'failed') {
    return { inserted: 0, updated: 0, unchanged: 0, errors: created.errors ?? [], totalRows: 0, diff: created.diff }
  }
  if (created.requiresApproval) {
    throw new Error('Cette table exige des approbations liées à une proposition; utilisez l’interface Lookup administrateur.')
  }
  const published = await publishLookupImportProposal({ proposalId: created.id, publishedBy: input.importedBy ?? 'unknown' })
  if (published.state !== 'published' && published.state !== 'already_published') {
    throw new Error(`Publication Lookup non effectuée (${published.state})`)
  }
  return {
    inserted: published.inserted ?? 0,
    updated: published.updated ?? 0,
    unchanged: published.unchanged ?? 0,
    errors: published.errors,
    totalRows: published.totalRows,
    diff: published.diff,
  }
}

export async function prepareLookupCsv(
  tableId: string,
  csvContent: string,
  existingRowsOverride?: LookupEntrySnapshot[],
): Promise<PreparedLookupImport> {
  const result: PreparedLookupImport = {
    entries: [], diff: { added: [], modified: [], absentFromExport: [] }, totalRows: 0, errors: [],
  }
  const rows = parseCsv(csvContent)
  if (rows.length === 0) throw new Error('CSV vide ou non parsable')
  const headerIndex = findHeaderRow(rows)
  if (headerIndex === -1) throw new Error('Colonne "Code" introuvable dans l\'en-tête')
  const colMap = detectColumns(rows[headerIndex])
  if (colMap.code === -1 && (!colMap.syntheticCodeCols || colMap.syntheticCodeCols.length === 0)) {
    throw new Error('Colonne "Code" introuvable dans l\'en-tête')
  }
  if (colMap.labelFr === -1 && colMap.labelNl === -1) {
    throw new Error('Au moins une colonne "Description française" ou "néerlandaise" requise')
  }

  result.totalRows = rows.length - headerIndex - 1
  type Row = Omit<PreparedLookupEntry, 'existingId'> & { sourceRow: number }
  const parsedEntries: Row[] = []
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    try {
      const code = colMap.code >= 0
        ? (row[colMap.code] ?? '').trim()
        : buildSyntheticCode(row, colMap.syntheticCodeCols ?? [])
      if (!code) {
        if (row.some((cell) => cell.trim() !== '')) {
          result.errors.push({ row: i + 1, message: 'Code vide dans une ligne de données' })
        }
        continue
      }
      const labelFr = colMap.labelFr >= 0 ? (row[colMap.labelFr] ?? '').trim() : ''
      const labelNl = colMap.labelNl >= 0 ? (row[colMap.labelNl] ?? '').trim() : ''
      if (!labelFr && !labelNl) throw new Error('Description française et néerlandaise vides')
      const metadata: Record<string, string> = {}
      for (const col of colMap.metadataCols) {
        const value = (row[col.index] ?? '').trim()
        if (value) metadata[col.header] = value
      }
      parsedEntries.push({
        code, labelFr, labelNl,
        labelDe: colMap.labelDe >= 0 ? (row[colMap.labelDe] ?? '').trim() || null : null,
        labelEn: colMap.labelEn >= 0 ? (row[colMap.labelEn] ?? '').trim() || null : null,
        validFrom: colMap.validFrom >= 0 ? parseDate(row[colMap.validFrom])?.toISOString() ?? null : null,
        validUntil: colMap.validUntil >= 0 ? parseDate(row[colMap.validUntil])?.toISOString() ?? null : null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        sourceRow: i + 1,
      })
    } catch (err) {
      result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : String(err) })
    }
  }

  const dedupMap = new Map<string, Row>()
  for (const entry of parsedEntries) {
    const key = entryKey(entry)
    const previous = dedupMap.get(key)
    if (!previous) {
      dedupMap.set(key, entry)
      continue
    }
    if (!sameParsedEntry(previous, entry)) {
      result.errors.push({ row: entry.sourceRow, message: `Doublon contradictoire pour ${entry.code} et sa date de début (ligne ${previous.sourceRow})` })
    }
  }

  const existingRows: LookupEntrySnapshot[] = existingRowsOverride ?? []
  if (!existingRowsOverride) {
    let cursor: string | undefined
    while (true) {
      const chunk = await withDbRetry(() => prisma.lookupEntry.findMany({
        where: { tableId },
        orderBy: { id: 'asc' },
        take: 1000,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true, code: true, validFrom: true, validUntil: true,
          labelFr: true, labelNl: true, labelDe: true, labelEn: true, metadata: true,
        },
      }))
      if (chunk.length === 0) break
      existingRows.push(...chunk)
      cursor = chunk[chunk.length - 1].id
      if (chunk.length < 1000) break
    }
  }
  const existingMap = new Map(existingRows.map((entry) => [entryKey(entry), entry]))
  const seen = new Set<string>()
  for (const entry of dedupMap.values()) {
    const key = entryKey(entry)
    seen.add(key)
    const existing = existingMap.get(key)
    result.entries.push({
      code: entry.code, labelFr: entry.labelFr, labelNl: entry.labelNl,
      labelDe: entry.labelDe, labelEn: entry.labelEn, validFrom: entry.validFrom,
      validUntil: entry.validUntil, metadata: entry.metadata, existingId: existing?.id ?? null,
    })
    if (!existing) {
      result.diff.added.push({
        code: entry.code,
        newLabelFr: entry.labelFr,
        newLabelNl: entry.labelNl,
        newLabelDe: entry.labelDe,
        newLabelEn: entry.labelEn,
        newValidFrom: entry.validFrom,
        newValidUntil: entry.validUntil,
        newMetadata: entry.metadata,
      })
    } else if (!sameExistingEntry(existing, entry)) {
      const changedFields = [
        ...(existing.labelFr !== entry.labelFr ? ['labelFr'] : []),
        ...(existing.labelNl !== entry.labelNl ? ['labelNl'] : []),
        ...(existing.labelDe !== entry.labelDe ? ['labelDe'] : []),
        ...(existing.labelEn !== entry.labelEn ? ['labelEn'] : []),
        ...(!sameDate(existing.validUntil, entry.validUntil ? new Date(entry.validUntil) : null) ? ['validUntil'] : []),
        ...(!sameMetadata(existing.metadata, entry.metadata) ? ['metadata'] : []),
      ]
      result.diff.modified.push({
        code: entry.code,
        oldLabelFr: existing.labelFr,
        newLabelFr: entry.labelFr,
        oldLabelNl: existing.labelNl,
        newLabelNl: entry.labelNl,
        oldLabelDe: existing.labelDe,
        newLabelDe: entry.labelDe,
        oldLabelEn: existing.labelEn,
        newLabelEn: entry.labelEn,
        oldValidFrom: existing.validFrom?.toISOString() ?? null,
        newValidFrom: entry.validFrom,
        oldValidUntil: existing.validUntil?.toISOString() ?? null,
        newValidUntil: entry.validUntil,
        oldMetadata: existing.metadata,
        newMetadata: entry.metadata,
        changedFields,
      })
    }
  }
  for (const [key, existing] of existingMap) {
    if (seen.has(key)) continue
    result.diff.absentFromExport.push({
      code: existing.code,
      oldLabelFr: existing.labelFr,
      oldLabelNl: existing.labelNl,
      oldLabelDe: existing.labelDe,
      oldLabelEn: existing.labelEn,
      oldValidFrom: existing.validFrom?.toISOString() ?? null,
      oldValidUntil: existing.validUntil?.toISOString() ?? null,
      oldMetadata: existing.metadata,
    })
  }
  return result
}

export function hashLookupValue(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}

function entryKey(entry: { code: string; validFrom: Date | string | null }): string {
  const from = entry.validFrom instanceof Date ? entry.validFrom.toISOString() : entry.validFrom
  return `${entry.code}::${from ?? 'null'}`
}

function sameParsedEntry(a: object, b: object): boolean {
  const omit = (value: object) => Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'sourceRow')
  )
  return stableJson(omit(a)) === stableJson(omit(b))
}

function sameExistingEntry(
  existing: { labelFr: string; labelNl: string; labelDe: string | null; labelEn: string | null; validUntil: Date | null; metadata: Prisma.JsonValue | null },
  incoming: { labelFr: string; labelNl: string; labelDe: string | null; labelEn: string | null; validUntil: string | null; metadata: Record<string, string> | null },
): boolean {
  return existing.labelFr === incoming.labelFr &&
    existing.labelNl === incoming.labelNl &&
    existing.labelDe === incoming.labelDe &&
    existing.labelEn === incoming.labelEn &&
    sameDate(existing.validUntil, incoming.validUntil ? new Date(incoming.validUntil) : null) &&
    sameMetadata(existing.metadata, incoming.metadata)
}

function stableJson(value: unknown): string {
  const normalize = (current: unknown): unknown => {
    if (current instanceof Date) return current.toISOString()
    if (Array.isArray(current)) return current.map(normalize)
    if (current && typeof current === 'object') {
      return Object.fromEntries(Object.entries(current as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalize(child)]))
    }
    return current
  }
  return JSON.stringify(normalize(value))
}

interface ColumnMap {
  code: number
  labelFr: number
  labelNl: number
  labelDe: number
  labelEn: number
  validFrom: number
  validUntil: number
  // Pour les tables sans colonne "Code" : indices des colonnes à concaténer
  // pour former une clé synthétique (ex: Année + Communauté pour SchoolHolidayPeriod).
  syntheticCodeCols?: number[]
  // Indices des colonnes "supplémentaires" qui ne sont pas dans le mapping standard.
  // Stockées dans LookupEntry.metadata en clé:valeur, leur clé étant le nom de la
  // colonne du CSV (ex: "Téléphone", "Code INS", "IBAN", "Stat BZ"…).
  // Permet de capturer tout le richesse du CSV ONEM sans schéma rigide.
  metadataCols: { index: number; header: string }[]
}

/**
 * Cherche l'index de la ligne d'en-tête dans un CSV ONEM. Scanne les 20
 * premières lignes à la recherche d'une cellule commençant par "code".
 */
export function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i]
    // Signal principal : cellule "Code..." en premier
    const hasCode = row.some((c) => /^code\b/i.test((c ?? '').trim()))
    if (hasCode) return i
    // Signal alternatif : tables sans colonne Code (ex: SchoolHolidayPeriod,
    // VerifCompensatoryRestDay) qui ont "Année" + "Date de début"
    const lowered = row.map((c) => (c ?? '').toLowerCase().trim())
    const hasYear = lowered.some((c) => /^ann.e\b/.test(c))
    const hasStartDate = lowered.some((c) => /date.*d.but/.test(c))
    if (hasYear && hasStartDate) return i
  }
  return -1
}

export function detectColumns(header: string[]): ColumnMap {
  const map: ColumnMap = {
    code: -1,
    labelFr: -1,
    labelNl: -1,
    labelDe: -1,
    labelEn: -1,
    validFrom: -1,
    validUntil: -1,
    metadataCols: [],
  }
  header.forEach((cell, idx) => {
    const lower = (cell ?? '').toLowerCase().trim()
    if (!lower) return
    // "code" ou variantes ("code numéro de reconnaissance", "code postal" etc.)
    if (map.code === -1 && /^code\b/.test(lower)) map.code = idx
    else if (
      map.validFrom === -1 &&
      /(date.*d.but|date d.but|begindatum|begin datum)/.test(lower)
    ) {
      map.validFrom = idx
    } else if (
      map.validUntil === -1 &&
      /(date.*fin|einddatum|eind datum)/.test(lower)
    ) {
      map.validUntil = idx
    } else if (
      map.labelFr === -1 &&
      // ONEM utilise "Description française", "Desc FR" ou "Nom"
      /(description.*fran|beschrijving.*frans|french|francais|^desc\s+fr$)/.test(lower)
    ) {
      map.labelFr = idx
    } else if (
      map.labelNl === -1 &&
      /(description.*n.erland|beschrijving.*nederlands|dutch|nederlands|^desc\s+nl$)/.test(lower)
    ) {
      map.labelNl = idx
    } else if (
      map.labelDe === -1 &&
      /(description.*allemand|beschrijving.*duits|^desc\s+de$|german|deutsch)/.test(lower)
    ) {
      map.labelDe = idx
    } else if (
      map.labelEn === -1 &&
      /(description.*anglais|beschrijving.*engels|^desc\s+en$|english|anglais)/.test(lower)
    ) {
      map.labelEn = idx
    }
  })
  // Fallback : si pas de description FR/NL trouvée mais une colonne "Nom" existe (cas
  // ShelteredWorkshop, Bureau, etc.), on l'utilise comme labelFr.
  if (map.labelFr === -1 && map.labelNl === -1) {
    header.forEach((cell, idx) => {
      const lower = (cell ?? '').toLowerCase().trim()
      if (map.labelFr === -1 && /^(nom|naam|name)$/.test(lower)) {
        map.labelFr = idx
      }
    })
  }
  // Fallback 2 : tables de paramétrage (BCPost, PostalCode) qui n'ont pas de description
  // bilingue. On prend la première colonne texte significative comme labelFr.
  // Heuristique : on saute Code, dates, "Dernière modification", lookup_label_*.
  if (map.labelFr === -1 && map.labelNl === -1) {
    for (let i = 0; i < header.length; i++) {
      const lower = (header[i] ?? '').toLowerCase().trim()
      if (!lower) continue
      if (i === map.code) continue
      if (i === map.validFrom || i === map.validUntil) continue
      // On saute "Date de début/fin" et "Dernière modification" mais on accepte
      // "Dates" (pluriel, ex: VerifCompensatoryRestDay) qui contient la donnée principale
      if (/^date\s+de\b|^modification|^derni.re|lookup_label/i.test(lower)) continue
      map.labelFr = i
      break
    }
  }

  // Fallback 3 : tables sans colonne "Code" (ex: SchoolHolidayPeriod,
  // VerifCompensatoryRestDay). On synthétise une clé en concaténant toutes les
  // colonnes texte non-date-borne / non-description / non-modif.
  // On exclut "Date de début/fin" mais pas "Dates" (plural — souvent une donnée).
  if (map.code === -1) {
    const syntheticCols: number[] = []
    for (let i = 0; i < header.length; i++) {
      const lower = (header[i] ?? '').toLowerCase().trim()
      if (!lower) continue
      if (i === map.labelFr || i === map.labelNl) continue
      if (i === map.validFrom || i === map.validUntil) continue
      if (/^date\s+(de|d')|modification|description|lookup_label/i.test(lower)) continue
      syntheticCols.push(i)
    }
    if (syntheticCols.length > 0) {
      map.syntheticCodeCols = syntheticCols
    }
  }

  // Détection des colonnes "supplémentaires" : tout ce qui n'est pas déjà mappé
  // (code, labels, dates, dernière modification) devient candidat à `metadata`.
  // On déduplique les en-têtes en double (ex: BCPost a 2× "FR") en suffixant.
  const seenHeaders = new Map<string, number>()
  const usedIndexes = new Set([
    map.code,
    map.labelFr,
    map.labelNl,
    map.labelDe,
    map.labelEn,
    map.validFrom,
    map.validUntil,
    ...(map.syntheticCodeCols ?? []),
  ])
  for (let i = 0; i < header.length; i++) {
    if (usedIndexes.has(i)) continue
    const raw = (header[i] ?? '').trim()
    if (!raw) continue
    // On exclut les colonnes purement techniques sans intérêt utilisateur
    if (/^lookup_label/i.test(raw)) continue
    // Déduplication
    const seen = seenHeaders.get(raw) ?? 0
    seenHeaders.set(raw, seen + 1)
    const headerName = seen === 0 ? raw : `${raw} (${seen + 1})`
    map.metadataCols.push({ index: i, header: headerName })
  }
  return map
}

/**
 * Construit un code synthétique à partir d'une ligne et d'une liste d'index de
 * colonnes. Utilisé pour les tables sans Code naturel (ex: SchoolHolidayPeriod).
 */
function buildSyntheticCode(row: string[], cols: number[]): string {
  return cols
    .map((i) => (row[i] ?? '').trim())
    .filter(Boolean)
    .join('|')
}

/**
 * Parser CSV léger. Gère :
 *  - séparateurs ; (export Excel BE par défaut) et ,
 *  - guillemets pour échapper le séparateur
 *  - guillemets doublés à l'intérieur
 *  - encodage UTF-8 (BOM strippé en amont par caller si besoin)
 */
export function parseCsv(content: string): string[][] {
  // Strip BOM
  const text = content.replace(/^﻿/, '')
  // Détection robuste du séparateur :
  //  1. Sur les ~10 premières lignes (avant les data), compter les occurrences de ; et ,
  //  2. Si ; apparaît dans plus de lignes que ,, on prend ; (cas ONEM standard)
  //  3. Sinon , (CSV US)
  // Cette heuristique évite le piège des CSV ONEM dont une colonne contient
  // des listes de valeurs séparées par ", " (ex: VerifCompensatoryRestDay).
  const headLines = text.split(/\r?\n/, 12)
  let semiLines = 0
  let commaLines = 0
  for (const line of headLines) {
    if (line.includes(';')) semiLines++
    if (line.includes(',')) commaLines++
  }
  const sep = semiLines >= commaLines ? ';' : ','

  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === sep) {
        current.push(field)
        field = ''
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++
        current.push(field)
        field = ''
        if (current.some((v) => v.trim() !== '')) rows.push(current)
        current = []
      } else {
        field += c
      }
    }
  }
  // Last field/row
  if (field !== '' || current.length > 0) {
    current.push(field)
    if (current.some((v) => v.trim() !== '')) rows.push(current)
  }

  return rows
}

function parseDate(raw: string | undefined | null): Date | null {
  if (!raw) return null
  const cleaned = String(raw).trim()
  if (!cleaned) return null
  // Format ONEM : "DD/MM/YYYY"
  const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) throw new Error(`Date invalide: ${cleaned}`)
  const day = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  let year = parseInt(m[3], 10)
  if (year < 100) year += 2000
  if (day < 1 || day > 31 || month < 1 || month > 12) throw new Error(`Date invalide: ${cleaned}`)
  const d = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== day || d.getUTCMonth() !== month - 1 || d.getUTCFullYear() !== year) {
    throw new Error(`Date invalide: ${cleaned}`)
  }
  return d
}

function sameDate(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return a.getTime() === b.getTime()
}

/**
 * Compare deux objets de métadonnées (côté DB stocké en Json, côté parser en
 * `Record<string,string>`). On accepte que la DB renvoie `null` ou
 * `Prisma.JsonNull` quand il n'y a rien.
 */
function sameMetadata(
  a: Prisma.JsonValue | null,
  b: Record<string, string> | null
): boolean {
  const normA = a && typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, unknown>) : null
  if (!normA && !b) return true
  if (!normA || !b) return false
  const aKeys = Object.keys(normA)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (normA[k] !== b[k]) return false
  }
  return true
}

// Suppress unused warning for REQUIRED_HEADERS (kept as documentation)
void REQUIRED_HEADERS
