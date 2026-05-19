/// Script one-shot : remappe les références aux anciens presets builtin
/// vers leur équivalent canonique, puis supprime les anciens.
///
/// Idempotent : si plus rien à supprimer, c'est un no-op.
///
/// Mappings best-effort. Refs sans équivalent → presetId = null (le champ
/// garde tout le reste, juste pas de preset de validation rattaché).
///
/// **À supprimer** après une exécution réussie (one-shot migration data).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REMAP_BY_OLD_NAME: Record<string, string | null> = {
  "Nom complet (prénom + nom)": "Prénom et nom",
  "NISS belge": "NISS",
  "Date future": "Date générique",
  "Date passée": "Date générique",
  "Date majeur (18+ ans)": "Date de naissance",
  "IBAN belge": "IBAN",
  "BCE / Numéro d'entreprise": "N° BCE",
  "TVA belge": "N° BCE",
  "Code postal belge": "Code postal",
  "Rue (nom de voie)": "Rue",
  "Ville": "Commune",
  "Téléphone belge": "Téléphone",
  "Nom de famille": "Nom",
  // Champs sans équivalent direct → on perd juste la validation
  "Texte court (max 100)": null,
  "Texte long (max 1000)": null,
  "Montant en euros (positif)": null,
  "Salaire mensuel brut": null,
  "Pourcentage (0–100)": null,
  "Prénom": "Prénom",
};

interface FieldLike {
  presetId?: string | null;
  [key: string]: unknown;
}

async function main() {
  const oldPresets = await prisma.fieldValidationPreset.findMany({
    where: { defaultLabel: null, builtin: true },
    select: { id: true, name: true },
  });

  if (oldPresets.length === 0) {
    console.log("Rien à migrer : aucun ancien preset builtin restant.");
    return;
  }

  console.log(`Migration de ${oldPresets.length} anciens presets builtin…\n`);

  const newPresets = await prisma.fieldValidationPreset.findMany({
    where: { defaultLabel: { not: null } },
    select: { id: true, name: true },
  });
  const newByName = new Map(newPresets.map((p) => [p.name, p.id]));

  const remapTable = new Map<string, string | null>();
  for (const old of oldPresets) {
    const newName = REMAP_BY_OLD_NAME[old.name];
    const newId = newName ? newByName.get(newName) ?? null : null;
    remapTable.set(old.id, newId);
  }

  // 1. Mise à jour des DocumentTemplate.schema (JSON)
  const tpls = await prisma.documentTemplate.findMany({
    select: { id: true, schema: true, tool: { select: { name: true } } },
  });
  let tplRemapped = 0;
  let tplCleared = 0;
  for (const t of tpls) {
    const fields = (t.schema as FieldLike[] | null) || [];
    let dirty = false;
    for (const f of fields) {
      if (!f || !f.presetId || !remapTable.has(f.presetId)) continue;
      const newId = remapTable.get(f.presetId);
      if (newId) {
        f.presetId = newId;
        tplRemapped++;
      } else {
        f.presetId = null;
        tplCleared++;
      }
      dirty = true;
    }
    if (dirty) {
      await prisma.documentTemplate.update({
        where: { id: t.id },
        data: { schema: fields as unknown as object },
      });
      console.log(`  ↻ Template "${t.tool?.name ?? t.id}"`);
    }
  }

  // 2. Mise à jour des OcrCorrectionMemory.presetId
  const oldIds = oldPresets.map((o) => o.id);
  const memEntries = await prisma.ocrCorrectionMemory.findMany({
    where: { presetId: { in: oldIds } },
  });
  let memRemapped = 0;
  let memCleared = 0;
  for (const m of memEntries) {
    const newId = remapTable.get(m.presetId as string);
    await prisma.ocrCorrectionMemory.update({
      where: { id: m.id },
      data: { presetId: newId ?? null },
    });
    if (newId) memRemapped++;
    else memCleared++;
  }

  console.log(`\nDocumentTemplate : ${tplRemapped} refs remappées, ${tplCleared} clearées`);
  console.log(`OcrCorrectionMemory : ${memRemapped} remappées, ${memCleared} clearées`);

  // 3. Suppression des anciens presets
  const deleted = await prisma.fieldValidationPreset.deleteMany({
    where: { defaultLabel: null, builtin: true },
  });
  console.log(`\nAnciens presets supprimés : ${deleted.count}`);

  const finalCount = await prisma.fieldValidationPreset.count();
  console.log(`Total presets restants : ${finalCount}`);
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
