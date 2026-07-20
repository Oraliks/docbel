/**
 * Peuple `legalMeta.lookupRefs` des articles RioLex à partir de la carte
 * éditoriale `lib/data/riolex-lookup-refs.json` (clé = riolexId, valeur =
 * LookupCodeRef[]). C'est le pont « Codes ONEM liés » côté données : le rendu
 * (sidebar de la fiche article) lit ce même champ.
 *
 * Le fichier JSON est la source de vérité : pour chaque riolexId présent, on
 * REMPLACE `lookupRefs` par la valeur du fichier (tableau vide ⇒ on retire la
 * clé). Idempotent. Les clés préfixées « __ » sont ignorées (doc/exemples).
 *
 * Garde-fous :
 *   - chaque `tableSlug` doit exister dans LookupTable (sinon warn + skip global) ;
 *   - normalisation identique au rendu (`normalizeLookupRefs`) : trim, dédup,
 *     filtrage des entrées incomplètes, cap à 12.
 *
 * Usage :
 *   pnpm attach:lookup-refs --dry     # aperçu, aucune écriture
 *   pnpm attach:lookup-refs           # applique
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";
import { normalizeLookupRefs } from "@/lib/reglementation/lookup-refs";
import type { LegalMeta } from "@/components/reglementation/types";

const DRY = process.argv.includes("--dry");
const MAP_PATH = join(process.cwd(), "lib/data/riolex-lookup-refs.json");

async function main() {
  const rawMap = JSON.parse(readFileSync(MAP_PATH, "utf8")) as Record<string, unknown>;

  // Clés éditoriales réelles (on ignore la doc/exemples préfixés « __ »).
  const entries = Object.entries(rawMap).filter(([k]) => !k.startsWith("__"));
  if (entries.length === 0) {
    console.log(
      "Carte vide (aucun riolexId hors clés __). Édite lib/data/riolex-lookup-refs.json puis relance.",
    );
    return;
  }

  // 1) Slugs Lookup valides (garde-fou anti-typo).
  const tables = await prisma.lookupTable.findMany({ select: { slug: true } });
  const validSlugs = new Set(tables.map((t) => t.slug));

  const unknown = new Set<string>();
  for (const [, refs] of entries) {
    for (const r of normalizeLookupRefs(refs)) {
      if (!validSlugs.has(r.tableSlug)) unknown.add(r.tableSlug);
    }
  }
  if (unknown.size > 0) {
    console.error(
      `\n❌ tableSlug inconnu(s) dans LookupTable : ${[...unknown].join(", ")}\n` +
        `   Corrige la carte (slugs valides visibles dans /admin/chomage/lookup) puis relance.`,
    );
    process.exit(1);
  }

  console.log(`${DRY ? "[DRY] " : ""}${entries.length} article(s) à traiter.\n`);

  let updated = 0;
  let missing = 0;

  for (const [riolexId, refs] of entries) {
    const normalized = normalizeLookupRefs(refs);

    // On ne cible que le TEXTE (jamais le commentaire ONEM).
    const rows = await prisma.knowledgeSource.findMany({
      where: {
        domain: "chomage",
        legalMeta: { path: ["riolexId"], equals: riolexId },
      },
      select: { id: true, legalMeta: true },
    });
    const targets = rows.filter(
      (r) => (r.legalMeta as LegalMeta | null)?.isOnemCommentary !== true,
    );

    if (targets.length === 0) {
      console.warn(`  ⚠ ${riolexId} : aucun article trouvé — ignoré.`);
      missing++;
      continue;
    }

    for (const target of targets) {
      const meta = { ...((target.legalMeta as LegalMeta | null) ?? {}) };
      if (normalized.length > 0) meta.lookupRefs = normalized;
      else delete meta.lookupRefs;

      console.log(
        `  ${normalized.length > 0 ? "✓" : "∅"} ${riolexId} → ${normalized.length} code(s)` +
          (normalized.length ? ` [${normalized.map((r) => r.code ?? r.tableSlug).join(", ")}]` : ""),
      );

      if (!DRY) {
        await prisma.knowledgeSource.update({
          where: { id: target.id },
          data: { legalMeta: meta as object },
        });
      }
      updated++;
    }
  }

  console.log(
    `\n${DRY ? "[DRY] aucune écriture. " : ""}${updated} maj, ${missing} article(s) introuvable(s).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
