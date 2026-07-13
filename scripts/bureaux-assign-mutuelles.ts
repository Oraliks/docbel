// Génère les BureauAssignment mutuelle_<code> : pour chaque commune, l'office le
// PLUS PROCHE de chaque organisme assureur santé (mutualités + CAAMI + HR Rail).
// Rend le résolveur déterministe (chemin attitré `mutuelleRow`) au lieu de
// dépendre de la liste de proximité (plafonnée, mélangée).
//
// Coordonnées : lat/lng propre de l'office si présent, sinon centroïde de sa
// commune (fallback identique au résolveur).
// Règle : office le plus proche DANS LA MÊME RÉGION linguistique (germanophone
// groupé avec la Wallonie) — évite d'envoyer un Liégeois vers une antenne
// flamande. Repli sur le plus proche toutes régions si l'organisme n'a aucun
// office dans la région (garantit une couverture complète : chaque commune
// obtient un office par organisme).
//
// Non destructif : replace par serviceType (mutuelle_<code>). Dry-run par défaut.
// Usage : pnpm bureaux:assign-mutuelles          (dry-run)
//         pnpm bureaux:assign-mutuelles --yes     (applique)

import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/bureaus/types";

const APPLY = process.argv.includes("--yes");
const HEALTH_ORGS = ["mc", "solidaris", "mloz", "mutlibres", "neutrales", "caami", "hr-rail"];

/** germanophone est administrativement en Wallonie → même bassin linguistique. */
function normRegion(r: string): string {
  return r === "germanophone" ? "wallonia" : r;
}

type GeoOffice = { id: string; lat: number; lng: number; region: string };

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}\n`);

  const communes = await prisma.commune.findMany({
    where: { mergedIntoId: null, lat: { not: null }, lng: { not: null } },
    select: { id: true, lat: true, lng: true, region: true },
  });

  for (const code of HEALTH_ORGS) {
    const offices = await prisma.bureau.findMany({
      where: { active: true, organisme: { code } },
      select: { id: true, lat: true, lng: true, commune: { select: { lat: true, lng: true, region: true } } },
    });
    const geoOffices: GeoOffice[] = offices
      .map((o) => {
        const lat = o.lat ?? o.commune?.lat ?? null;
        const lng = o.lng ?? o.commune?.lng ?? null;
        const region = o.commune?.region ?? null;
        return lat != null && lng != null && region ? { id: o.id, lat, lng, region: normRegion(region) } : null;
      })
      .filter((o): o is GeoOffice => o != null);

    if (geoOffices.length === 0) { console.log(`  ${code}: 0 office géolocalisable — sauté`); continue; }

    let crossRegion = 0;
    const plan = communes.map((c) => {
      const cRegion = normRegion(c.region);
      const sameRegion = geoOffices.filter((o) => o.region === cRegion);
      const pool = sameRegion.length > 0 ? sameRegion : geoOffices;
      if (sameRegion.length === 0) crossRegion++;
      let best = pool[0];
      let bestD = Infinity;
      for (const o of pool) {
        const d = haversineKm({ lat: c.lat!, lng: c.lng! }, { lat: o.lat, lng: o.lng });
        if (d < bestD) { bestD = d; best = o; }
      }
      return { bureauId: best.id, communeId: c.id };
    });
    console.log(`  ${code}: ${geoOffices.length} offices → ${plan.length} communes (${crossRegion} en repli hors-région)`);

    if (APPLY) {
      const res = await prisma.$transaction(async (tx) => {
        await tx.bureauAssignment.deleteMany({ where: { serviceType: `mutuelle_${code}` } });
        return tx.bureauAssignment.createMany({
          data: plan.map((a) => ({ ...a, serviceType: `mutuelle_${code}` })),
          skipDuplicates: true,
        });
      });
      console.log(`     ✓ ${res.count} assignments mutuelle_${code}`);
    }
  }

  if (!APPLY) console.log("\nDry-run. --yes pour appliquer.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
