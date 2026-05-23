import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import { invalidateLookupCache } from './getLookupEntry'

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
}

export interface LookupImportDiff {
  added: LookupDiffEntry[]      // Nouveaux codes
  modified: LookupDiffEntry[]   // Codes existants avec labels changés
  expired: LookupDiffEntry[]    // Codes qui ne sont plus dans le CSV (validUntil ajoutée)
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
  const result: ImportLookupCsvResult = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
    totalRows: 0,
    diff: { added: [], modified: [], expired: [] },
  }

  const table = await withDbRetry(() =>
    prisma.lookupTable.findUnique({ where: { id: input.tableId } })
  )
  if (!table) throw new Error('Table de lookup introuvable')

  const rows = parseCsv(input.csvContent)
  if (rows.length === 0) {
    throw new Error('CSV vide ou non parsable')
  }

  // Les exports ONEM préfixent le CSV de 5 lignes de métadonnées (titre, date,
  // "Critères de recherche", filtres). On cherche la ligne d'en-tête réelle :
  // la première ligne dont une cellule commence par "code".
  const headerIndex = findHeaderRow(rows)
  if (headerIndex === -1) {
    throw new Error('Colonne "Code" introuvable dans l\'en-tête')
  }
  const header = rows[headerIndex]
  const colMap = detectColumns(header)
  // Pas de colonne Code → on accepte si on a un jeu de colonnes synthétiques
  if (colMap.code === -1 && (!colMap.syntheticCodeCols || colMap.syntheticCodeCols.length === 0)) {
    throw new Error('Colonne "Code" introuvable dans l\'en-tête')
  }
  if (colMap.labelFr === -1 && colMap.labelNl === -1) {
    throw new Error('Au moins une colonne "Description française" ou "néerlandaise" requise')
  }

  result.totalRows = rows.length - headerIndex - 1

  // Étape 1 : extraire et valider toutes les lignes en mémoire
  interface ParsedEntry {
    code: string
    labelFr: string
    labelNl: string
    labelDe: string | null
    labelEn: string | null
    validFrom: Date | null
    validUntil: Date | null
    metadata: Record<string, string> | null
    rowIndex: number
  }
  const parsedEntries: ParsedEntry[] = []
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    try {
      // Code : soit colonne dédiée, soit synthétique (concat de plusieurs colonnes)
      let code: string
      if (colMap.code >= 0) {
        code = (row[colMap.code] ?? '').trim()
      } else if (colMap.syntheticCodeCols && colMap.syntheticCodeCols.length > 0) {
        code = buildSyntheticCode(row, colMap.syntheticCodeCols)
      } else {
        continue
      }
      if (!code) continue
      const labelFr = colMap.labelFr >= 0 ? (row[colMap.labelFr] ?? '').trim() : ''
      const labelNl = colMap.labelNl >= 0 ? (row[colMap.labelNl] ?? '').trim() : ''
      const labelDeRaw = colMap.labelDe >= 0 ? (row[colMap.labelDe] ?? '').trim() : ''
      const labelEnRaw = colMap.labelEn >= 0 ? (row[colMap.labelEn] ?? '').trim() : ''
      const labelDe = labelDeRaw || null
      const labelEn = labelEnRaw || null
      const validFrom = colMap.validFrom >= 0 ? parseDate(row[colMap.validFrom]) : null
      const validUntil = colMap.validUntil >= 0 ? parseDate(row[colMap.validUntil]) : null
      // Métadonnées spécifiques à la table (téléphone, IBAN, BC, code INS…)
      // collectées depuis les colonnes non standards. On omet les valeurs vides
      // pour ne pas polluer le JSON.
      let metadata: Record<string, string> | null = null
      if (colMap.metadataCols.length > 0) {
        const collected: Record<string, string> = {}
        for (const col of colMap.metadataCols) {
          const value = (row[col.index] ?? '').trim()
          if (value) collected[col.header] = value
        }
        if (Object.keys(collected).length > 0) metadata = collected
      }
      parsedEntries.push({
        code, labelFr, labelNl, labelDe, labelEn,
        validFrom, validUntil, metadata, rowIndex: i + 1,
      })
    } catch (err) {
      result.errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Étape 2 : déduplication par (code, validFrom) AVANT envoi DB.
  // Certains CSV ONEM contiennent des doublons (ex: BCPost a plusieurs lignes
  // pour le même code postal). On garde la dernière version trouvée.
  const dedupMap = new Map<string, ParsedEntry>()
  for (const entry of parsedEntries) {
    const key = `${entry.code}::${entry.validFrom?.toISOString() ?? 'null'}`
    dedupMap.set(key, entry)
  }
  const uniqueEntries = [...dedupMap.values()]

  // Étape 3 : charger les entrées existantes en UNE SEULE requête
  const existingRows = await withDbRetry(() =>
    prisma.lookupEntry.findMany({
      where: { tableId: input.tableId },
      select: {
        id: true, code: true, validFrom: true, validUntil: true,
        labelFr: true, labelNl: true, labelDe: true, labelEn: true,
        metadata: true,
      },
    })
  )
  const existingMap = new Map<string, (typeof existingRows)[number]>()
  for (const row of existingRows) {
    const key = `${row.code}::${row.validFrom?.toISOString() ?? 'null'}`
    existingMap.set(key, row)
  }

  // Étape 4 : séparer insert vs update vs unchanged
  const toInsert: Array<{
    tableId: string
    code: string
    labelFr: string
    labelNl: string
    labelDe: string | null
    labelEn: string | null
    validFrom: Date | null
    validUntil: Date | null
    metadata: Record<string, string> | null
  }> = []
  const toUpdate: Array<{
    id: string
    labelFr: string
    labelNl: string
    labelDe: string | null
    labelEn: string | null
    validUntil: Date | null
    metadata: Record<string, string> | null
  }> = []

  for (const entry of uniqueEntries) {
    const key = `${entry.code}::${entry.validFrom?.toISOString() ?? 'null'}`
    const existing = existingMap.get(key)
    if (!existing) {
      toInsert.push({
        tableId: input.tableId,
        code: entry.code,
        labelFr: entry.labelFr,
        labelNl: entry.labelNl,
        labelDe: entry.labelDe,
        labelEn: entry.labelEn,
        validFrom: entry.validFrom,
        validUntil: entry.validUntil,
        metadata: entry.metadata,
      })
      result.diff.added.push({
        code: entry.code,
        newLabelFr: entry.labelFr,
        newLabelNl: entry.labelNl,
      })
    } else if (
      existing.labelFr !== entry.labelFr ||
      existing.labelNl !== entry.labelNl ||
      existing.labelDe !== entry.labelDe ||
      existing.labelEn !== entry.labelEn ||
      !sameDate(existing.validUntil, entry.validUntil) ||
      !sameMetadata(existing.metadata, entry.metadata)
    ) {
      toUpdate.push({
        id: existing.id,
        labelFr: entry.labelFr,
        labelNl: entry.labelNl,
        labelDe: entry.labelDe,
        labelEn: entry.labelEn,
        validUntil: entry.validUntil,
        metadata: entry.metadata,
      })
      result.diff.modified.push({
        code: entry.code,
        oldLabelFr: existing.labelFr,
        newLabelFr: entry.labelFr,
        oldLabelNl: existing.labelNl,
        newLabelNl: entry.labelNl,
      })
    } else {
      result.unchanged++
    }
  }

  // Détection des entrées présentes en DB mais absentes du CSV (= expirées)
  const csvKeys = new Set(uniqueEntries.map((e) => `${e.code}::${e.validFrom?.toISOString() ?? 'null'}`))
  for (const [k, existing] of existingMap) {
    if (csvKeys.has(k)) continue
    // L'entrée est en DB mais pas dans le CSV. On ne la supprime PAS automatiquement
    // (on conserve l'historique), juste flag pour info.
    result.diff.expired.push({
      code: existing.code,
      oldLabelFr: existing.labelFr,
      oldLabelNl: existing.labelNl,
    })
  }

  // Étape 5 : insertion en batch (createMany — 1 query par chunk de 500).
  // Prisma exige le sentinel Prisma.JsonNull pour stocker `null` dans un Json?,
  // pas le `null` JS (qui voudrait dire « ne pas écrire le champ »).
  const INSERT_CHUNK = 500
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK).map((e) => ({
      tableId: e.tableId,
      code: e.code,
      labelFr: e.labelFr,
      labelNl: e.labelNl,
      labelDe: e.labelDe,
      labelEn: e.labelEn,
      validFrom: e.validFrom,
      validUntil: e.validUntil,
      metadata: e.metadata ?? Prisma.JsonNull,
    }))
    try {
      const created = await withDbRetry(() =>
        prisma.lookupEntry.createMany({ data: chunk, skipDuplicates: true })
      )
      result.inserted += created.count
    } catch (err) {
      // En cas d'échec du batch, on log mais on continue les autres chunks
      result.errors.push({
        row: 0,
        message: `Batch insert ${i}..${i + chunk.length} échec: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  // Étape 6 : updates individuels (rare, seulement les vrais changements)
  for (const u of toUpdate) {
    try {
      await withDbRetry(() =>
        prisma.lookupEntry.update({
          where: { id: u.id },
          data: {
            labelFr: u.labelFr,
            labelNl: u.labelNl,
            labelDe: u.labelDe,
            labelEn: u.labelEn,
            validUntil: u.validUntil,
            metadata: u.metadata ?? Prisma.JsonNull,
          },
        })
      )
      result.updated++
    } catch (err) {
      result.errors.push({
        row: 0,
        message: `Update ${u.id} échec: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  // MAJ métadonnées de la table
  const count = await withDbRetry(() =>
    prisma.lookupEntry.count({ where: { tableId: input.tableId } })
  )
  const updated = await withDbRetry(() =>
    prisma.lookupTable.update({
      where: { id: input.tableId },
      data: {
        entriesCount: count,
        lastImportedAt: new Date(),
        lastImportedBy: input.importedBy ?? null,
        lastImportSource: input.fileName ?? null,
      },
      select: { slug: true },
    })
  )

  // Invalidation du cache mémoire pour cette table
  invalidateLookupCache(updated.slug)

  return result
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
  if (!m) return null
  const day = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  let year = parseInt(m[3], 10)
  if (year < 100) year += 2000
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(d.getTime()) ? null : d
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
