// Lot 2 du plan qualité bureaux : applique un annuaire OFFICIEL d'adresses
// (CPAS / maisons communales) sur les bureaux stub.
//
// ⚠️ CE SCRIPT NE FABRIQUE PAS DE DONNÉES. Il consomme un fichier JSON propre
// et VÉRIFIÉ que tu déposes dans `lib/data/cpas-officiels.json`.
//
// Pourquoi pas d'auto-scrape : la seule source exhaustive publique est le PDF du
// SPP Intégration Sociale (https://www.mi-is.be/fr/liste-des-cpas —
// « CPASOCMW012026… .pdf »). Son extraction automatique est trop peu fiable
// (colonnes désalignées → 6 % de cohérence CP mesurée). Écrire de fausses
// adresses sur un outil public destiné à des citoyens vulnérables serait pire
// qu'un stub honnête. Le fichier JSON doit donc être produit/vérifié à la main
// (ou via un export officiel structuré si le SPP en publie un).
//
// Contrat du fichier `lib/data/cpas-officiels.json` (array) :
//   {
//     "type": "CPAS" | "COMMUNE",
//     "communeInsCode": "25005",   // optionnel mais préféré (match fiable)
//     "communeName": "Perwez",     // fallback si pas d'INS
//     "street": "Rue de la Station",
//     "streetNum": "12",           // optionnel
//     "postalCode": "1360",
//     "city": "Perwez",
//     "phone": "081 23 45 67",     // optionnel
//     "email": "info@cpas.be",     // optionnel
//     "website": "https://…"       // optionnel
//   }
//
// Garde-fous :
//   - cross-check : le postalCode fourni DOIT appartenir aux CP réels de la
//     commune (table PostalCode). Sinon l'entrée est rejetée (protège contre un
//     mauvais appariement commune↔adresse).
//   - non destructif : ne remplit QUE les bureaux stub (« Adresse à confirmer »,
//     CP 0000…) ; ne touche jamais un bureau déjà renseigné ou `verified`.
//   - provenance : verifiedBy = "import:<source>", lastVerifiedAt = maintenant,
//     verified = true (source officielle + CP cross-checké).
//   - snapshot BureauRevision avant chaque écriture ; dry-run par défaut.
//
// Usage :
//   pnpm bureaux:apply-official --source "mi-is.be 2026-01"          (dry-run)
//   pnpm bureaux:apply-official --source "mi-is.be 2026-01" --yes    (applique)

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { snapshotBureau } from "@/lib/bureaus/diff";
import { isStubAddress } from "@/lib/bureaus/dedupe";
import type { Prisma } from "@prisma/client";

const APPLY = process.argv.includes("--yes");
function getArg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}
const SOURCE = getArg("--source") ?? "import-officiel";
const DATA_PATH = path.resolve(process.cwd(), "lib/data/cpas-officiels.json");

interface OfficialEntry {
  type: "CPAS" | "COMMUNE";
  communeInsCode?: string;
  communeName?: string;
  street: string;
  streetNum?: string;
  postalCode: string;
  city: string;
  phone?: string;
  email?: string;
  website?: string;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"} — source="${SOURCE}"\n`);

  if (!existsSync(DATA_PATH)) {
    console.log(`❌ Fichier absent : ${DATA_PATH}`);
    console.log(`\nDépose un JSON propre (voir le contrat en tête de ce script).`);
    console.log(`Source officielle : https://www.mi-is.be/fr/liste-des-cpas`);
    return;
  }

  const entries = JSON.parse(readFileSync(DATA_PATH, "utf8")) as OfficialEntry[];
  console.log(`${entries.length} entrées dans le fichier officiel.`);

  // Index communes (par INS + par nom normalisé) + CP réels par commune
  const communes = await prisma.commune.findMany({
    where: { mergedIntoId: null },
    select: { id: true, insCode: true, nameFr: true, nameNl: true },
  });
  const byIns = new Map(communes.map((c) => [c.insCode, c.id]));
  const byName = new Map<string, string>();
  for (const c of communes) {
    byName.set(norm(c.nameFr), c.id);
    if (c.nameNl) byName.set(norm(c.nameNl), c.id);
  }
  const pcs = await prisma.postalCode.findMany({ select: { code: true, communeId: true } });
  const cpsByCommune = new Map<string, Set<string>>();
  for (const p of pcs) {
    if (!cpsByCommune.has(p.communeId)) cpsByCommune.set(p.communeId, new Set());
    cpsByCommune.get(p.communeId)!.add(p.code);
  }

  let applied = 0, noCommune = 0, cpReject = 0, noStub = 0;
  const plan: { id: string; entry: OfficialEntry }[] = [];

  for (const e of entries) {
    const communeId =
      (e.communeInsCode && byIns.get(e.communeInsCode)) ||
      (e.communeName && byName.get(norm(e.communeName))) ||
      null;
    if (!communeId) { noCommune++; continue; }

    // Cross-check CP : protège contre un mauvais appariement
    const set = cpsByCommune.get(communeId);
    if (set && set.size > 0 && !set.has(e.postalCode)) { cpReject++; continue; }

    // Cible : le bureau stub actif de ce type pour cette commune
    const target = await prisma.bureau.findFirst({
      where: { active: true, type: e.type, communeId, verified: false },
      select: { id: true, street: true, phone: true, email: true, website: true },
    });
    if (!target || !isStubAddress(target.street)) { noStub++; continue; }

    plan.push({ id: target.id, entry: e });
  }

  console.log(`\nPlan : ${plan.length} adresses à poser`);
  console.log(`  rejets : ${noCommune} commune introuvable, ${cpReject} CP incohérent, ${noStub} pas de stub cible`);
  for (const p of plan.slice(0, 15)) console.log(`  ${p.entry.type} ${p.entry.communeName ?? p.entry.communeInsCode} → ${p.entry.street} ${p.entry.streetNum ?? ""}, ${p.entry.postalCode}`);
  if (plan.length > 15) console.log(`  … (+${plan.length - 15})`);

  if (!APPLY) {
    console.log("\nDry-run terminé. Relance avec --yes pour appliquer.");
    return;
  }

  console.log("\n🔥 Application…");
  for (const { id, entry } of plan) {
    const before = await prisma.bureau.findUnique({ where: { id } });
    if (!before) continue;
    await prisma.$transaction([
      prisma.bureauRevision.create({
        data: {
          bureauId: id,
          snapshot: snapshotBureau(before) as Prisma.InputJsonValue,
          changeNotes: `Adresse officielle posée par bureaux:apply-official (source: ${SOURCE})`,
          changedBy: `script:bureaux-apply-official`,
        },
      }),
      prisma.bureau.update({
        where: { id },
        data: {
          street: entry.street,
          streetNum: entry.streetNum ?? before.streetNum,
          postalCode: entry.postalCode,
          city: entry.city,
          phone: before.phone || entry.phone || null,
          email: before.email || entry.email || null,
          website: before.website || entry.website || null,
          verified: true,
          verifiedBy: `import:${SOURCE}`,
          lastVerifiedAt: new Date(),
          updatedBy: "script:bureaux-apply-official",
        },
      }),
    ]);
    applied++;
  }
  console.log(`✓ ${applied} adresses posées (vérifiées, source ${SOURCE}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
