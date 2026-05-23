// Auto-génère les entrées de seed pour les CSV ONEM non matchés.
// Output : lib/data/lookup-onem-auto-seed.json à fusionner avec le seed principal.
import { readdir, writeFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { extractOnemExportName } from '@/lib/lookup/matchFileName'

const DIR = 'C:/Users/Admin/Downloads/JSON'

// Traductions de mots-clés courants EN → FR pour labels approximatifs
const EN_TO_FR: Record<string, string> = {
  action: 'action',
  activation: 'activation',
  admissibility: 'admissibilité',
  agency: 'agence',
  allowance: 'allocation',
  archiving: 'archivage',
  article: 'article',
  attestation: 'attestation',
  category: 'catégorie',
  certificate: 'certificat',
  child: 'enfants',
  cipher: 'chiffré',
  code: 'code',
  community: 'communauté',
  compensation: 'indemnisation',
  compensatory: 'compensatoire',
  complement: 'complément',
  consequence: 'conséquence',
  context: 'contexte',
  contract: 'contrat',
  day: 'jour',
  debtor: 'débiteur',
  decision: 'décision',
  deduction: 'déduction',
  dispo: 'dispo',
  drs: 'DRS',
  early: 'précoce',
  employment: 'emploi',
  end: 'fin',
  exemption: 'dispense',
  file: 'dossier',
  for: 'pour',
  group: 'groupe',
  holiday: 'vacances',
  identification: 'identification',
  industrial: 'industriel',
  info: 'info',
  introduction: 'introduction',
  job: 'emploi',
  junior: 'jeune',
  law: 'loi',
  like: 'assimilé',
  local: 'local',
  location: 'lieu',
  mandate: 'mandat',
  mandatory: 'obligatoire',
  nationality: 'nationalité',
  nature: 'nature',
  negative: 'négatif',
  noss: 'ONSS',
  offer: 'offre',
  office: 'bureau',
  organism: 'organisme',
  out: 'hors',
  outcome: 'résultat',
  past: 'passé',
  pay: 'paiement',
  payment: 'paiement',
  period: 'période',
  plan: 'plan',
  positive: 'positif',
  prefix: 'préfixe',
  professional: 'professionnel',
  reason: 'raison',
  recovery: 'récupération',
  refugee: 'réfugié',
  region: 'région',
  rejection: 'rejet',
  replacement: 'remplacement',
  rest: 'repos',
  result: 'résultat',
  return: 'retour',
  sanction: 'sanction',
  scale: 'barème',
  school: 'scolaire',
  second: 'deuxième',
  sector: 'secteur',
  senior: 'senior',
  session: 'session',
  sex: 'sexe',
  signaletic: 'signalétique',
  special: 'spéciale',
  standard: 'standard',
  state: 'statut',
  status: 'statut',
  suspension: 'suspension',
  syndical: 'syndicale',
  system: 'système',
  temporary: 'temporaire',
  treatment: 'traitement',
  type: 'type',
  undue: 'indu',
  unemployment: 'chômage',
  uo: 'UO',
  visit: 'visite',
  way: 'mode',
  without: 'sans',
  worker: 'travailleur',
  zone: 'zone',
}

interface SeedTableEntry {
  group?: string
  prefix: string
  slug: string
  labelFr: string
  labelNl: string
  exportName: string
}

function splitCamelCase(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ABBRTest → ABBR Test
    .split(/\s+/)
    .filter(Boolean)
}

function toLabelFr(words: string[]): string {
  return words
    .map((w) => {
      // Tokens connus → traduction; sinon laisser tel quel
      const lower = w.toLowerCase()
      // Préserver les codes administratifs (S01, S04, S38, C9, S31, etc.)
      if (/^[A-Z]\d+/i.test(w) || /^\d+$/.test(w)) return w
      return EN_TO_FR[lower] ?? w
    })
    .join(' ')
    .trim()
}

function detectCategoryAndPrefix(internalName: string): {
  categorySlug: string
  prefix: string
  group?: string
} {
  // Préfixes S\d+ → Signalétique
  const sPrefix = internalName.match(/^(S\d+|A\d+|H\d+)/)
  if (sPrefix) {
    const p = sPrefix[1]
    return { categorySlug: 'signaletic', prefix: p, group: `${p} - Signalétique` }
  }
  if (/^Dispo/.test(internalName)) {
    return { categorySlug: 'dispo', prefix: 'S38', group: 'Dispo' }
  }
  if (/^Verif/.test(internalName)) {
    return { categorySlug: 'verification', prefix: 'V', group: 'Vérification' }
  }
  if (/^(Cbss|Asr)/.test(internalName)) {
    const prefix = /^Cbss/.test(internalName) ? 'DMFA' : 'DRS'
    return { categorySlug: 'bcss', prefix, group: prefix === 'DMFA' ? 'DMFA' : 'DRS-Consult' }
  }
  if (/^(Temporary|TemporaryUnemployment)/.test(internalName)) {
    return { categorySlug: 'autre', prefix: 'TW', group: 'Chômage temporaire' }
  }
  if (/^Signaletic/.test(internalName)) {
    // Sous-catégorie Signaletic, on essaie de détecter un sous-prefix (S52, S43, etc.)
    const sub = internalName.match(/Signaletic.*(S\d+)/)
    if (sub) return { categorySlug: 'signaletic', prefix: sub[1], group: `${sub[1]} - Signalétique` }
    return { categorySlug: 'signaletic', prefix: 'S', group: 'Signalétique' }
  }
  // Catégorie "Global" par défaut pour les noms non classés (Unemployment*, Pay*, Postal*, etc.)
  if (/(Unemployment|Pay|BCPost|Postal|Belgian|Nationality|Juridical|School|Contract)/.test(internalName)) {
    return { categorySlug: 'global', prefix: 'G', group: 'Chômage' }
  }
  // Fallback : Signaletic
  return { categorySlug: 'signaletic', prefix: 'S', group: 'Signalétique' }
}

function buildLabel(internalName: string): string {
  const cleaned = internalName.replace(/^(Signaletic|Verif|Dispo|Cbss|Asr|Temporary)/, (m) => `${m} `)
  const words = splitCamelCase(cleaned)
  return toLabelFr(words)
}

function slugify(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function main() {
  // Charger les tables existantes pour exclure celles déjà mappées
  const existing = await prisma.lookupTable.findMany({
    select: { exportName: true, slug: true },
  })
  const existingExportNames = new Set(
    existing.map((t) => t.exportName).filter((x): x is string => !!x)
  )
  const existingSlugs = new Set(existing.map((t) => t.slug))

  const files = await readdir(DIR).catch(() => [])
  const csvs = files.filter((f) => /-export_(fr|nl|de|en)\.csv$/i.test(f))

  const grouped: Record<string, SeedTableEntry[]> = {}
  const skipped: string[] = []

  for (const file of csvs) {
    const exportName = extractOnemExportName(file)
    if (existingExportNames.has(exportName)) {
      skipped.push(`${exportName} (déjà mappé)`)
      continue
    }
    const { categorySlug, prefix, group } = detectCategoryAndPrefix(exportName)
    const labelFr = buildLabel(exportName)
    let slug = slugify(exportName)
    // Éviter conflit avec un slug existant
    if (existingSlugs.has(slug)) {
      slug = `${slug}-auto`
    }
    const entry: SeedTableEntry = {
      group,
      prefix,
      slug,
      labelFr,
      labelNl: labelFr, // placeholder, à affiner manuellement après import
      exportName,
    }
    if (!grouped[categorySlug]) grouped[categorySlug] = []
    grouped[categorySlug].push(entry)
  }

  const output = {
    _meta: {
      purpose: 'Auto-généré par scripts/generate-missing-seed.ts. À fusionner dans lib/data/lookup-onem-seed.json.',
      totalNew: Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0),
      skipped: skipped.length,
    },
    additions: grouped,
  }

  const outPath = path.join(process.cwd(), 'lib/data/lookup-onem-auto-seed.json')
  await writeFile(outPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\n✓ ${output._meta.totalNew} nouvelles tables auto-générées`)
  console.log(`  ${skipped.length} fichiers déjà mappés (skip)`)
  console.log(`  Sortie : ${outPath}\n`)
  for (const [cat, entries] of Object.entries(grouped)) {
    console.log(`  ${cat}: ${entries.length} tables`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
