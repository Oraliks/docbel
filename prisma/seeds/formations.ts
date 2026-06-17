/**
 * Seed V1 du module Formations : catégories, tags, badges, branches Boussole,
 * 15 questions + barème, et un jeu de démonstration (1 organisation + 4
 * formations publiées) pour que le catalogue et les recommandations ne soient
 * pas vides. Idempotent : upsert par slug/key, questions seedées une seule fois.
 */
import type { PrismaClient } from "@prisma/client";
import { CATEGORIES, TAGS, BADGES } from "../../lib/formations/seed-data";
import { BRANCHES } from "../../lib/formations/boussole/branches";
import { QUESTIONS } from "../../lib/formations/boussole/questions";

export async function seedFormations(prisma: PrismaClient) {
  // --- Catégories ---
  for (const c of CATEGORIES) {
    await prisma.trainingCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, color: c.color, order: c.order },
      create: { slug: c.slug, name: c.name, icon: c.icon, color: c.color, order: c.order },
    });
  }
  console.log(`   ✓ ${CATEGORIES.length} catégories`);

  // --- Tags ---
  for (const t of TAGS) {
    await prisma.trainingTag.upsert({
      where: { slug: t.slug },
      update: { name: t.name, type: t.type, isOrientationTag: t.isOrientationTag },
      create: { slug: t.slug, name: t.name, type: t.type, isOrientationTag: t.isOrientationTag },
    });
  }
  console.log(`   ✓ ${TAGS.length} tags`);

  // --- Badges ---
  for (const b of BADGES) {
    await prisma.trainingBadge.upsert({
      where: { slug: b.slug },
      update: { name: b.name, controlledByAdmin: b.controlledByAdmin, icon: b.icon, color: b.color, order: b.order },
      create: { slug: b.slug, name: b.name, controlledByAdmin: b.controlledByAdmin, icon: b.icon, color: b.color, order: b.order },
    });
  }
  console.log(`   ✓ ${BADGES.length} badges`);

  // --- Branches Boussole ---
  for (const br of BRANCHES) {
    await prisma.orientationBranch.upsert({
      where: { key: br.key },
      update: {
        slug: br.slug,
        name: br.name,
        description: br.description,
        possibleJobs: br.possibleJobs,
        icon: br.icon,
        color: br.color,
        order: br.order,
      },
      create: {
        key: br.key,
        slug: br.slug,
        name: br.name,
        description: br.description,
        possibleJobs: br.possibleJobs,
        icon: br.icon,
        color: br.color,
        order: br.order,
      },
    });
  }
  console.log(`   ✓ ${BRANCHES.length} branches d'orientation`);

  // --- Questions Boussole (seedées une seule fois) ---
  const existingQuestions = await prisma.orientationQuestion.count();
  if (existingQuestions === 0) {
    const branchRows = await prisma.orientationBranch.findMany({ select: { id: true, key: true } });
    const branchIdByKey = new Map(branchRows.map((b) => [b.key, b.id]));

    for (let qi = 0; qi < QUESTIONS.length; qi++) {
      const q = QUESTIONS[qi];
      const question = await prisma.orientationQuestion.create({
        data: { text: q.text, description: q.description, order: qi + 1 },
      });
      for (let oi = 0; oi < q.options.length; oi++) {
        const opt = q.options[oi];
        const option = await prisma.orientationAnswerOption.create({
          data: { questionId: question.id, label: opt.label, value: opt.value, order: oi },
        });
        const scoreRows = Object.entries(opt.scores)
          .filter(([, pts]) => !!pts)
          .map(([branchKey, pts]) => ({
            optionId: option.id,
            branchId: branchIdByKey.get(branchKey)!,
            score: pts as number,
          }))
          .filter((r) => r.branchId);
        if (scoreRows.length > 0) {
          await prisma.orientationAnswerScore.createMany({ data: scoreRows });
        }
      }
    }
    console.log(`   ✓ ${QUESTIONS.length} questions Boussole + barème`);
  } else {
    console.log(`   ~ questions Boussole déjà présentes (${existingQuestions}) — skip`);
  }

  // --- Jeu de démonstration : organisation + formations publiées ---
  await seedDemoTrainings(prisma);

  // --- V2 : recommandations contextuelles (formations ↔ outils Docbel) ---
  await seedContextRecommendations(prisma);
}

async function seedContextRecommendations(prisma: PrismaClient) {
  const trainings = await prisma.training.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(trainings.map((t) => [t.slug, t.id]));

  const mappings: Array<[string, string, number]> = [
    ["citizen.unemployment", "comprendre-sa-fiche-de-paie", 10],
    ["citizen.notice_period", "comprendre-sa-fiche-de-paie", 8],
    ["employer.first_hire", "comprendre-sa-fiche-de-paie", 9],
    ["partner.case_support", "devenir-aide-a-domicile-les-bases", 7],
    ["orientation.result.ENTREPRENEURSHIP", "lancer-son-activite-independant-belgique", 10],
    ["orientation.result.DIGITAL_IT", "initiation-bureautique-word-excel", 9],
    ["orientation.result.ADMINISTRATIVE_OFFICE", "comprendre-sa-fiche-de-paie", 8],
  ];

  let created = 0;
  for (const [contextKey, slug, priority] of mappings) {
    const trainingId = idBySlug.get(slug);
    if (!trainingId) continue;
    await prisma.trainingContextRecommendation.upsert({
      where: { contextKey_trainingId: { contextKey, trainingId } },
      update: { priority, isActive: true },
      create: { contextKey, trainingId, priority, isActive: true },
    });
    created++;
  }
  console.log(`   ✓ ${created} recommandations contextuelles`);
}

async function seedDemoTrainings(prisma: PrismaClient) {
  const org = await prisma.formationOrganization.upsert({
    where: { slug: "docbel-formations" },
    update: {},
    create: {
      slug: "docbel-formations",
      name: "Docbel Formations",
      type: "interne_docbel",
      description: "Formations de démonstration proposées par Docbel.",
      brandColor: "#7C3AED",
      status: "active",
      createdById: "seed",
    },
  });
  await prisma.organizationTrainingPermission.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      canPublishDirectly: true,
      canCreatePrivateTraining: true,
      canCreateInternalTraining: true,
    },
  });

  const catIds = new Map(
    (await prisma.trainingCategory.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );
  const tagIds = new Map(
    (await prisma.trainingTag.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]),
  );

  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 24 * 3600 * 1000);

  const demos: Array<{
    slug: string;
    title: string;
    shortDescription: string;
    description: string;
    categorySlug: string;
    level: string;
    format: string;
    priceType: string;
    priceAmount?: number;
    objectives: string[];
    tags: string[];
    recommended?: boolean;
    verified?: boolean;
    certificateType?: string;
    session: { mode: string; city?: string; region?: string; startInDays: number; capacity: number };
  }> = [
    {
      slug: "comprendre-sa-fiche-de-paie",
      title: "Comprendre sa fiche de paie",
      shortDescription: "Décrypter brut, net, cotisations et précompte en 1 demi-journée.",
      description:
        "Une formation accessible pour apprendre à lire et comprendre chaque ligne de votre fiche de paie belge : salaire brut, cotisations ONSS, précompte professionnel, net à payer, avantages.",
      categorySlug: "bureautique",
      level: "debutant",
      format: "online",
      priceType: "free",
      objectives: ["Lire une fiche de paie", "Comprendre brut / net", "Repérer les cotisations"],
      tags: ["gratuit", "debutant-accepte", "metier-de-bureau", "ordinateur-requis"],
      recommended: true,
      verified: true,
      certificateType: "participation",
      session: { mode: "online", startInDays: 14, capacity: 40 },
    },
    {
      slug: "initiation-bureautique-word-excel",
      title: "Initiation à la bureautique (Word & Excel)",
      shortDescription: "Les bases concrètes de Word et Excel pour le travail de bureau.",
      description:
        "Prise en main de Word et Excel : créer un document, mettre en forme, formules de base, tableaux. Idéal pour une remise à niveau avant une formation métier.",
      categorySlug: "numerique",
      level: "debutant",
      format: "online",
      priceType: "free",
      objectives: ["Créer et mettre en forme un document", "Utiliser les formules Excel de base"],
      tags: ["gratuit", "debutant-accepte", "ordinateur-requis", "remise-a-niveau"],
      certificateType: "participation",
      session: { mode: "online", startInDays: 21, capacity: 30 },
    },
    {
      slug: "devenir-aide-a-domicile-les-bases",
      title: "Devenir aide à domicile : les bases",
      shortDescription: "Découvrir le métier d'aide à domicile et ses gestes essentiels.",
      description:
        "Présentation du métier d'aide à domicile : accompagnement des personnes, gestes du quotidien, posture professionnelle, cadre légal. Une porte d'entrée vers les métiers du soin et de l'aide.",
      categorySlug: "sante",
      level: "debutant",
      format: "onsite",
      priceType: "free",
      objectives: ["Découvrir le métier", "Comprendre l'accompagnement des personnes"],
      tags: ["gratuit", "debutant-accepte", "contact-humain"],
      session: { mode: "onsite", city: "Charleroi", region: "wallonia", startInDays: 30, capacity: 15 },
    },
    {
      slug: "lancer-son-activite-independant-belgique",
      title: "Lancer son activité d'indépendant en Belgique",
      shortDescription: "Statut, BCE, TVA, caisse sociale : toutes les étapes pour démarrer.",
      description:
        "Tout pour se lancer comme indépendant en Belgique : choisir son statut, s'inscrire à la BCE, comprendre la TVA, la caisse d'assurances sociales et les premières obligations comptables.",
      categorySlug: "entrepreneuriat",
      level: "intermediaire",
      format: "hybrid",
      priceType: "paid",
      priceAmount: 120,
      objectives: ["Choisir son statut", "Réaliser les démarches de lancement"],
      tags: ["payant", "independant", "travail-autonome"],
      certificateType: "partner",
      session: { mode: "hybrid", city: "Bruxelles", region: "brussels", startInDays: 28, capacity: 20 },
    },
  ];

  let created = 0;
  for (const d of demos) {
    const exists = await prisma.training.findUnique({ where: { slug: d.slug }, select: { id: true } });
    if (exists) continue;

    await prisma.training.create({
      data: {
        slug: d.slug,
        organizationId: org.id,
        createdById: "seed",
        title: d.title,
        shortDescription: d.shortDescription,
        description: d.description,
        objectives: d.objectives,
        level: d.level,
        format: d.format,
        categoryId: catIds.get(d.categorySlug) ?? null,
        priceType: d.priceType,
        priceAmount: d.priceAmount ?? null,
        certificateType: d.certificateType ?? "none",
        status: "published",
        visibility: "public",
        isDocbelRecommended: d.recommended ?? false,
        isVerifiedByDocbel: d.verified ?? false,
        publishedAt: now,
        approvedAt: now,
        tags: {
          create: d.tags
            .filter((s) => tagIds.has(s))
            .map((s) => ({ tag: { connect: { id: tagIds.get(s)! } } })),
        },
        sessions: {
          create: [
            {
              organizationId: org.id,
              status: "open",
              mode: d.session.mode,
              startsAt: inDays(d.session.startInDays),
              endsAt: inDays(d.session.startInDays),
              city: d.session.city,
              region: d.session.region,
              capacity: d.session.capacity,
              requiresManualApproval: true,
            },
          ],
        },
      },
    });
    created++;
  }
  console.log(`   ✓ démo : organisation + ${created} formations publiées (${demos.length - created} déjà présentes)`);
}
