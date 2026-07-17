import { NextRequest, NextResponse } from "next/server";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  C1_IMPROVEMENT_TARGETS,
  applyOneC1Improvement,
} from "@/lib/pdf-forms/seed/apply-c1-improvements-core";
import type { AcroFieldRaw, PdfFormField } from "@/lib/pdf-forms/types";

const json = { "Content-Type": "application/json; charset=utf-8" };

function sameJson(left: unknown, right: unknown): boolean {
  // Prisma peut réordonner les clés d'un JSON et retire les propriétés
  // `undefined`. Ces différences de sérialisation ne sont pas une dérive du
  // seed : on compare donc leur forme JSON normalisée, clé par clé.
  const normalize = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
  return isDeepStrictEqual(normalize(left), normalize(right));
}

/// GET — compare les champs DB avec la version idempotente produite par
/// `improve()` du seed source. Sert au banner « Sync requis » côté admin
/// (Feature #3 des ameliorations post-plan bindings-canonical-ux).
///
/// Reponses :
///   { hasSeedSource: false }
///   -> le slug n'a pas de fonction improve() associee dans
///      C1_IMPROVEMENT_TARGETS -> aucun diff possible. Le formulaire a
///      été importé manuellement, pas de banner à afficher.
///
///   { hasSeedSource: true, hasDiff: false, fieldsCount: n }
///   -> DB alignee avec le seed. RAS.
///
///   { hasSeedSource: true, hasDiff: true, fieldsCount: n, expectedCount: m,
///     idsAdded: [...], idsRemoved: [...], idsModified: [...] }
///   -> DB derive. Banner + bouton Sync.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });
  }

  const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === form.slug);
  if (!target) {
    return NextResponse.json({ hasSeedSource: false }, { headers: json });
  }

  const dbFields = (form.fields as unknown as PdfFormField[]) || [];
  // La synchronisation applique le seed avec l'inventaire AcroForm courant.
  // La comparaison doit employer le même contexte, sinon le banner signale à
  // tort une divergence juste après une synchronisation.
  const seedFields = target.improve(dbFields, {
    technicalSchema: (form.technicalSchema as unknown as AcroFieldRaw[]) || [],
  });

  // Comparaison par id : ajoutes / retires / modifies (JSON deep-equal
  // par champ). Suffit pour signaler la derive dans l'admin ; pas la
  // peine de deep-diff les proprietes une par une.
  const dbById = new Map(dbFields.map((f) => [f.id, f]));
  const seedById = new Map(seedFields.map((f) => [f.id, f]));
  const idsAdded: string[] = [];
  const idsRemoved: string[] = [];
  const idsModified: string[] = [];
  for (const [seedId, seedField] of seedById) {
    const dbField = dbById.get(seedId);
    if (!dbField) {
      idsAdded.push(seedId);
      continue;
    }
    if (!sameJson(dbField, seedField)) {
      idsModified.push(seedId);
    }
  }
  for (const dbId of dbById.keys()) {
    if (!seedById.has(dbId)) idsRemoved.push(dbId);
  }

  const hasDiff =
    idsAdded.length > 0 || idsRemoved.length > 0 || idsModified.length > 0;

  return NextResponse.json(
    {
      hasSeedSource: true,
      hasDiff,
      fieldsCount: dbFields.length,
      expectedCount: seedFields.length,
      // On plafonne l'affichage a 20 ids par categorie pour eviter un
      // payload monstre sur un gros diff -- l'admin verra les premiers,
      // suffisant pour se convaincre de synchroniser.
      idsAdded: idsAdded.slice(0, 20),
      idsRemoved: idsRemoved.slice(0, 20),
      idsModified: idsModified.slice(0, 20),
    },
    { headers: json }
  );
}

/// POST — applique la version idempotente sur ce PdfForm uniquement
/// (equivalent a `pnpm tsx scripts/apply-c1-improvements.ts --yes` mais
/// pour un seul slug). Ecrit `fields` + `triggers` en DB.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });
  }
  const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === form.slug);
  if (!target) {
    return NextResponse.json(
      { error: "Ce formulaire n'a pas de seed source." },
      { status: 400, headers: json }
    );
  }

  const result = await applyOneC1Improvement(target, true);
  return NextResponse.json({ ok: true, result }, { headers: json });
}
