// Aligne la table Commune sur REFNIS 2025 pour les 7 fusions communales
// flamandes du 01/01/2025 : crée la commune fusionnée (nouveau code INS), y
// redirige codes postaux + bureaux + assignments des anciennes communes, et
// marque celles-ci `mergedIntoId` (relation fusedFrom prévue au schéma).
//
// Le résolveur fait CP → PostalCode → commune (sans suivre mergedInto), donc on
// DÉPLACE réellement les PostalCode/Bureau/BureauAssignment vers la fusionnée.
//
// Après ce script, enchaîner (logique testée, réutilisée) :
//   pnpm bureaux:dedupe --yes         (collapse les CPAS/communes en double)
//   pnpm bureaux:apply-official --yes (pose l'adresse + le nom officiels)
//   pnpm bureaux:assign --yes         (régénère chômage + paiement)
//
// Idempotent : si le code INS fusionné existe déjà, la fusion est ignorée.
// Non destructif : aucune commune supprimée (mergedIntoId), bureaux jamais
// supprimés. Dry-run par défaut.
//
// Usage :
//   pnpm bureaux:merge-2025          (dry-run)
//   pnpm bureaux:merge-2025 --yes    (applique)

import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { BelgianRegion } from "@prisma/client";

const APPLY = process.argv.includes("--yes");
const COMMUNES_PATH = path.resolve(process.cwd(), "lib/data/communes-officiel-2026-07.json");

// Fusions 2025 → composantes (codes INS de NOTRE base, vérifiés via diagnostic).
const FUSIONS: { ins: string; components: string[] }[] = [
  { ins: "23106", components: ["23023", "23024", "23032"] }, // Pajottegem ← Galmaarden, Gooik, Herne
  { ins: "44086", components: ["44048", "44012"] }, // Nazareth-De Pinte ← Nazareth, De Pinte
  { ins: "44088", components: ["44043", "44040"] }, // Merelbeke-Melle ← Merelbeke, Melle
  { ins: "46030", components: ["46003", "46013", "11056"] }, // Beveren-Kruibeke-Zwijndrecht
  { ins: "71071", components: ["71057", "71069"] }, // Tessenderlo-Ham ← Tessenderlo, Ham
  { ins: "73110", components: ["73006", "73032"] }, // Bilzen-Hoeselt ← Bilzen, Hoeselt
  { ins: "73111", components: ["73083", "73009"] }, // Tongeren-Borgloon ← Tongeren, Borgloon
];

interface CommuneRaw {
  code_ins: string;
  commune: string;
  noms: { fr: string | null; nl: string | null; de: string | null };
  region: string;
  province: string | null;
  administration: { adresse: { code_postal: string } };
}

function mapRegion(r: string): BelgianRegion {
  if (/flamande/i.test(r)) return "flanders";
  if (/wallonne/i.test(r)) return "wallonia";
  if (/bruxelles/i.test(r)) return "brussels";
  return "flanders";
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN (passe --yes pour appliquer)"}\n`);

  const official = JSON.parse(readFileSync(COMMUNES_PATH, "utf8")) as CommuneRaw[];
  const officialByIns = new Map(official.map((o) => [o.code_ins, o]));

  for (const f of FUSIONS) {
    const o = officialByIns.get(f.ins);
    if (!o) {
      console.log(`⚠ [${f.ins}] absent du fichier officiel — sauté`);
      continue;
    }

    const existing = await prisma.commune.findUnique({ where: { insCode: f.ins } });
    const officialCp = o.administration.adresse.code_postal.trim();

    // Idempotent : si déjà fusionnée, on ne recrée pas, mais on FORCE quand même
    // le CP officiel → fusionnée (corrige un CP mal attribué avant).
    if (existing) {
      console.log(`✓ [${f.ins}] ${o.commune} existe — force CP officiel ${officialCp}`);
      if (APPLY && /^\d{4}$/.test(officialCp)) {
        await prisma.postalCode.upsert({
          where: { code: officialCp },
          update: { communeId: existing.id },
          create: { code: officialCp, communeId: existing.id },
        });
      }
      continue;
    }

    const components = await prisma.commune.findMany({
      where: { insCode: { in: f.components } },
      select: { id: true, insCode: true, nameFr: true, lat: true, lng: true, mergedIntoId: true },
    });
    const missing = f.components.filter((ins) => !components.some((c) => c.insCode === ins));
    if (missing.length) {
      console.log(`⚠ [${f.ins}] ${o.commune} : composantes introuvables ${missing.join(",")} — sauté`);
      continue;
    }
    const componentIds = components.map((c) => c.id);
    const lats = components.map((c) => c.lat).filter((x): x is number => x != null);
    const lngs = components.map((c) => c.lng).filter((x): x is number => x != null);
    const lat = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : null;
    const lng = lngs.length ? lngs.reduce((a, b) => a + b, 0) / lngs.length : null;

    const pcCount = await prisma.postalCode.count({ where: { communeId: { in: componentIds } } });
    const buCount = await prisma.bureau.count({ where: { communeId: { in: componentIds } } });
    const asCount = await prisma.bureauAssignment.count({ where: { communeId: { in: componentIds } } });

    console.log(`■ [${f.ins}] ${o.commune}  (${mapRegion(o.region)})`);
    console.log(`   composantes : ${components.map((c) => `${c.nameFr}[${c.insCode}]`).join(", ")}`);
    console.log(`   à déplacer : ${pcCount} CP, ${buCount} bureaux, ${asCount} assignments`);
    console.log(`   + CP officiel ${o.administration.adresse.code_postal} → fusionnée`);

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      const merged = await tx.commune.create({
        data: {
          insCode: f.ins,
          nameFr: o.noms.fr ?? o.commune,
          nameNl: o.noms.nl,
          nameDe: o.noms.de,
          region: mapRegion(o.region),
          province: o.province,
          lat,
          lng,
        },
      });
      // Codes postaux → fusionnée
      await tx.postalCode.updateMany({
        where: { communeId: { in: componentIds } },
        data: { communeId: merged.id },
      });
      // CP officiel de l'administration → fusionnée (override si mal attribué)
      const cp = o.administration.adresse.code_postal.trim();
      if (/^\d{4}$/.test(cp)) {
        await tx.postalCode.upsert({
          where: { code: cp },
          update: { communeId: merged.id },
          create: { code: cp, communeId: merged.id },
        });
      }
      // Bureaux → fusionnée
      await tx.bureau.updateMany({
        where: { communeId: { in: componentIds } },
        data: { communeId: merged.id },
      });
      // Assignments des composantes : supprimés (régénérés ensuite par bureaux:assign)
      await tx.bureauAssignment.deleteMany({ where: { communeId: { in: componentIds } } });
      // Marque les composantes comme fusionnées
      await tx.commune.updateMany({
        where: { id: { in: componentIds } },
        data: { mergedIntoId: merged.id },
      });
    });
    console.log(`   ✓ fusionnée créée + composantes redirigées`);
  }

  if (!APPLY) console.log("\nDry-run terminé. Relance avec --yes pour appliquer.");
  else console.log("\n✓ Terminé. Enchaîner : bureaux:dedupe --yes, bureaux:apply-official --yes, bureaux:assign --yes");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
