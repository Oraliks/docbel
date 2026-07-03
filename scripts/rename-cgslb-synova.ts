// Migration de données (one-off) : la CGSLB a été rebaptisée SYNOVA (30/05/2026,
// source : cgslb.be/synova.be). Renomme les valeurs "cgslb"/"CGSLB"/"ACLVB"
// persistées en DB pour rester cohérent avec le code (déjà renommé).
//
// Purement additif / UPDATE — aucune migration de schéma nécessaire (tous les
// champs concernés sont des String libres, pas des enums).
//
// Usage : pnpm dotenv -e .env.local -- tsx scripts/rename-cgslb-synova.ts
//         pnpm dotenv -e .env.local -- tsx scripts/rename-cgslb-synova.ts --yes

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}\n`)

  // 1) Organisme (code unique = clé référencée par les seeds/imports)
  const org = await prisma.organisme.findUnique({ where: { code: 'cgslb' } })
  if (org) {
    console.log(`Organisme "cgslb" trouvé (id=${org.id}, name="${org.name}")`)
    if (APPLY) {
      await prisma.organisme.update({
        where: { id: org.id },
        data: {
          code: 'synova',
          name: 'SYNOVA',
          shortName: 'SYNOVA',
          website: 'https://www.synova.be',
        },
      })
      console.log('  ✓ renommé en "synova"')
    }
  } else {
    console.log('Organisme "cgslb" absent (déjà migré ou jamais seedé) — skip')
  }

  // 2) UserProfile.organismePaiement (préférence user, string libre)
  const profileCount = await prisma.userProfile.count({ where: { organismePaiement: 'cgslb' } })
  console.log(`\n${profileCount} UserProfile avec organismePaiement="cgslb"`)
  if (APPLY && profileCount > 0) {
    await prisma.userProfile.updateMany({
      where: { organismePaiement: 'cgslb' },
      data: { organismePaiement: 'synova' },
    })
    console.log('  ✓ mis à jour')
  }

  // 3) BookingTenant (slug = segment d'URL publique /<slug>/rendez-vous)
  const tenant = await prisma.bookingTenant.findUnique({ where: { slug: 'cgslb' } })
  if (tenant) {
    console.log(`\nBookingTenant "cgslb" trouvé (id=${tenant.id}, name="${tenant.name}")`)
    if (APPLY) {
      await prisma.bookingTenant.update({
        where: { id: tenant.id },
        data: {
          slug: 'synova',
          name: 'SYNOVA',
          partnerOrganization: tenant.partnerOrganization === 'CGSLB' ? 'SYNOVA' : tenant.partnerOrganization,
        },
      })
      console.log('  ✓ renommé en "synova" (slug public change : /cgslb/rendez-vous → /synova/rendez-vous)')
    }
  } else {
    console.log('\nBookingTenant "cgslb" absent (déjà migré ou jamais seedé) — skip')
  }

  // 4) BureauAssignment.serviceType (assignations admin commune → bureau)
  const assignCount = await prisma.bureauAssignment.count({ where: { serviceType: 'paiement_cgslb' } })
  console.log(`\n${assignCount} BureauAssignment avec serviceType="paiement_cgslb"`)
  if (APPLY && assignCount > 0) {
    await prisma.bureauAssignment.updateMany({
      where: { serviceType: 'paiement_cgslb' },
      data: { serviceType: 'paiement_synova' },
    })
    console.log('  ✓ mis à jour')
  }

  // 5) Bureau.name / website (bureaux SYNDICAT importés depuis le scrape CGSLB/ACLVB)
  const bureaus = await prisma.bureau.findMany({
    where: { OR: [{ name: { startsWith: 'CGSLB ' } }, { name: { startsWith: 'ACLVB ' } }, { name: 'CGSLB — Siège national' }] },
    select: { id: true, name: true, website: true },
  })
  console.log(`\n${bureaus.length} Bureau avec un nom CGSLB/ACLVB`)
  if (APPLY && bureaus.length > 0) {
    for (const b of bureaus) {
      const newName = b.name.replace(/^CGSLB /, 'SYNOVA ').replace(/^ACLVB /, 'SYNOVA ').replace(
        'CGSLB — Siège national',
        'SYNOVA — Siège national'
      )
      const newWebsite = b.website
        ?.replace('www.cgslb.be', 'www.synova.be')
        .replace('www.aclvb.be', 'www.synova.be')
      await prisma.bureau.update({
        where: { id: b.id },
        data: { name: newName, ...(newWebsite ? { website: newWebsite } : {}) },
      })
    }
    console.log('  ✓ mis à jour')
  }

  if (!APPLY) {
    console.log('\nDry-run. Passe --yes pour appliquer.')
  } else {
    console.log('\n✓ Migration terminée.')
    console.log('  Pense à relancer `pnpm dotenv -e .env.local -- tsx scripts/i18n-content-dump.ts` si tu veux rafraîchir private/i18n-content-dump/ (Organisme, News).')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
