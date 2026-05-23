// Fix les couleurs `Organisme.color` pour aligner avec les vrais logos
// officiels. Les valeurs initiales du seed étaient incorrectes pour CAPAC
// (bleu marine au lieu d'orange) et CSC (orange au lieu de vert).
//
// Conséquences UI quand mal réglé :
//  - Tabs CAPAC/FGTB/CSC/CGSLB avaient des couleurs incohérentes avec leur
//    identité visuelle
//  - Sur la map, ONEM (#0050A0 bleu marine) et CGSLB (#0050A0 idem) avaient
//    la même couleur → 2 dots bleus indistinguables (cf. bug user).
//
// Usage :
//   pnpm tsx scripts/fix-organisme-colors.ts            (dry-run)
//   pnpm tsx scripts/fix-organisme-colors.ts --yes      (applique)

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')

const FIXES: Record<string, string> = {
  capac: '#F58220', // orange officiel CAPAC (au lieu de #003F87 bleu marine)
  csc: '#008F4F', // vert syndicat chrétien (au lieu de #FFA500 orange)
  // FGTB (#E30613 rouge) et CGSLB (#0050A0 bleu libéral) : déjà corrects
}

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}\n`)
  for (const [code, newColor] of Object.entries(FIXES)) {
    const org = await prisma.organisme.findUnique({ where: { code } })
    if (!org) {
      console.log(`⚠ ${code} introuvable, skip`)
      continue
    }
    if (org.color === newColor) {
      console.log(`✓ ${code} : déjà ${newColor}`)
      continue
    }
    console.log(`  ${code} : ${org.color} → ${newColor}`)
    if (APPLY) {
      await prisma.organisme.update({
        where: { code },
        data: { color: newColor },
      })
    }
  }
  if (!APPLY) console.log('\nDry-run. Passe --yes pour appliquer.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
