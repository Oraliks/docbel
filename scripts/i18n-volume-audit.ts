// Audit du VOLUME traduisible — combien de mots source faut-il traduire pour
// passer le site en multilingue ? Read-only (findMany + select uniquement).
//
// Compte les mots des champs human-readable de chaque modèle, y compris en
// descendant récursivement dans les blocs JSON du page-builder (props), en
// strippant le HTML et en filtrant le bruit structurel (couleurs, urls, ids…).
//
// Usage :
//   dotenv -e .env.local -- tsx scripts/i18n-volume-audit.ts
//   dotenv -e .env.local -- tsx scripts/i18n-volume-audit.ts --json
//
// NB : estimation (heuristique). Pour un budget, l'ordre de grandeur compte,
// pas le mot près. Source = FR. Cibles par défaut = 7 (NL/DE/EN/AR/TR/RO/BG).

import { prisma, withDbRetry } from '@/lib/prisma'

const TARGET_LANGS = 7 // NL, DE, EN, AR, TR, RO, BG (FR = source)
const asJson = process.argv.includes('--json')

// ---------------------------------------------------------------------------
// Extraction de texte traduisible
// ---------------------------------------------------------------------------

// Clés à ignorer : structure de bloc, styles, refs, ids, codes, médias, enums.
const SKIP_KEYS = new Set([
  // structure page-builder
  'id', 'type', 'style', 'layout', 'advanced', 'responsive', 'props',
  'className', 'class', 'classes', 'customClasses', 'htmlId', 'anchor',
  // styles / valeurs visuelles
  'color', 'backgroundColor', 'bg', 'background', 'borderColor', 'textColor',
  'fill', 'stroke', 'gradient', 'shadow', 'opacity',
  // refs / urls / médias
  'url', 'href', 'src', 'image', 'imageUrl', 'ogImage', 'logoUrl', 'poster',
  'videoUrl', 'embedUrl', 'iconUrl', 'fileId', 'blobUrl', 'downloadUrl', 'sourceUrl',
  // enums / tokens / mise en forme
  'variant', 'size', 'align', 'textAlign', 'justify', 'justifyContent',
  'alignItems', 'direction', 'tag', 'htmlTag', 'format', 'mode', 'position',
  'target', 'rel', 'theme', 'token', 'fontFamily', 'font', 'weight', 'fontWeight',
  'transition', 'animation', 'easing',
  // ids / codes / hashes / techniques
  'slug', 'key', 'code', 'sha256', 'hash', 'contentHash', 'comparisonKey',
  'embedModel', 'model', 'createdBy', 'createdById', 'updatedBy', 'createdAt',
  'updatedAt', 'locale', 'lang', 'language',
  // mots-clés de recherche (à traiter à part, hors budget rédactionnel)
  'tags', 'vocabularyTags', 'searchText', 'searchKeywords', 'keywords',
  // icônes
  'icon', 'iconName', 'emoji',
  // valeur "code" d'une option select (le label, lui, est compté)
  'value',
])

function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
}

function isLikelyNonText(s: string): boolean {
  const t = s.trim()
  if (!t) return true
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return true // couleur hex
  if (/^(https?:)?\/\//.test(t) || t.startsWith('/') || t.startsWith('data:')) return true // url/path/data
  if (/^[a-z0-9_-]{18,}$/i.test(t) && !/\s/.test(t)) return true // cuid / id long
  if (/^\d+(\.\d+)?(px|rem|em|%|vh|vw|pt|deg|ms|s)?$/i.test(t)) return true // nombre / unité css
  if (/^[\d\s.,:;/€$%°+()-]+$/.test(t)) return true // purement numérique/ponctuation (dates, montants)
  if (!/\s/.test(t) && t.length <= 2) return true // token minuscule
  return false
}

function countWords(s: string): number {
  const clean = stripHtml(s).trim()
  if (!clean) return 0
  return clean.split(/\s+/).filter(Boolean).length
}

// Parcourt récursivement strings / arrays / objets. `key` = nom de la propriété
// parente (pour le filtrage SKIP_KEYS).
function extractWords(value: unknown, key?: string): number {
  if (value == null) return 0
  if (typeof value === 'string') {
    if (key && SKIP_KEYS.has(key)) return 0
    if (isLikelyNonText(value)) return 0
    return countWords(value)
  }
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, v) => sum + extractWords(v, key), 0)
  }
  if (typeof value === 'object') {
    let sum = 0
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sum += extractWords(v, k)
    }
    return sum
  }
  return 0 // number, boolean
}

// ---------------------------------------------------------------------------
// Spécifications par modèle (tier, champs traduisibles)
// ---------------------------------------------------------------------------

interface Spec {
  tier: string
  name: string
  fields: string[]
  optional?: boolean // exclu du total "à traduire" (KB IA, proper nouns…)
  note?: string
  fetch: () => Promise<Record<string, unknown>[]>
}

const T1 = 'T1 · Page-builder & contenu riche'
const T2 = 'T2 · Catalogue & données de référence'
const T3 = 'T3 · Lookup / barèmes (déjà partiellement multilingue)'
const T4 = 'T4 · IA / proper nouns (optionnel)'

const specs: Spec[] = [
  // ---- T1 : le gros morceau ----
  {
    tier: T1, name: 'Page', fields: ['title', 'metaTitle', 'metaDesc', 'content'],
    fetch: () => withDbRetry(() => prisma.page.findMany({
      where: { deletedAt: null },
      select: { title: true, metaTitle: true, metaDesc: true, content: true },
    })),
  },
  {
    tier: T1, name: 'GlobalBlock', fields: ['name', 'block'],
    fetch: () => withDbRetry(() => prisma.globalBlock.findMany({ select: { name: true, block: true } })),
  },
  {
    tier: T1, name: 'Snippet', fields: ['name', 'description', 'block'],
    fetch: () => withDbRetry(() => prisma.snippet.findMany({ select: { name: true, description: true, block: true } })),
  },
  {
    tier: T1, name: 'News', fields: ['title', 'excerpt', 'content', 'category'],
    fetch: () => withDbRetry(() => prisma.news.findMany({ select: { title: true, excerpt: true, content: true, category: true } })),
  },
  {
    tier: T1, name: 'Changelog', fields: ['title', 'description', 'changes'],
    fetch: () => withDbRetry(() => prisma.changelog.findMany({ select: { title: true, description: true, changes: true } })),
  },
  // ---- T2 : catalogue / référence ----
  {
    tier: T2, name: 'Category', fields: ['name'],
    fetch: () => withDbRetry(() => prisma.category.findMany({ select: { name: true } })),
  },
  {
    tier: T2, name: 'ToolSection', fields: ['name', 'description'],
    fetch: () => withDbRetry(() => prisma.toolSection.findMany({ select: { name: true, description: true } })),
  },
  {
    tier: T2, name: 'Tool', fields: ['name', 'description'],
    fetch: () => withDbRetry(() => prisma.tool.findMany({ select: { name: true, description: true } })),
  },
  {
    tier: T2, name: 'CalculatorAsset', fields: ['label', 'description'],
    fetch: () => withDbRetry(() => prisma.calculatorAsset.findMany({ select: { label: true, description: true } })),
  },
  {
    tier: T2, name: 'DocumentBundle', fields: ['name', 'description', 'eligibilityQuestions', 'warnings'],
    fetch: () => withDbRetry(() => prisma.documentBundle.findMany({
      select: { name: true, description: true, eligibilityQuestions: true, warnings: true },
    })),
  },
  {
    tier: T2, name: 'Organisme', fields: ['name', 'shortName', 'description'],
    fetch: () => withDbRetry(() => prisma.organisme.findMany({ select: { name: true, shortName: true, description: true } })),
  },
  {
    tier: T2, name: 'CommissionParitaire', fields: ['nom', 'label'],
    fetch: () => withDbRetry(() => prisma.commissionParitaire.findMany({ select: { nom: true, label: true } })),
  },
  // DocumentTemplate retiré — module legacy supprimé (migration 34), remplacé par PdfForm + DocumentBundle.
  {
    tier: T2, name: 'PdfForm', fields: ['title', 'description', 'issuer', 'fields', 'visualFields'],
    fetch: () => withDbRetry(() => prisma.pdfForm.findMany({
      select: { title: true, description: true, issuer: true, fields: true, visualFields: true },
    })),
  },
  {
    tier: T2, name: 'FieldValidationPreset',
    fields: ['name', 'description', 'defaultLabel', 'errorMsg', 'helpText', 'placeholder', 'defaultOptions'],
    fetch: () => withDbRetry(() => prisma.fieldValidationPreset.findMany({
      select: { name: true, description: true, defaultLabel: true, errorMsg: true, helpText: true, placeholder: true, defaultOptions: true },
    })),
  },
  {
    tier: T2, name: 'PdfFieldPreset', fields: ['label', 'errorMsg', 'helpText'],
    fetch: () => withDbRetry(() => prisma.pdfFieldPreset.findMany({ select: { label: true, errorMsg: true, helpText: true } })),
  },
  {
    tier: T2, name: 'Bureau', fields: ['hoursNotes'], note: 'name/adresse = proper nouns, exclus',
    fetch: () => withDbRetry(() => prisma.bureau.findMany({ select: { hoursNotes: true } })),
  },
  // ---- T3 : lookup / barèmes ----
  {
    tier: T3, name: 'LookupCategory', fields: ['labelFr'],
    fetch: () => withDbRetry(() => prisma.lookupCategory.findMany({ select: { labelFr: true } })),
  },
  {
    tier: T3, name: 'LookupTable', fields: ['labelFr', 'group', 'updatedLabel'],
    fetch: () => withDbRetry(() => prisma.lookupTable.findMany({ select: { labelFr: true, group: true, updatedLabel: true } })),
  },
  {
    tier: T3, name: 'LookupEntry', fields: ['labelFr'], note: 'labelNl/De/En existent déjà en partie',
    fetch: () => withDbRetry(() => prisma.lookupEntry.findMany({ select: { labelFr: true } })),
  },
  {
    tier: T3, name: 'BaremeAmount', fields: ['labelFr'],
    fetch: () => withDbRetry(() => prisma.baremeAmount.findMany({ select: { labelFr: true } })),
  },
  // ---- T4 : optionnel (exclu du total principal) ----
  {
    tier: T4, name: 'KnowledgeSource', fields: ['title', 'content', 'summary'], optional: true,
    note: 'KB IA — traduisible à la volée par Claude + ré-embeddings si traduite',
    fetch: () => withDbRetry(() => prisma.knowledgeSource.findMany({ select: { title: true, content: true, summary: true } })),
  },
  {
    tier: T4, name: 'U1Institution', fields: ['organization', 'department', 'alternateName'], optional: true,
    note: 'noms d\'institutions étrangères — généralement non traduits',
    fetch: () => withDbRetry(() => prisma.u1Institution.findMany({ select: { organization: true, department: true, alternateName: true } })),
  },
]

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

interface Row { tier: string; name: string; records: number; words: number; optional: boolean; note?: string }

async function main() {
  const rows: Row[] = []

  for (const spec of specs) {
    try {
      const data = await spec.fetch()
      let words = 0
      for (const rec of data) {
        for (const f of spec.fields) words += extractWords(rec[f], f)
      }
      rows.push({ tier: spec.tier, name: spec.name, records: data.length, words, optional: !!spec.optional, note: spec.note })
    } catch (err) {
      rows.push({ tier: spec.tier, name: spec.name, records: -1, words: 0, optional: !!spec.optional, note: `ERREUR: ${(err as Error).message}` })
    }
  }

  const nf = new Intl.NumberFormat('fr-BE')
  const coreWords = rows.filter((r) => !r.optional).reduce((s, r) => s + r.words, 0)
  const optionalWords = rows.filter((r) => r.optional).reduce((s, r) => s + r.words, 0)

  if (asJson) {
    console.log(JSON.stringify({ targetLangs: TARGET_LANGS, rows, coreWords, optionalWords }, null, 2))
  } else {
    const tiers = [T1, T2, T3, T4]
    console.log('\n═══════════════════════════════════════════════════════════════════')
    console.log('  AUDIT DU VOLUME TRADUISIBLE — mots source (FR) par modèle')
    console.log('═══════════════════════════════════════════════════════════════════\n')
    for (const tier of tiers) {
      const tierRows = rows.filter((r) => r.tier === tier)
      if (!tierRows.length) continue
      const tierWords = tierRows.reduce((s, r) => s + r.words, 0)
      console.log(`▸ ${tier}`)
      for (const r of tierRows) {
        const rec = r.records < 0 ? 'ERR' : nf.format(r.records)
        const line = `    ${r.name.padEnd(24)} ${rec.padStart(8)} rec  ${nf.format(r.words).padStart(10)} mots`
        console.log(r.note ? `${line}   — ${r.note}` : line)
      }
      console.log(`    ${'└ sous-total'.padEnd(24)} ${''.padStart(8)}      ${nf.format(tierWords).padStart(10)} mots\n`)
    }

    console.log('───────────────────────────────────────────────────────────────────')
    console.log(`  MOTS SOURCE À TRADUIRE (hors optionnel T4) : ${nf.format(coreWords)}`)
    console.log(`  + optionnel T4 (KB IA, proper nouns)       : ${nf.format(optionalWords)}`)
    console.log('───────────────────────────────────────────────────────────────────\n')

    const targetWords = coreWords * TARGET_LANGS
    console.log(`  × ${TARGET_LANGS} langues cibles = ${nf.format(targetWords)} mots cibles\n`)
    console.log('  Projection budget (mots cibles × tarif/mot) :')
    const bands: [string, number][] = [
      ['IA + relecture légère (spot-check)', 0.02],
      ['IA + relecture pro (AR/TR/BG/RO)', 0.05],
      ['Traduction pro humaine (sans IA)', 0.10],
    ]
    for (const [label, rate] of bands) {
      console.log(`    ${label.padEnd(38)} ≈ ${nf.format(Math.round(targetWords * rate))} €`)
    }
    console.log('\n  (UI hardcodée — boutons/toasts/validation — NON comptée ici :')
    console.log('   ~1200-1900 strings, mesurées par analyse statique du code.)\n')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
