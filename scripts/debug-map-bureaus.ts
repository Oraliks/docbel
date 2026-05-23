// Diagnostic : pour un CP donné, dump exactement ce qui sera dessiné sur la
// map du finder /outils/bureaux. Sert à investiguer le bug "2x CAPAC".
//
// Usage : pnpm tsx scripts/debug-map-bureaus.ts 1030

import { resolveBureausForPostalCode } from '@/lib/bureaus/resolve'
import { prisma } from '@/lib/prisma'

async function main() {
  const cp = process.argv[2] ?? '1030'
  console.log(`\n🔎 Diagnostic map pour CP ${cp}\n`)

  // 1) Couleurs des organismes en DB (pour repérer collisions)
  const orgs = await prisma.organisme.findMany({
    select: { code: true, name: true, color: true },
    orderBy: { code: 'asc' },
  })
  console.log('━━━ Couleurs Organisme en DB ━━━')
  const byColor = new Map<string, string[]>()
  for (const o of orgs) {
    const k = (o.color ?? '∅').toUpperCase()
    if (!byColor.has(k)) byColor.set(k, [])
    byColor.get(k)!.push(`${o.code} (${o.name})`)
  }
  for (const [color, list] of byColor.entries()) {
    const tag = list.length > 1 ? '⚠ COLLISION' : '✓'
    console.log(`  ${tag} ${color}  →  ${list.join(' | ')}`)
  }

  // 2) Bureaux résolus pour ce CP
  const r = await resolveBureausForPostalCode(cp)
  console.log(`\n━━━ Commune résolue ━━━`)
  console.log(`  ${r.commune?.nameFr ?? '∅'} (ins=${r.commune?.insCode ?? '∅'})`)
  console.log(`  lat=${r.commune?.lat ?? '∅'} lng=${r.commune?.lng ?? '∅'}`)

  console.log(`\n━━━ Bureaux ATTITRÉS (= ce qui va sur la map) ━━━`)
  const all = [
    { label: 'ONEM   ', b: r.attitre.onem },
    { label: 'CPAS   ', b: r.attitre.cpas },
    { label: 'COMMUNE', b: r.attitre.commune },
    ...r.attitre.organismesPaiement.map((b, i) => ({
      label: `OP-${i + 1}  `,
      b,
    })),
  ]
  for (const { label, b } of all) {
    if (!b) {
      console.log(`  ${label} : ∅`)
      continue
    }
    console.log(
      `  ${label} : ${b.organismeCode?.padEnd(7) ?? '???    '} | ` +
        `type=${b.type.padEnd(9)} | color=${(b.organismeColor ?? '∅').padEnd(8)} | ` +
        `lat=${b.lat ?? '∅'} lng=${b.lng ?? '∅'} | ${b.name}`
    )
  }

  // 3) Détection doublons coords/couleur
  console.log(`\n━━━ Analyse doublons map ━━━`)
  const dots = all
    .filter((x) => x.b && x.b.lat !== null && x.b.lng !== null)
    .map((x) => ({
      key: `${x.b!.lat!.toFixed(4)}_${x.b!.lng!.toFixed(4)}`,
      org: x.b!.organismeCode,
      type: x.b!.type,
      color: x.b!.organismeColor,
      name: x.b!.name,
    }))
  const groupsByCoords = new Map<string, typeof dots>()
  for (const d of dots) {
    if (!groupsByCoords.has(d.key)) groupsByCoords.set(d.key, [])
    groupsByCoords.get(d.key)!.push(d)
  }
  let foundCollision = false
  for (const [key, list] of groupsByCoords.entries()) {
    if (list.length > 1) {
      foundCollision = true
      console.log(`  ⚠ ${list.length} bureaux superposés à ${key} :`)
      for (const d of list) {
        console.log(`      - ${d.org}/${d.type}  color=${d.color}  ${d.name}`)
      }
    }
  }
  if (!foundCollision) console.log('  ✓ Aucune collision exacte de coords')

  // 4) Vérif des organismes "frères" qui pourraient être pris pour CAPAC (orange)
  const orange = orgs.filter((o) => /F58220|FFA500|FF8C00|orange/i.test(o.color ?? ''))
  if (orange.length > 1) {
    console.log(`\n⚠ Plusieurs orgs orange en DB :`)
    for (const o of orange) console.log(`    - ${o.code} (${o.color})`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
