/**
 * Backfill des coordonnées manquantes (maintenance ponctuelle).
 *
 *  A) Communes sans centroïde (`Commune.lat/lng` null) → géocodage Nominatim
 *     (CP représentatif + nom + Belgique). Sans centroïde, ces communes sont
 *     EXCLUES des scripts d'affectation (bureaux:assign*, filtre `lat: {not:null}`)
 *     → elles ne résolvent aucun bureau. Les recoords rétablit leur couverture.
 *
 *  B) Bureaux encore sans coords après `bureaux:geocode`, à cause d'un `city`
 *     malformé (ex. « Machelen (Brab.) », « Liege 1 » = suffixe code ONEM) que
 *     Nominatim ne parse pas. On re-géocode avec un `city` ASSAINI (parenthèses
 *     et suffixe numérique retirés) — SANS modifier la donnée `city` stockée.
 *
 * Idempotent (ne touche que les lignes lat/lng null), dry-run par défaut,
 * `--yes` pour écrire. Throttle Nominatim 1100 ms + User-Agent (politique OSM).
 *
 *   pnpm bureaux:backfill-coords          (dry-run)
 *   pnpm bureaux:backfill-coords --yes    (applique)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--yes");
const UA = "DocBel/1.0 (backfill coordonnées bureaux; +https://docbel.be)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nominatim(
  params: Record<string, string>
): Promise<{ lat: number; lng: number } | null> {
  const qs = new URLSearchParams({ format: "json", limit: "1", countrycodes: "be", ...params });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as { lat: string; lon: string }[];
    if (!arr.length) return null;
    return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
  } catch {
    return null;
  }
}

/** Retire les parenthèses de désambiguïsation et un suffixe numérique parasite. */
function sanitizeCity(city: string): string {
  return city
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN (--yes pour écrire)"}\n`);

  // A) Communes sans centroïde
  const communes = await prisma.commune.findMany({
    where: { mergedIntoId: null, OR: [{ lat: null }, { lng: null }] },
    select: {
      id: true,
      insCode: true,
      nameFr: true,
      nameNl: true,
      postalCodes: { select: { code: true }, orderBy: { code: "asc" }, take: 1 },
    },
  });
  console.log(`— Communes sans centroïde : ${communes.length} —`);
  let cOk = 0;
  let cFail = 0;
  for (const c of communes) {
    const cp = c.postalCodes[0]?.code ?? null;
    const name = c.nameFr || c.nameNl || "";
    let geo = cp ? await nominatim({ postalcode: cp, city: name }) : null;
    await sleep(1100);
    if (!geo && name) {
      geo = await nominatim({ q: `${cp ?? ""} ${name}, Belgique` });
      await sleep(1100);
    }
    if (geo) {
      cOk++;
      console.log(`  ✓ ${c.insCode} ${name} (${cp}) → ${geo.lat.toFixed(4)},${geo.lng.toFixed(4)}`);
      if (APPLY) await prisma.commune.update({ where: { id: c.id }, data: { lat: geo.lat, lng: geo.lng } });
    } else {
      cFail++;
      console.log(`  ✗ ${c.insCode} ${name} (${cp}) — introuvable`);
    }
  }

  // B) Bureaux encore sans coords (city malformé)
  const bureaux = await prisma.bureau.findMany({
    where: { active: true, OR: [{ lat: null }, { lng: null }] },
    select: { id: true, type: true, name: true, street: true, streetNum: true, postalCode: true, city: true },
  });
  console.log(`\n— Bureaux sans coords : ${bureaux.length} —`);
  let bOk = 0;
  let bFail = 0;
  for (const b of bureaux) {
    const city = sanitizeCity(b.city);
    const street = [b.street, b.streetNum].filter(Boolean).join(" ");
    let geo = await nominatim({ street, postalcode: b.postalCode, city });
    await sleep(1100);
    if (!geo) {
      geo = await nominatim({ q: `${street}, ${b.postalCode} ${city}, Belgique` });
      await sleep(1100);
    }
    if (!geo) {
      geo = await nominatim({ postalcode: b.postalCode, city });
      await sleep(1100);
    }
    if (geo) {
      bOk++;
      const tag = city !== b.city ? ` [${b.city}→${city}]` : "";
      console.log(`  ✓ ${b.type} ${b.postalCode} ${b.name}${tag} → ${geo.lat.toFixed(4)},${geo.lng.toFixed(4)}`);
      if (APPLY) await prisma.bureau.update({ where: { id: b.id }, data: { lat: geo.lat, lng: geo.lng } });
    } else {
      bFail++;
      console.log(`  ✗ ${b.type} ${b.postalCode} ${b.name} [${b.city}] — introuvable`);
    }
  }

  console.log(`\n— Résumé — communes ✓${cOk}/✗${cFail} · bureaux ✓${bOk}/✗${bFail}`);
  if (!APPLY) console.log("\nDry-run terminé. Relance avec --yes pour écrire.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
