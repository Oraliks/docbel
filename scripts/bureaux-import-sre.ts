// Importe les Services publics Régionaux de l'Emploi (SRE) officiels et pose la
// compétence territoriale par commune.
//
// Sources (officielles, validées, alignées REFNIS — fournies par Oraliks) :
//   lib/data/sre-implantations-2026-07.jsonl      (98 offices)
//   lib/data/sre-competence-communes-2026-07.jsonl(565 communes → service compétent)
//
// Règle de compétence (par commune de DOMICILE) : Actiris à Bruxelles, VDAB en
// Flandre, ADG dans les 9 communes germanophones, Forem dans le reste de la
// Wallonie. Le fichier de compétence tranche chaque commune sans ambiguïté.
//
// Ce script :
//  1. importe les 98 implantations → bureaux vérifiés (organisme actiris/forem/
//     vdab/adg, commune via code INS, note = statut si pas "actif") ;
//  2. désactive l'ancien seed SRE (bureaux non issus de cet import) ;
//  3. génère les BureauAssignment "emploi_regional" : chaque commune → l'office
//     ACTIF le plus proche de SON service compétent.
//
// Le VDAB ne publie qu'un siège (offices locaux = localisateur dynamique) : une
// note le signale. Idempotent (upsert par organisme+nom). Dry-run par défaut.
//
// Usage : pnpm bureaux:import-sre          (dry-run)
//         pnpm bureaux:import-sre --yes     (applique)

import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { snapshotBureau } from "@/lib/bureaus/diff";
import { haversineKm } from "@/lib/bureaus/types";
import type { Prisma } from "@prisma/client";

const APPLY = process.argv.includes("--yes");
const SOURCE = "SRE officiels 2026-07-13";
const IMPL_PATH = path.resolve(process.cwd(), "lib/data/sre-implantations-2026-07.jsonl");
const COMP_PATH = path.resolve(process.cwd(), "lib/data/sre-competence-communes-2026-07.jsonl");

const SERVICE_ORG: Record<string, string> = { ACTIRIS: "actiris", FOREM: "forem", VDAB: "vdab", ADG: "adg" };

interface Impl {
  service_emploi_id: string;
  nom: string;
  type_point: string;
  statut: string;
  accueil_public: boolean;
  adresse: { rue_et_numero?: string; code_postal?: string; localite?: string };
  commune_administrative?: { code_ins?: string };
  telephone?: string | null;
  email?: string | null;
  site_web?: string | null;
  notes?: string | null;
}
interface Comp { code_ins: string; service_emploi_id: string }

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}\n`);

  const impls = readFileSync(IMPL_PATH, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Impl);
  const orgs = await prisma.organisme.findMany({ where: { code: { in: Object.values(SERVICE_ORG) } }, select: { id: true, code: true } });
  const orgIdByCode = new Map(orgs.map((o) => [o.code, o.id]));
  const communes = await prisma.commune.findMany({ where: { mergedIntoId: null }, select: { id: true, insCode: true, lat: true, lng: true } });
  const communeByIns = new Map(communes.map((c) => [c.insCode, c]));

  // ── 1. Plan d'import des offices ──────────────────────────────────────
  type Plan = { orgId: string; orgCode: string; name: string; street: string; postalCode: string; city: string; communeId: string | null; phone: string | null; email: string | null; website: string | null; notes: string | null; active: boolean };
  const plans: Plan[] = [];
  let skipped = 0;
  for (const im of impls) {
    const orgCode = SERVICE_ORG[im.service_emploi_id];
    const orgId = orgCode ? orgIdByCode.get(orgCode) : undefined;
    if (!orgId || !im.adresse?.rue_et_numero || !im.adresse.code_postal) { skipped++; continue; }
    const communeId = im.commune_administrative?.code_ins ? communeByIns.get(im.commune_administrative.code_ins)?.id ?? null : null;
    const active = im.statut === "actif";
    const noteParts: string[] = [];
    if (!active) noteParts.push(`Statut : ${im.statut}.`);
    if (im.notes) noteParts.push(im.notes);
    if (orgCode === "vdab") noteParts.push("Bureaux locaux : voir le localisateur officiel VDAB (vdab.be/contact).");
    plans.push({
      orgId, orgCode, name: im.nom.trim(), street: im.adresse.rue_et_numero.trim(),
      postalCode: im.adresse.code_postal.trim(), city: (im.adresse.localite ?? "").trim(),
      communeId, phone: im.telephone ?? null, email: im.email ?? null, website: im.site_web ?? null,
      notes: noteParts.length ? noteParts.join(" ") : null, active,
    });
  }
  const byOrg: Record<string, number> = {};
  for (const p of plans) byOrg[p.orgCode] = (byOrg[p.orgCode] ?? 0) + 1;
  console.log(`${plans.length} implantations à importer (${Object.entries(byOrg).map(([k, v]) => `${k}=${v}`).join(", ")}), ${skipped} ignorées`);
  console.log(`  ${plans.filter((p) => !p.active).length} non-actives (statut ≠ actif)`);

  // Ancien seed à désactiver (null-safe : par nom)
  const planNames = new Set(plans.map((p) => norm(p.name)));
  const activeSre = await prisma.bureau.findMany({ where: { active: true, organisme: { code: { in: Object.values(SERVICE_ORG) } } }, select: { id: true, name: true } });
  const oldSeed = activeSre.filter((b) => !planNames.has(norm(b.name)));
  console.log(`${oldSeed.length} anciens bureaux SRE (seed) à désactiver.`);

  if (!APPLY) { console.log("\nDry-run. --yes pour appliquer."); return; }

  console.log("\n🔥 Import des offices…");
  let created = 0, updated = 0;
  for (const p of plans) {
    const existing = await prisma.bureau.findFirst({ where: { organismeId: p.orgId, type: "AUTRE", name: { equals: p.name } }, select: { id: true } });
    const data = {
      organismeId: p.orgId, type: "AUTRE" as const, name: p.name, street: p.street, streetNum: null,
      postalCode: p.postalCode, city: p.city, communeId: p.communeId, phone: p.phone, email: p.email,
      website: p.website, notes: p.notes, active: p.active, verified: true, verifiedBy: `import:${SOURCE}`,
      lastVerifiedAt: new Date(), updatedBy: "script:import-sre",
    };
    if (existing) { await prisma.bureau.update({ where: { id: existing.id }, data }); updated++; }
    else { await prisma.bureau.create({ data }); created++; }
  }
  for (const b of oldSeed) {
    const before = await prisma.bureau.findUnique({ where: { id: b.id } });
    if (!before) continue;
    await prisma.$transaction([
      prisma.bureauRevision.create({ data: { bureauId: b.id, snapshot: snapshotBureau(before) as Prisma.InputJsonValue, changeNotes: "Remplacé par import SRE officiel", changedBy: "script:import-sre" } }),
      prisma.bureau.update({ where: { id: b.id }, data: { active: false, updatedBy: "script:import-sre" } }),
    ]);
  }
  console.log(`  ✓ ${created} créés, ${updated} mis à jour, ${oldSeed.length} anciens désactivés.`);

  // ── 3. Assignations emploi_regional (compétence par commune) ──────────
  console.log("\n🔥 Compétence territoriale (emploi_regional)…");
  const comps = readFileSync(COMP_PATH, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Comp);
  // Offices ACTIFS par organisme, avec coords (centroïde commune)
  const offices = await prisma.bureau.findMany({
    where: { active: true, verifiedBy: `import:${SOURCE}`, organisme: { code: { in: Object.values(SERVICE_ORG) } } },
    select: { id: true, organisme: { select: { code: true } }, commune: { select: { lat: true, lng: true } } },
  });
  const officesByOrg = new Map<string, { id: string; lat: number; lng: number }[]>();
  for (const o of offices) {
    if (o.commune?.lat == null || o.commune.lng == null) continue;
    const arr = officesByOrg.get(o.organisme.code) ?? [];
    arr.push({ id: o.id, lat: o.commune.lat, lng: o.commune.lng });
    officesByOrg.set(o.organisme.code, arr);
  }
  const assignments: { bureauId: string; communeId: string }[] = [];
  let noOffice = 0, noCommune = 0, noGeoFallback = 0;
  for (const c of comps) {
    const orgCode = SERVICE_ORG[c.service_emploi_id];
    const commune = communeByIns.get(c.code_ins);
    if (!commune) { noCommune++; continue; }
    const pool = officesByOrg.get(orgCode) ?? [];
    if (pool.length === 0) { noOffice++; continue; }
    // Commune géolocalisée → office le plus proche ; sinon → 1er office du
    // service compétent (le SERVICE reste correct, seule la proximité manque).
    let best = pool[0];
    if (commune.lat != null && commune.lng != null) {
      let bestD = Infinity;
      for (const o of pool) {
        const d = haversineKm({ lat: commune.lat, lng: commune.lng }, { lat: o.lat, lng: o.lng });
        if (d < bestD) { bestD = d; best = o; }
      }
    } else {
      noGeoFallback++;
    }
    assignments.push({ bureauId: best.id, communeId: commune.id });
  }
  await prisma.$transaction(async (tx) => {
    await tx.bureauAssignment.deleteMany({ where: { serviceType: "emploi_regional" } });
    await tx.bureauAssignment.createMany({ data: assignments.map((a) => ({ ...a, serviceType: "emploi_regional" })), skipDuplicates: true });
  });
  console.log(`  ✓ ${assignments.length} communes assignées à leur service emploi (${noGeoFallback} repli sans géo, ${noCommune} commune inconnue, ${noOffice} sans office)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
