// Audit read-only de la qualité des données bureaux.
// Mesure les incohérences : stubs d'adresses, doublons, CP↔commune,
// couverture des assignments (chômage / paiement / mutuelle), vérification.
//
// Usage : pnpm bureaux:audit   (aucune écriture en base)

import { prisma } from '@/lib/prisma'

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

async function main() {
  const out: Record<string, unknown> = {}

  const bureaus = await prisma.bureau.findMany({
    select: {
      id: true, type: true, name: true, street: true, streetNum: true,
      postalCode: true, city: true, lat: true, lng: true, communeId: true,
      phone: true, email: true, website: true, hours: true, active: true,
      verified: true, lastVerifiedAt: true, numeroOnem: true,
      organisme: { select: { code: true } },
    },
  })
  const active = bureaus.filter(b => b.active)
  out.total = bureaus.length
  out.actifs = active.length
  out.inactifs = bureaus.length - active.length

  const byType: Record<string, number> = {}
  const byOrg: Record<string, number> = {}
  for (const b of active) {
    byType[b.type] = (byType[b.type] ?? 0) + 1
    byOrg[b.organisme.code] = (byOrg[b.organisme.code] ?? 0) + 1
  }
  out.byType = byType
  out.byOrg = byOrg

  out.trous = {
    sansLatLng: active.filter(b => b.lat == null).length,
    sansPhone: active.filter(b => !b.phone).length,
    sansWebsite: active.filter(b => !b.website).length,
    sansEmail: active.filter(b => !b.email).length,
    sansHoraires: active.filter(b => !Array.isArray(b.hours) || (b.hours as unknown[]).length === 0).length,
    sansCommuneId: active.filter(b => !b.communeId).length,
    sansCommuneIdParType: Object.fromEntries(
      Object.keys(byType).map(t => [t, active.filter(b => b.type === t && !b.communeId).length])
    ),
    nonVerifies: active.filter(b => !b.verified).length,
  }

  // Stubs adresses (placeholder ou CP invalide)
  const stubs = active.filter(b =>
    /confirmer|stub|todo|\?/i.test(b.street) || b.postalCode === '0000' || b.street.trim().length < 3
  )
  out.stubs = {
    count: stubs.length,
    parType: Object.fromEntries(Object.keys(byType).map(t => [t, stubs.filter(b => b.type === t).length])),
    sample: stubs.slice(0, 10).map(b => `${b.type} ${b.name} (${b.postalCode} ${b.city}) street="${b.street}"`),
  }

  // CP↔commune : le CP du bureau doit appartenir à l'ensemble des CP de SA commune
  // (pas seulement à la commune dominante du CP — les CP partagés sont légitimes).
  const postalCodes = await prisma.postalCode.findMany({ select: { code: true, communeId: true } })
  const knownCps = new Set(postalCodes.map(p => p.code))
  const cpsByCommune = new Map<string, Set<string>>()
  for (const p of postalCodes) {
    if (!cpsByCommune.has(p.communeId)) cpsByCommune.set(p.communeId, new Set())
    cpsByCommune.get(p.communeId)!.add(p.code)
  }
  const cpMismatch = active.filter(b => {
    if (!b.communeId || !knownCps.has(b.postalCode)) return false
    const set = cpsByCommune.get(b.communeId)
    return set != null && set.size > 0 && !set.has(b.postalCode)
  })
  out.cpCommuneIncoherents = { count: cpMismatch.length, sample: cpMismatch.slice(0, 10).map(b => `${b.type} ${b.name} CP=${b.postalCode}`) }
  const cpInconnu = active.filter(b => !knownCps.has(b.postalCode))
  out.cpInconnus = { count: cpInconnu.length, sample: cpInconnu.slice(0, 10).map(b => `${b.type} ${b.name} CP=${b.postalCode}`) }

  // Doublons stricts (type + CP + nom normalisé)
  const groups = new Map<string, string[]>()
  for (const b of active) {
    const key = `${b.type}|${b.postalCode}|${normalize(b.name)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(b.name)
  }
  const dups = [...groups.entries()].filter(([, g]) => g.length > 1)
  out.doublonsStricts = { count: dups.length, sample: dups.slice(0, 10).map(([k, g]) => `${k} ×${g.length}`) }

  // Plusieurs CPAS / maisons communales pour la même commune (bruit d'import)
  const byTypeCommune = new Map<string, string[]>()
  for (const b of active.filter(x => x.communeId && (x.type === 'CPAS' || x.type === 'COMMUNE'))) {
    const key = `${b.type}|${b.communeId}`
    if (!byTypeCommune.has(key)) byTypeCommune.set(key, [])
    byTypeCommune.get(key)!.push(b.name)
  }
  const multi = [...byTypeCommune.entries()].filter(([, g]) => g.length > 1)
  out.multiParCommune = { count: multi.length, sample: multi.slice(0, 10).map(([k, g]) => `${k.split('|')[0]}: ${g.join(' / ')}`) }

  // Couverture communes (hors communes fusionnées)
  const communes = await prisma.commune.findMany({ select: { id: true, nameFr: true, region: true, mergedIntoId: true } })
  const communesActives = communes.filter(c => !c.mergedIntoId)
  const cpasCommunes = new Set(active.filter(b => b.type === 'CPAS' && b.communeId).map(b => b.communeId))
  const communeCommunes = new Set(active.filter(b => b.type === 'COMMUNE' && b.communeId).map(b => b.communeId))
  out.couverture = {
    communes: communesActives.length,
    sansCpas: communesActives.filter(c => !cpasCommunes.has(c.id)).length,
    sansMaisonCommunale: communesActives.filter(c => !communeCommunes.has(c.id)).length,
  }

  // Assignments par service (chomage / paiement_* / mutuelle_*)
  const assignments = await prisma.bureauAssignment.groupBy({ by: ['serviceType'], _count: { _all: true } })
  out.assignmentsParService = Object.fromEntries(assignments.map(a => [a.serviceType, a._count._all]))
  const chomageCommunes = await prisma.bureauAssignment.findMany({ where: { serviceType: 'chomage' }, select: { communeId: true }, distinct: ['communeId'] })
  const chomageSet = new Set(chomageCommunes.map(a => a.communeId))
  const sansChomage = communesActives.filter(c => !chomageSet.has(c.id))
  out.communesSansAssignmentChomage = { count: sansChomage.length, sample: sansChomage.slice(0, 10).map(c => c.nameFr) }

  out.onemSansNumero = active.filter(b => b.type === 'ONEM' && !b.numeroOnem).length

  out.reportsBureauPending = await prisma.bureauReport.count({ where: { status: 'pending' } })

  const lastRevision = await prisma.bureauRevision.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
  out.derniereRevision = lastRevision?.createdAt ?? null

  console.log(JSON.stringify(out, null, 2))
}

main().finally(() => prisma.$disconnect())
