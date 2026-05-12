import { PrismaClient, Prisma, BelgianRegion, BureauType } from "@prisma/client";
import { COMMUNES_SEED } from "../../lib/data/communes-belges";
import { ALL_BUREAU_SEEDS } from "../../lib/data/bureaus-seed";
import { SYNDICATS_SEED, PERMANENCES_SEED } from "../../lib/data/bureaus-seed-syndicats";
import { ALL_EXTENDED_SEEDS } from "../../lib/data/bureaus-seed-extended";

export async function seedBureaus(prisma: PrismaClient) {
  let communesCreated = 0;
  let communesUpdated = 0;
  let postalsCreated = 0;
  let bureausCreated = 0;
  let bureausUpdated = 0;
  let assignmentsCreated = 0;

  // ============== Communes ==============
  // Map insCode → communeId pour les FK des bureaux
  const insToId = new Map<string, string>();

  for (const c of COMMUNES_SEED) {
    const existing = await prisma.commune.findUnique({ where: { insCode: c.insCode } });
    if (existing) {
      const updated = await prisma.commune.update({
        where: { insCode: c.insCode },
        data: {
          nameFr: c.nameFr,
          nameNl: c.nameNl,
          nameDe: c.nameDe,
          region: c.region as BelgianRegion,
          province: c.province,
          lat: c.lat,
          lng: c.lng,
        },
      });
      insToId.set(c.insCode, updated.id);
      communesUpdated++;
    } else {
      const created = await prisma.commune.create({
        data: {
          insCode: c.insCode,
          nameFr: c.nameFr,
          nameNl: c.nameNl,
          nameDe: c.nameDe,
          region: c.region as BelgianRegion,
          province: c.province,
          lat: c.lat,
          lng: c.lng,
        },
      });
      insToId.set(c.insCode, created.id);
      communesCreated++;
    }

    // Postal codes (idempotents)
    for (const code of c.postalCodes) {
      const existing = await prisma.postalCode.findUnique({ where: { code } });
      if (!existing) {
        await prisma.postalCode.create({
          data: {
            code,
            communeId: insToId.get(c.insCode)!,
          },
        });
        postalsCreated++;
      } else if (existing.communeId !== insToId.get(c.insCode)) {
        // Réassigne si changement (très rare, mais utile en cas de fusion)
        await prisma.postalCode.update({
          where: { code },
          data: { communeId: insToId.get(c.insCode)! },
        });
      }
    }
  }

  console.log(`  ✓ Communes : ${communesCreated} créées, ${communesUpdated} mises à jour`);
  console.log(`  ✓ Codes postaux : ${postalsCreated} créés`);

  // ============== Bureaux ==============
  // Map (organismeCode + name) pour idempotence (pas d'unique constraint multi-col)
  // On utilise une signature [type, postalCode, name].
  const orgs = await prisma.organisme.findMany();
  const orgByCode = new Map(orgs.map((o) => [o.code, o]));

  const allSeeds = [
    ...ALL_BUREAU_SEEDS,
    ...SYNDICATS_SEED,
    ...PERMANENCES_SEED,
    ...ALL_EXTENDED_SEEDS,
  ];

  // Index existant pour idempotence
  const existing = await prisma.bureau.findMany({
    select: { id: true, name: true, postalCode: true, type: true },
  });
  const existingByKey = new Map(
    existing.map((b) => [`${b.type}|${b.postalCode}|${b.name}`, b.id])
  );

  for (const seed of allSeeds) {
    const org = orgByCode.get(seed.organismeCode);
    if (!org) {
      console.warn(`  ⚠ Organisme '${seed.organismeCode}' introuvable (skip ${seed.name})`);
      continue;
    }

    const communeId = seed.insCode ? insToId.get(seed.insCode) ?? null : null;
    if (seed.insCode && !communeId) {
      console.warn(`  ⚠ Commune INS '${seed.insCode}' inconnue (skip commune binding pour ${seed.name})`);
    }

    const data = {
      organismeId: org.id,
      type: seed.type as BureauType,
      name: seed.name,
      nameNl: seed.nameNl ?? null,
      nameDe: seed.nameDe ?? null,
      street: seed.street,
      streetNum: seed.streetNum ?? null,
      postalCode: seed.postalCode,
      city: seed.city,
      lat: seed.lat ?? null,
      lng: seed.lng ?? null,
      communeId,
      phone: seed.phone ?? null,
      website: seed.website ?? null,
      appointmentUrl: seed.appointmentUrl ?? null,
      hours: (seed.hours ?? []) as Prisma.InputJsonValue,
      hoursNotes: seed.hoursNotes ?? null,
      services: (seed.services ?? []) as Prisma.InputJsonValue,
    };

    const key = `${seed.type}|${seed.postalCode}|${seed.name}`;
    const existingId = existingByKey.get(key);

    if (existingId) {
      await prisma.bureau.update({ where: { id: existingId }, data });
      bureausUpdated++;
    } else {
      const created = await prisma.bureau.create({ data });
      bureausCreated++;

      // Assignments ONEM ↔ communes (uniquement à la création initiale)
      if (seed.type === "ONEM" && Array.isArray(seed.servesInsCodes)) {
        for (const ins of seed.servesInsCodes) {
          const cId = insToId.get(ins);
          if (!cId) continue;
          await prisma.bureauAssignment
            .create({
              data: {
                bureauId: created.id,
                communeId: cId,
                serviceType: "chomage",
              },
            })
            .catch(() => {
              // déjà présent
            });
          assignmentsCreated++;
        }
      }
    }
  }

  // Si bureau ONEM existe déjà : on remplit les assignments manquants
  for (const seed of allSeeds) {
    if (seed.type !== "ONEM" || !Array.isArray(seed.servesInsCodes)) continue;
    const key = `${seed.type}|${seed.postalCode}|${seed.name}`;
    const bId = existingByKey.get(key);
    if (!bId) continue;
    for (const ins of seed.servesInsCodes) {
      const cId = insToId.get(ins);
      if (!cId) continue;
      const exists = await prisma.bureauAssignment.findUnique({
        where: {
          bureauId_communeId_serviceType: {
            bureauId: bId,
            communeId: cId,
            serviceType: "chomage",
          },
        },
      });
      if (!exists) {
        await prisma.bureauAssignment.create({
          data: { bureauId: bId, communeId: cId, serviceType: "chomage" },
        });
        assignmentsCreated++;
      }
    }
  }

  console.log(`  ✓ Bureaux : ${bureausCreated} créés, ${bureausUpdated} mis à jour`);
  console.log(`  ✓ Assignments ONEM : ${assignmentsCreated} créés`);
}
