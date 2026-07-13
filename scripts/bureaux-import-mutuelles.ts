// Importe les offices mutualistes OFFICIELS (répertoire INAMI/RIZIV + registre
// légal OCM/CDZ, validés, alignés REFNIS 2025) comme bureaux mutuelle vérifiés,
// et remplace l'ancien seed clairsemé.
//
// Source : lib/data/mutuelles-points-contact-2026-07.jsonl (53 points de
// contact : sièges, offices régionaux, centres médicaux).
//
// Périmètre : les 5 familles mutualistes qui correspondent à nos organismes.
//   1xx → mc         (Mutualités chrétiennes)
//   2xx → neutrales  (Mutualités neutres)
//   3xx → solidaris  (Mutualités socialistes / Solidaris)
//   4xx → mutlibres  (Mutualités libérales)
//   5xx → mloz       (Mutualités libres : MLOZ, Partenamut, Helan, Freie KK)
//   6xx → caami      (CAAMI/HZIV — caisse auxiliaire publique + offices régionaux)
// Ignorés : 9xx (CSS HR Rail), service santé propre aux cheminots.
//
// Chaque point → bureau vérifié (verified=true, verifiedBy=import:<source>),
// commune reliée via le code INS officiel. L'ancien seed (bureaux mutuelle non
// issus de cet import) est désactivé (réversible via BureauRevision).
//
// Idempotent (upsert par organisme + nom normalisé). Dry-run par défaut.
// Usage : pnpm bureaux:import-mutuelles          (dry-run)
//         pnpm bureaux:import-mutuelles --yes     (applique)

import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { snapshotBureau } from "@/lib/bureaus/diff";
import type { Prisma } from "@prisma/client";

const APPLY = process.argv.includes("--yes");
const SOURCE = "INAMI/OCM 2026-07-13";
const POINTS_PATH = path.resolve(process.cwd(), "lib/data/mutuelles-points-contact-2026-07.jsonl");

const FAMILY_ORG: Record<string, string> = { "1": "mc", "2": "neutrales", "3": "solidaris", "4": "mutlibres", "5": "mloz", "6": "caami" };

interface Addr {
  rue_et_numero?: string;
  code_postal?: string;
  localite?: string;
  commune_administrative?: { code_ins?: string };
}
interface Point {
  numero_organisme: string;
  type_point: string;
  nom: string;
  adresse_contact_inami?: Addr;
  adresse_legale_ocm?: Addr;
  telephones?: { valeur?: string }[];
  emails?: string[];
  sites_web?: string[];
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function stripParen(s: string) { return s.replace(/\s*\(.*?\)\s*/g, " ").trim(); }

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}\n`);

  const lines = readFileSync(POINTS_PATH, "utf8").split("\n").filter(Boolean);

  // Garantit l'organisme caami (caisse auxiliaire publique — équivalent santé de
  // la CAPAC). Idempotent ; nécessaire au mapping de la famille 6xx.
  await prisma.organisme.upsert({
    where: { code: "caami" },
    update: {},
    create: {
      code: "caami", name: "Caisse Auxiliaire d'Assurance Maladie-Invalidité (CAAMI/HZIV)",
      shortName: "CAAMI", type: "social", website: "https://www.caami-hziv.fgov.be",
      description: "Organisme assureur public — soins de santé et indemnités pour les personnes non affiliées à une mutualité.",
      order: 60,
    },
  });

  const orgs = await prisma.organisme.findMany({ where: { code: { in: Object.values(FAMILY_ORG) } }, select: { id: true, code: true } });
  const orgIdByCode = new Map(orgs.map((o) => [o.code, o.id]));
  const communes = await prisma.commune.findMany({ where: { mergedIntoId: null }, select: { id: true, insCode: true } });
  const communeByIns = new Map(communes.map((c) => [c.insCode, c.id]));

  type Plan = {
    orgCode: string; orgId: string; name: string; street: string; streetNum: null;
    postalCode: string; city: string; communeId: string | null; phone: string | null;
    email: string | null; website: string | null;
  };
  const plans: Plan[] = [];
  let skipped = 0, noCommune = 0;

  for (const l of lines) {
    const p = JSON.parse(l) as Point;
    const fam = p.numero_organisme?.[0] ?? "";
    const orgCode = FAMILY_ORG[fam];
    if (!orgCode) { skipped++; continue; } // 6xx CAAMI, 9xx HR Rail
    const orgId = orgIdByCode.get(orgCode);
    if (!orgId) { skipped++; continue; }
    const a = p.adresse_contact_inami ?? p.adresse_legale_ocm;
    if (!a?.rue_et_numero || !a.code_postal) { skipped++; continue; }
    const communeId = a.commune_administrative?.code_ins ? communeByIns.get(a.commune_administrative.code_ins) ?? null : null;
    if (!communeId) noCommune++;
    plans.push({
      orgCode, orgId, name: p.nom.trim(), street: a.rue_et_numero.trim(), streetNum: null,
      postalCode: a.code_postal.trim(), city: stripParen(a.localite ?? "").trim() || a.localite || "",
      communeId, phone: p.telephones?.[0]?.valeur?.trim() ?? null,
      email: p.emails?.[0]?.trim() ?? null, website: p.sites_web?.[0]?.trim() ?? null,
    });
  }

  const byOrg: Record<string, number> = {};
  for (const p of plans) byOrg[p.orgCode] = (byOrg[p.orgCode] ?? 0) + 1;
  console.log(`${plans.length} offices officiels à importer (${Object.entries(byOrg).map(([k, v]) => `${k}=${v}`).join(", ")})`);
  console.log(`  ${skipped} points ignorés (HR Rail 9xx / incomplets), ${noCommune} sans commune INS`);
  for (const p of plans) console.log(`  [${p.orgCode}] ${p.name} @ ${p.street}, ${p.postalCode} ${p.city}`);

  // Ancien seed à désactiver : bureaux mutuelle actifs dont le nom ne correspond
  // à aucun office officiel (null-safe, contrairement à un NOT sur verifiedBy).
  const planNames = new Set(plans.map((p) => norm(p.name)));
  const activeMut = await prisma.bureau.findMany({
    where: { active: true, organisme: { code: { in: Object.values(FAMILY_ORG) } } },
    select: { id: true, name: true },
  });
  const oldSeed = activeMut.filter((b) => !planNames.has(norm(b.name)));
  console.log(`\n${oldSeed.length} anciens bureaux mutuelle (seed) à désactiver : ${oldSeed.map((b) => b.name).join(", ")}`);

  if (!APPLY) { console.log("\nDry-run. --yes pour appliquer."); return; }

  console.log("\n🔥 Application…");
  let created = 0, updated = 0;
  for (const p of plans) {
    const existing = await prisma.bureau.findFirst({
      where: { organismeId: p.orgId, type: "AUTRE", name: { equals: p.name } },
      select: { id: true },
    });
    const data = {
      organismeId: p.orgId, type: "AUTRE" as const, name: p.name, street: p.street, streetNum: p.streetNum,
      postalCode: p.postalCode, city: p.city, communeId: p.communeId, phone: p.phone, email: p.email,
      website: p.website, active: true, verified: true, verifiedBy: `import:${SOURCE}`, lastVerifiedAt: new Date(),
      updatedBy: "script:import-mutuelles",
    };
    if (existing) { await prisma.bureau.update({ where: { id: existing.id }, data }); updated++; }
    else { await prisma.bureau.create({ data }); created++; }
  }
  // Désactive l'ancien seed
  for (const b of oldSeed) {
    const before = await prisma.bureau.findUnique({ where: { id: b.id } });
    if (!before) continue;
    await prisma.$transaction([
      prisma.bureauRevision.create({ data: { bureauId: b.id, snapshot: snapshotBureau(before) as Prisma.InputJsonValue, changeNotes: "Remplacé par import mutuelles officiel", changedBy: "script:import-mutuelles" } }),
      prisma.bureau.update({ where: { id: b.id }, data: { active: false, updatedBy: "script:import-mutuelles" } }),
    ]);
  }
  console.log(`✓ ${created} créés, ${updated} mis à jour, ${oldSeed.length} anciens désactivés (tous verified).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
