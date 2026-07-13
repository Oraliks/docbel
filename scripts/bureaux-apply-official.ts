// Lot 2 du plan qualité bureaux : applique les annuaires OFFICIELS d'adresses
// (CPAS/OCMW + administrations communales) sur les bureaux.
//
// Sources (fournies + validées par Oraliks, aucune valeur devinée) :
//   - lib/data/cpas-officiel-2026-01.json      (565 CPAS/OCMW/OSHZ, mi-is.be)
//   - lib/data/communes-officiel-2026-07.json  (565 communes ; Vlaanderen.be,
//                                               ODWB/UVCW, sites bruxellois, REFNIS)
//
// Matching :
//   - communes : par code INS (REFNIS) → Commune.insCode  (fiable)
//   - CPAS     : par nom de commune → Commune.nameFr/nameNl (normalisé)
//
// Garde-fous :
//   - non destructif sélectif : écrase l'adresse d'un bureau ACTIF non `verified`
//     (stub OU import OSM approximatif) ; ne touche JAMAIS un bureau déjà
//     `verified=true` (travail humain).
//   - cross-check CP : pour les CPAS (match par nom), on VÉRIFIE que le code
//     postal officiel appartient aux CP réels de la commune (table PostalCode).
//     Incohérence → on n'écrit pas, on logue (protège d'un mauvais appariement).
//     Les communes (match INS) sont fiables → CP officiel appliqué tel quel.
//   - provenance : verified=true, verifiedBy="import:<source>", lastVerifiedAt.
//   - snapshot BureauRevision avant chaque écriture ; dry-run par défaut.
//
// Usage :
//   pnpm bureaux:apply-official          (dry-run, rapport)
//   pnpm bureaux:apply-official --yes    (applique)

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { snapshotBureau } from "@/lib/bureaus/diff";
import { isStubAddress } from "@/lib/bureaus/dedupe";
import type { Prisma } from "@prisma/client";

const APPLY = process.argv.includes("--yes");
const CPAS_PATH = path.resolve(process.cwd(), "lib/data/cpas-officiel-2026-01.json");
const COMMUNES_PATH = path.resolve(process.cwd(), "lib/data/communes-officiel-2026-07.json");
const CPAS_SOURCE = "mi-is.be 2026-01";
const COMMUNES_SOURCE = "REFNIS+régions 2026-07";

interface CpasRaw {
  type: string; // CPAS | OCMW | OSHZ
  organisation: string;
  commune: string;
  adresse: string;
  code_postal: string;
  localite_adresse: string;
  telephone?: string | null;
  email?: string | null;
}
interface CommuneRaw {
  code_ins: string;
  commune: string;
  administration: {
    nom: string;
    adresse: { rue_et_numero: string; code_postal: string; localite: string };
    telephone?: string | null;
    email?: string | null;
    site_web?: string | null;
  };
}

type Normalized = {
  bureauType: "CPAS" | "COMMUNE";
  matchBy: "ins" | "name";
  insCode?: string;
  communeName: string;
  officialName: string; // nom officiel (administration.nom / organisation)
  street: string;
  postalCode: string;
  city: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  source: string;
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Retire le suffixe de désambiguïsation entre parenthèses : "Hove (Anvers)" → "Hove". */
function stripParen(s: string): string {
  return s.replace(/\s*\(.*?\)\s*/g, " ").trim();
}

function loadNormalized(): Normalized[] {
  const out: Normalized[] = [];
  if (existsSync(CPAS_PATH)) {
    const cpas = JSON.parse(readFileSync(CPAS_PATH, "utf8")) as CpasRaw[];
    for (const c of cpas) {
      out.push({
        bureauType: "CPAS", // OCMW/OSHZ = CPAS en NL/DE
        matchBy: "name",
        communeName: c.commune,
        officialName: c.organisation.trim(),
        street: c.adresse.trim(),
        postalCode: c.code_postal.trim(),
        city: c.localite_adresse.trim(),
        phone: c.telephone?.trim() || null,
        email: c.email?.trim() || null,
        website: null,
        source: CPAS_SOURCE,
      });
    }
  }
  if (existsSync(COMMUNES_PATH)) {
    const communes = JSON.parse(readFileSync(COMMUNES_PATH, "utf8")) as CommuneRaw[];
    for (const c of communes) {
      const a = c.administration.adresse;
      out.push({
        bureauType: "COMMUNE",
        matchBy: "ins",
        insCode: c.code_ins,
        communeName: c.commune,
        officialName: c.administration.nom.trim(),
        street: a.rue_et_numero.trim(),
        postalCode: a.code_postal.trim(),
        city: a.localite.trim(),
        phone: c.administration.telephone?.trim() || null,
        email: c.administration.email?.trim() || null,
        website: c.administration.site_web?.trim() || null,
        source: COMMUNES_SOURCE,
      });
    }
  }
  return out;
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}\n`);

  const entries = loadNormalized();
  if (entries.length === 0) {
    console.log("Aucune donnée. Attendus :");
    console.log(`  ${CPAS_PATH}`);
    console.log(`  ${COMMUNES_PATH}`);
    return;
  }
  console.log(`${entries.length} entrées officielles (CPAS + communes).`);

  const communes = await prisma.commune.findMany({
    where: { mergedIntoId: null },
    select: { id: true, insCode: true, nameFr: true, nameNl: true },
  });
  const byIns = new Map(communes.map((c) => [c.insCode, c.id]));
  const byName = new Map<string, string>(); // nom complet normalisé → id (exact)
  const byStripped = new Map<string, string[]>(); // nom sans parenthèses → candidats
  for (const c of communes) {
    for (const raw of [c.nameFr, c.nameNl]) {
      if (!raw) continue;
      byName.set(norm(raw), c.id);
      const key = norm(stripParen(raw));
      if (!byStripped.has(key)) byStripped.set(key, []);
      if (!byStripped.get(key)!.includes(c.id)) byStripped.get(key)!.push(c.id);
    }
  }
  const pcs = await prisma.postalCode.findMany({ select: { code: true, communeId: true } });
  const cpsByCommune = new Map<string, Set<string>>();
  for (const p of pcs) {
    if (!cpsByCommune.has(p.communeId)) cpsByCommune.set(p.communeId, new Set());
    cpsByCommune.get(p.communeId)!.add(p.code);
  }

  /** Résout une commune par nom : exact → sans parenthèses (unique) → désambiguïsé par CP. */
  function resolveByName(name: string, cp: string): string | null {
    const exact = byName.get(norm(name));
    if (exact) return exact;
    const cands = byStripped.get(norm(stripParen(name)));
    if (!cands || cands.length === 0) return null;
    if (cands.length === 1) return cands[0];
    // Plusieurs candidats (noms ambigus type "Celles") → départage par CP officiel
    const byCp = cands.find((id) => cpsByCommune.get(id)?.has(cp));
    return byCp ?? null;
  }

  const stats = { noCommune: 0, cpReject: 0, noTarget: 0, alreadyVerified: 0, planned: 0 };
  const noCommuneSample: string[] = [];
  const cpRejectSample: string[] = [];
  const plan: { id: string; e: Normalized }[] = [];

  for (const e of entries) {
    // Communes : INS d'abord (fiable), fallback par nom si l'INS diffère (drift
    // de codes entre notre table et REFNIS 2025). CPAS : nom uniquement.
    const communeId =
      e.matchBy === "ins"
        ? byIns.get(e.insCode!) ?? resolveByName(e.communeName, e.postalCode)
        : resolveByName(e.communeName, e.postalCode);
    if (!communeId) {
      stats.noCommune++;
      if (noCommuneSample.length < 12) noCommuneSample.push(`${e.bureauType} ${e.communeName}${e.insCode ? ` [${e.insCode}]` : ""}`);
      continue;
    }
    // Cross-check CP pour les matchs par nom (CPAS)
    if (e.matchBy === "name") {
      const set = cpsByCommune.get(communeId);
      if (set && set.size > 0 && !set.has(e.postalCode)) {
        stats.cpReject++;
        if (cpRejectSample.length < 12) cpRejectSample.push(`${e.communeName} → CP officiel ${e.postalCode} ∉ commune`);
        continue;
      }
    }
    const target = await prisma.bureau.findFirst({
      where: { active: true, type: e.bureauType, communeId },
      select: { id: true, verified: true, verifiedBy: true },
    });
    if (!target) { stats.noTarget++; continue; }
    // On écrase un bureau non vérifié OU déjà posé par CE script (ré-application
    // idempotente) ; on ne clobbre JAMAIS une vérification humaine.
    const humanVerified = target.verified && !(target.verifiedBy ?? "").startsWith("import:");
    if (humanVerified) { stats.alreadyVerified++; continue; }
    plan.push({ id: target.id, e });
    stats.planned++;
  }

  console.log(`\nPlan : ${stats.planned} adresses officielles à poser`);
  console.log(`  rejets : ${stats.noCommune} commune introuvable, ${stats.cpReject} CP incohérent (CPAS), ${stats.noTarget} sans bureau cible, ${stats.alreadyVerified} déjà vérifiés`);
  if (noCommuneSample.length) console.log(`  communes introuvables (éch.) : ${noCommuneSample.join(" | ")}`);
  if (cpRejectSample.length) console.log(`  CP incohérents (éch.) : ${cpRejectSample.join(" | ")}`);

  if (!APPLY) {
    console.log("\nDry-run terminé. Relance avec --yes pour appliquer.");
    return;
  }

  console.log("\n🔥 Application (snapshot + écriture)…");
  let done = 0;
  for (const { id, e } of plan) {
    const before = await prisma.bureau.findUnique({ where: { id } });
    if (!before) continue;
    await prisma.$transaction([
      prisma.bureauRevision.create({
        data: {
          bureauId: id,
          snapshot: snapshotBureau(before) as Prisma.InputJsonValue,
          changeNotes: `Adresse officielle (${e.source}) via bureaux:apply-official`,
          changedBy: "script:bureaux-apply-official",
        },
      }),
      prisma.bureau.update({
        where: { id },
        data: {
          name: e.officialName, // corrige les noms trompeurs hérités d'OSM
          street: e.street,
          streetNum: null, // rue_et_numero contient déjà le numéro
          postalCode: e.postalCode,
          city: e.city,
          phone: e.phone ?? before.phone,
          email: e.email ?? before.email,
          website: e.website ?? before.website,
          verified: true,
          verifiedBy: `import:${e.source}`,
          lastVerifiedAt: new Date(),
          updatedBy: "script:bureaux-apply-official",
        },
      }),
    ]);
    done++;
  }
  console.log(`✓ ${done} adresses officielles posées (verified=true).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
