/**
 * Contrôle EXTERNE des barèmes ONEM (à distinguer du diff interne en DB de
 * `compareBaremeVersions.ts`).
 *
 * Découverte d'audit : le hub https://www.onem.be/documentation/montants publie
 * le workbook Excel COMPLET (`barema-new-DDMMYYYY.xlsx`) à une URL
 * content-addressed (hash dans le chemin) + cache immutable. C'est très
 * probablement le MÊME fichier que celui importé en interne. Deux contrôles en
 * découlent :
 *
 *   1. DIFF FICHIER ↔ FICHIER — télécharger le xlsx publié et le comparer
 *      cellule par cellule à notre version AVANT import (`diffXlsxBuffers`,
 *      `compareWithPublishedOnem`). Détecte toute divergence de contenu, pas
 *      seulement sur les montants parsés (libellés, dates, colonnes, feuilles).
 *
 *   2. WATCH DU HUB — l'URL étant content-addressed, un changement d'URL =
 *      nouveau barème publié (`fetchLatestOnemBaremeUrl`,
 *      `checkOnemForNewBareme`). On compare l'URL courante du hub à la dernière
 *      connue.
 *
 * Le CŒUR (1) est PUR et testable hors ligne (parse deux Buffers). La partie
 * web (2) est best-effort : tout passe par try/catch et retourne null si le
 * réseau est bloqué — JAMAIS de throw vers l'appelant (cron / route).
 *
 * Où brancher le watch : voir le bloc de doc de `checkOnemForNewBareme`.
 */

import { parseBaremaFile, type ParsedSheet } from '@/lib/baremes-parser'
import { extractValidFromFileName } from './normalize'

/* ------------------------------------------------------------------ */
/*  1. DIFF XLSX ↔ XLSX  (cœur pur, testable hors ligne)              */
/* ------------------------------------------------------------------ */

/** Une cellule qui diffère entre les deux fichiers. */
export interface XlsxCellDiff {
  /** Nom de la feuille (identique des deux côtés). */
  sheet: string
  /** Référence Excel A1 de la cellule (ex: "H14"). */
  cell: string
  /** Ligne 0-based dans la grille `cellData`. */
  rowIndex: number
  /** Colonne 0-based dans la grille `cellData`. */
  colIndex: number
  /** Valeur (string normalisée par parseBaremaFile) côté NOTRE fichier. */
  ours: string
  /** Valeur côté fichier ONEM publié. */
  theirs: string
}

/** Diff d'une feuille présente des DEUX côtés. */
export interface XlsxSheetDiff {
  sheet: string
  /** Nombre total de cellules qui diffèrent (peut dépasser la taille de l'échantillon). */
  diffCount: number
  /** Vrai si la grille n'a pas les mêmes dimensions (lignes/colonnes). */
  dimensionsDiffer: boolean
  oursRows: number
  theirsRows: number
  oursCols: number
  theirsCols: number
  /** Échantillon plafonné des cellules divergentes (pour l'UI/diagnostic). */
  sample: XlsxCellDiff[]
}

/** Résultat complet d'un diff de deux workbooks. */
export interface XlsxDiff {
  /** true si AUCUNE divergence (feuilles + cellules identiques). */
  identical: boolean
  /** Feuilles présentes UNIQUEMENT dans notre fichier. */
  onlyInOurs: string[]
  /** Feuilles présentes UNIQUEMENT dans le fichier ONEM. */
  onlyInTheirs: string[]
  /** Feuilles communes ayant au moins une cellule différente. */
  changedSheets: XlsxSheetDiff[]
  /** Feuilles communes strictement identiques (noms seulement). */
  unchangedSheets: string[]
  counts: {
    /** Feuilles communes aux deux fichiers. */
    commonSheets: number
    onlyInOurs: number
    onlyInTheirs: number
    changedSheets: number
    /** Somme des `diffCount` de toutes les feuilles communes. */
    changedCells: number
  }
}

/** Nombre max de cellules divergentes conservées PAR FEUILLE (anti-explosion). */
const MAX_CELL_SAMPLE_PER_SHEET = 50

/** Nombre max de feuilles "changed" détaillées (les compteurs restent exhaustifs). */
const MAX_CHANGED_SHEETS = 100

/**
 * Compare deux workbooks Excel cellule par cellule.
 *
 * `ours`   = notre fichier (importé / sur disque).
 * `theirs` = le fichier publié par l'ONEM (téléchargé du hub).
 *
 * Les deux sont parsés via `parseBaremaFile` pour réutiliser EXACTEMENT la même
 * normalisation que l'import (dates ISO non ambiguës, `.w` formaté, trim des
 * lignes vides finales). On compare donc des valeurs déjà canonicalisées : le
 * diff reflète ce que l'import « voit », pas les octets bruts du zip xlsx
 * (lesquels diffèrent toujours — ordre, métadonnées, compression).
 *
 * PUR : aucune I/O réseau. Sûr à appeler en test.
 *
 * @throws si l'un des buffers n'est pas un xlsx lisible (propagé depuis
 *   parseBaremaFile — l'appelant best-effort doit l'entourer de try/catch).
 */
export function diffXlsxBuffers(ours: Buffer, theirs: Buffer): XlsxDiff {
  const oursParsed = parseBaremaFile(toArrayBuffer(ours))
  const theirsParsed = parseBaremaFile(toArrayBuffer(theirs))

  const oursByName = new Map<string, ParsedSheet>()
  for (const s of oursParsed.sheets) oursByName.set(s.name, s)
  const theirsByName = new Map<string, ParsedSheet>()
  for (const s of theirsParsed.sheets) theirsByName.set(s.name, s)

  const onlyInOurs: string[] = []
  const onlyInTheirs: string[] = []
  const changedSheets: XlsxSheetDiff[] = []
  const unchangedSheets: string[] = []

  for (const name of oursByName.keys()) {
    if (!theirsByName.has(name)) onlyInOurs.push(name)
  }
  for (const name of theirsByName.keys()) {
    if (!oursByName.has(name)) onlyInTheirs.push(name)
  }

  let commonSheets = 0
  let changedCells = 0

  // Itère sur les feuilles communes dans l'ordre de NOTRE fichier (stable).
  for (const sheet of oursParsed.sheets) {
    const theirSheet = theirsByName.get(sheet.name)
    if (!theirSheet) continue
    commonSheets++

    const sheetDiff = diffSheets(sheet, theirSheet)
    changedCells += sheetDiff.diffCount
    if (sheetDiff.diffCount > 0 || sheetDiff.dimensionsDiffer) {
      if (changedSheets.length < MAX_CHANGED_SHEETS) changedSheets.push(sheetDiff)
    } else {
      unchangedSheets.push(sheet.name)
    }
  }

  const identical =
    onlyInOurs.length === 0 &&
    onlyInTheirs.length === 0 &&
    changedSheets.length === 0

  return {
    identical,
    onlyInOurs,
    onlyInTheirs,
    changedSheets,
    unchangedSheets,
    counts: {
      commonSheets,
      onlyInOurs: onlyInOurs.length,
      onlyInTheirs: onlyInTheirs.length,
      changedSheets: changedSheets.length,
      changedCells,
    },
  }
}

/** Compare la grille de deux feuilles de même nom. */
function diffSheets(ours: ParsedSheet, theirs: ParsedSheet): XlsxSheetDiff {
  const oursGrid = ours.cellData
  const theirsGrid = theirs.cellData

  const maxRows = Math.max(oursGrid.length, theirsGrid.length)
  const oursCols = gridWidth(oursGrid)
  const theirsCols = gridWidth(theirsGrid)
  const maxCols = Math.max(oursCols, theirsCols)

  const sample: XlsxCellDiff[] = []
  let diffCount = 0

  for (let r = 0; r < maxRows; r++) {
    const oursRow = oursGrid[r] ?? []
    const theirsRow = theirsGrid[r] ?? []
    for (let c = 0; c < maxCols; c++) {
      // Cellule absente d'un côté = chaîne vide (cohérent avec parseBaremaFile
      // qui pousse '' pour les cellules vides à l'intérieur du range).
      const a = oursRow[c] ?? ''
      const b = theirsRow[c] ?? ''
      if (a === b) continue
      diffCount++
      if (sample.length < MAX_CELL_SAMPLE_PER_SHEET) {
        sample.push({
          sheet: ours.name,
          cell: cellAddress(r, c),
          rowIndex: r,
          colIndex: c,
          ours: a,
          theirs: b,
        })
      }
    }
  }

  return {
    sheet: ours.name,
    diffCount,
    dimensionsDiffer: oursGrid.length !== theirsGrid.length || oursCols !== theirsCols,
    oursRows: oursGrid.length,
    theirsRows: theirsGrid.length,
    oursCols,
    theirsCols,
    sample,
  }
}

function gridWidth(grid: string[][]): number {
  let w = 0
  for (const row of grid) if (row.length > w) w = row.length
  return w
}

/**
 * Référence Excel A1 depuis indices 0-based (r=13,c=7 → "H14").
 * Réimplémenté localement (pas d'import de types.ts) pour garder ce module
 * autonome et son test sans dépendance DB.
 */
function cellAddress(rowIndex0: number, colIndex0: number): string {
  let n = colIndex0
  let letters = ''
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `${letters}${rowIndex0 + 1}`
}

/**
 * Normalise un Buffer Node en ArrayBuffer pour parseBaremaFile (qui accepte un
 * ArrayBuffer). On copie la tranche exacte du Buffer car `.buffer` peut être un
 * pool partagé plus grand que la vue.
 */
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

/* ------------------------------------------------------------------ */
/*  2. WATCH DU HUB ONEM  (best-effort, réseau)                       */
/* ------------------------------------------------------------------ */

/** URL du hub listant les montants/barèmes ONEM (FR). */
export const ONEM_BAREME_HUB_URL = 'https://www.onem.be/documentation/montants'

/** Métadonnées du dernier barème xlsx publié sur le hub. */
export interface OnemBaremeRef {
  /** URL absolue (content-addressed) du fichier .xlsx. */
  url: string
  /** Nom de fichier extrait de l'URL (ex: "barema-new-01042026.xlsx"). */
  fileName: string
  /** Date de validité dérivée du nom de fichier (DDMMYYYY), null si illisible. */
  validFrom: Date | null
}

/** Timeout HTTP du fetch hub (12s, aligné sur la veille existante ~10-15s). */
const HUB_FETCH_TIMEOUT_MS = 12_000

/**
 * Récupère, depuis le hub ONEM, le lien vers le workbook `barema-new-*.xlsx` le
 * plus récent.
 *
 * SÉLECTEUR (volontairement permissif, comme `parseHtmlForLinks` de la veille) :
 *   - On scanne tous les `href="…"` de la page (regex `/href="([^"]+)"/gi`).
 *   - On garde ceux dont le chemin contient `barema` ET se termine par `.xlsx`
 *     (insensible à la casse). Couvre `barema-new-01042026.xlsx`,
 *     `…/barema-01-04-2026.xlsx`, et les URLs hashées qui conservent le nom
 *     d'origine en dernier segment.
 *   - On absolutise via `new URL(href, hub)`.
 *   - On extrait la date du nom via `extractValidFromFileName` (réutilisé de
 *     l'import) et on trie par date décroissante ; à défaut de date, on garde
 *     l'ordre d'apparition (premier match) comme proxy "le plus en vue".
 *
 * Best-effort : retourne `null` sur réseau KO, HTTP non-2xx, ou aucun lien
 * trouvé. Ne throw JAMAIS (sûr dans un cron / route).
 *
 * @param fetchImpl injectable pour les tests (défaut: fetch global). Le test du
 *   module NE l'exerce pas (consigne "ne teste pas le réseau") ; ce paramètre
 *   sert à un futur test d'intégration optionnel.
 */
export async function fetchLatestOnemBaremeUrl(
  fetchImpl: typeof fetch = fetch
): Promise<OnemBaremeRef | null> {
  try {
    const res = await fetchImpl(ONEM_BAREME_HUB_URL, {
      headers: {
        // UA friendly — les sites .be rejettent souvent les UA vides (cf. veille).
        'user-agent': 'BeldocBot/1.0 (+https://beldoc.be ; veille barèmes ONEM)',
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(HUB_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`[onemSync] hub HTTP ${res.status}`)
      return null
    }
    const html = await res.text()
    return extractLatestBaremeRefFromHtml(html, ONEM_BAREME_HUB_URL)
  } catch (err) {
    // Réseau bloqué (sandbox), DNS, timeout… → best-effort, on ne casse rien.
    console.warn(
      '[onemSync] fetch hub échoué (best-effort):',
      err instanceof Error ? err.message : String(err)
    )
    return null
  }
}

/**
 * Cœur PUR du scrape : extrait la ref du barème le plus récent d'un HTML donné.
 *
 * Exporté pour permettre un test hors ligne du SÉLECTEUR (sur un fragment HTML
 * en dur) sans toucher au réseau — le test fourni ne couvre que le diff, mais
 * cette fonction reste testable si besoin.
 */
export function extractLatestBaremeRefFromHtml(
  html: string,
  baseUrl: string
): OnemBaremeRef | null {
  // Cap de taille comme la veille (pages parfois lourdes).
  const sample = html.slice(0, 1_000_000)
  const hrefRe = /href="([^"#]+)"/gi
  const seen = new Set<string>()
  const candidates: OnemBaremeRef[] = []

  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(sample)) !== null) {
    const href = m[1].trim()
    const lower = href.toLowerCase()
    // Doit pointer un xlsx ET mentionner "barema" quelque part dans l'URL.
    if (!lower.endsWith('.xlsx')) continue
    if (!lower.includes('barema')) continue

    let abs: string
    try {
      abs = new URL(href, baseUrl).toString()
    } catch {
      continue
    }
    if (seen.has(abs)) continue
    seen.add(abs)

    const fileName = baremeFileNameFromUrl(abs)
    candidates.push({
      url: abs,
      fileName,
      validFrom: extractValidFromFileName(fileName),
    })
  }

  if (candidates.length === 0) return null

  // Tri : date de validité décroissante d'abord ; les sans-date en dernier mais
  // conservés (ordre d'apparition stable via index).
  candidates.sort((a, b) => {
    const ta = a.validFrom ? a.validFrom.getTime() : -Infinity
    const tb = b.validFrom ? b.validFrom.getTime() : -Infinity
    return tb - ta
  })

  return candidates[0]
}

/** Dernier segment de chemin d'une URL, décodé (= nom de fichier xlsx). */
function baremeFileNameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop() ?? ''
    return decodeURIComponent(last)
  } catch {
    return url.split('/').pop() ?? url
  }
}

/** Résultat d'un check du hub. */
export interface OnemWatchResult {
  /** true si l'URL courante du hub diffère de `lastKnownUrl` (nouveau barème). */
  hasNew: boolean
  /** Ref courante du hub (null si réseau KO / introuvable). */
  latest: OnemBaremeRef | null
  /** L'URL connue passée en entrée (écho, pour log/persistance). */
  lastKnownUrl: string | null
  /**
   * Pourquoi `hasNew` vaut ce qu'il vaut (diagnostic) :
   *  - 'fetch_failed'  : le hub n'a pas pu être lu → hasNew=false (prudent).
   *  - 'first_seen'    : aucune URL connue → on adopte sans alerter (hasNew=false).
   *  - 'unchanged'     : même URL qu'avant.
   *  - 'changed'       : URL différente → nouveau barème publié.
   */
  reason: 'fetch_failed' | 'first_seen' | 'unchanged' | 'changed'
}

/**
 * Surveille le hub : compare l'URL courante du barème ONEM à la dernière connue.
 * Comme l'URL est content-addressed (hash), un changement d'URL ⇒ nouvelle
 * publication.
 *
 * Best-effort (réseau via `fetchLatestOnemBaremeUrl`) — ne throw jamais.
 *
 * OÙ BRANCHER CE WATCH (veille existante) :
 *   La veille ONEM tourne déjà via un cron Vercel :
 *     - route : `app/api/chomage-ia/ingestion/cron/route.ts`
 *       (protégée par CRON_SECRET ; court-circuitée par le setting
 *        CHOMAGE_IA_INGESTION_ENABLED), qui itère les `IngestionSource`
 *        `enabled=true` et appelle `runIngestionCheck` (lib/chomage-ia/ingestion.ts).
 *   Deux options pour accrocher ce watch barèmes (sans modifier le cœur ci-dessus) :
 *     (A) NOUVELLE ROUTE CRON dédiée, ex. `app/api/cron/onem-bareme-watch/route.ts`,
 *         calquée sur ingestion/cron (même `checkCronAuth`). Elle :
 *           1. lit la dernière URL connue (ex. AppSetting clé
 *              `ONEM_BAREME_LAST_URL`, ou la dernière BaremeFile.sourceUrl),
 *           2. `const r = await checkOnemForNewBareme(lastUrl)`,
 *           3. si `r.hasNew`, crée une alerte admin / KnowledgeSource « nouveau
 *              barème ONEM publié » + persiste `r.latest.url` comme nouvelle
 *              référence. C'est l'option la plus propre (séparation des domaines
 *              barèmes vs KB chômage).
 *     (B) PIGGY-BACK : ajouter une `IngestionSource` (kind 'scrape', url = hub)
 *         et étendre le parsing de veille — plus rapide à câbler mais mélange
 *         barèmes et veille KB. Déconseillé.
 *   Ajouter l'entrée correspondante dans `vercel.json` (crons) pour (A).
 *
 * @param lastKnownUrl dernière URL de barème ONEM connue (null au 1er run).
 */
export async function checkOnemForNewBareme(
  lastKnownUrl: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<OnemWatchResult> {
  const latest = await fetchLatestOnemBaremeUrl(fetchImpl)

  if (latest === null) {
    return { hasNew: false, latest: null, lastKnownUrl, reason: 'fetch_failed' }
  }
  if (lastKnownUrl === null || lastKnownUrl === '') {
    // Premier passage : on adopte l'URL courante sans crier au loup.
    return { hasNew: false, latest, lastKnownUrl, reason: 'first_seen' }
  }
  const changed = normalizeUrl(latest.url) !== normalizeUrl(lastKnownUrl)
  return {
    hasNew: changed,
    latest,
    lastKnownUrl,
    reason: changed ? 'changed' : 'unchanged',
  }
}

/** Normalise une URL pour comparaison (ignore fragment + slash final). */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    let s = u.toString()
    if (s.endsWith('/')) s = s.slice(0, -1)
    return s
  } catch {
    return url.trim().replace(/\/+$/, '')
  }
}

/* ------------------------------------------------------------------ */
/*  3. DIFF DE NOTRE FICHIER ↔ L'ONEM PUBLIÉ  (best-effort, réseau)   */
/* ------------------------------------------------------------------ */

/**
 * Télécharge le xlsx ONEM courant (le plus récent du hub) et le diffe contre le
 * nôtre, cellule par cellule.
 *
 * Best-effort sur la partie réseau (download du fichier) : retourne `null` si le
 * hub est injoignable, si l'URL est introuvable, ou si le download échoue. Le
 * diff lui-même (`diffXlsxBuffers`) peut throw si le fichier téléchargé n'est
 * pas un xlsx valide — on l'entoure d'un try/catch ici pour rester best-effort.
 *
 * Résultat enrichi d'`onem` (la ref téléchargée) pour tracer QUELLE version a
 * servi de référence.
 *
 * @param ourBuffer NOTRE fichier (importé / sur disque).
 */
export async function compareWithPublishedOnem(
  ourBuffer: Buffer,
  fetchImpl: typeof fetch = fetch
): Promise<(XlsxDiff & { onem: OnemBaremeRef }) | null> {
  const latest = await fetchLatestOnemBaremeUrl(fetchImpl)
  if (latest === null) return null

  let theirs: Buffer
  try {
    const res = await fetchImpl(latest.url, {
      headers: {
        'user-agent': 'BeldocBot/1.0 (+https://beldoc.be ; contrôle barèmes ONEM)',
        accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(HUB_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`[onemSync] download xlsx HTTP ${res.status}`)
      return null
    }
    const arr = await res.arrayBuffer()
    theirs = Buffer.from(arr)
  } catch (err) {
    console.warn(
      '[onemSync] download xlsx échoué (best-effort):',
      err instanceof Error ? err.message : String(err)
    )
    return null
  }

  try {
    const diff = diffXlsxBuffers(ourBuffer, theirs)
    return { ...diff, onem: latest }
  } catch (err) {
    console.warn(
      '[onemSync] diff du xlsx ONEM échoué (fichier illisible ?):',
      err instanceof Error ? err.message : String(err)
    )
    return null
  }
}
