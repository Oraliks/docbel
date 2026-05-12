import { PrismaClient, Prisma } from "@prisma/client";
import commissionsData from "../lib/data/commissions-paritaires-belgique.json";
import u1Data from "../lib/data/u1-institutions-eu.json";
import { COUNTRY_CODE_MAP } from "../lib/u1-institutions";
import { seedOrganismes } from "./seeds/organismes";
import { seedFieldValidationPresets } from "./seeds/field-validation-presets";
import { seedBureaus } from "./seeds/bureaus";

const prisma = new PrismaClient();

interface CommissionSeed {
  code: string;
  numero: string;
  numeroOfficiel: string;
  codeOfficiel5: string;
  suffixeInterne: string;
  type: string;
  nom: string;
  label: string;
  searchText: string;
}

interface U1Seed {
  country: string;
  organization: string;
  department?: string;
  alternate_name?: string;
  address?: string[];
  postal_address?: string;
  phone?: string;
  fax?: string;
  website?: string | null;
  email?: string | string[];
  contacts?: Record<string, unknown>;
  visitor_address?: string[];
  regional_services_u1?: string;
  additional_services?: unknown[];
  additional_info?: Record<string, unknown>;
}

// Plain-text → HTML converter (handles **bold**, - bullets, 1. numbered lists)
function toHtml(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Numbered list block
    if (/^\d+\.\s/.test(line)) {
      out.push("<ol>");
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        out.push(`<li>${inlineFormat(lines[i].replace(/^\d+\.\s/, ""))}</li>`);
        i++;
      }
      out.push("</ol>");
      continue;
    }

    // Bullet list block
    if (/^-\s/.test(line)) {
      out.push("<ul>");
      while (i < lines.length && /^-\s/.test(lines[i])) {
        out.push(`<li>${inlineFormat(lines[i].replace(/^-\s/, ""))}</li>`);
        i++;
      }
      out.push("</ul>");
      continue;
    }

    // Bold-only line → heading
    if (/^\*\*(.+)\*\*$/.test(line.trim())) {
      const title = line.trim().replace(/^\*\*/, "").replace(/\*\*$/, "");
      out.push(`<h2>${title}</h2>`);
      i++;
      continue;
    }

    // Empty line → skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph
    out.push(`<p>${inlineFormat(line)}</p>`);
    i++;
  }

  return out.join("\n");
}

function inlineFormat(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

const articles = [
  {
    slug: "revalorisation-allocations-chomage-avril-2026",
    title: "Revalorisation des allocations de chômage — avril 2026",
    excerpt:
      "Depuis le 1er avril 2026, les allocations de chômage complet sont revalorisées de 2,1 % suite à l'indexation automatique. Les organismes de paiement (CAPAC, CSC, CGSLB, FGTB) mettront à jour les paiements automatiquement.",
    category: "Mise à jour",
    color: "#7C3AED",
    emoji: "📋",
    readingTime: 5,
    featured: true,
    image: "https://images.unsplash.com/photo-1553729781-421fea13e7a6?w=800&h=400&fit=crop",
    publishedAt: new Date("2026-04-22"),
    content: `Depuis le 1er avril 2026, une revalorisation importante des allocations de chômage complet a été mise en place suite à l'indexation automatique des salaires.

Cette augmentation de 2,1 % s'applique à tous les chômeurs complets indemnisés. Les organismes de paiement (CAPAC, CSC, CGSLB, FGTB) ont reçu les directives pour mettre à jour automatiquement les montants versés à partir de cette date.

**Qui est concerné ?**
- Les chômeurs complets indemnisés
- Tous les régimes de prestations chômage
- Les allocations d'attente pour jeunes
- Les allocations de transition

**Montants augmentés**
Les nouveaux montants varient selon votre situation familiale :
- Chômeur isolé : augmentation de base
- Chômeur cohabitant : montant réduit avec augmentation
- Chômeur responsable de famille : montant majoré

**Démarches à effectuer**
Aucune démarche n'est nécessaire de votre part. Les organismes de paiement mettent automatiquement à jour vos allocations. Vous devez cependant continuer à remplir vos obligations de demandeur d'emploi.`,
  },
  {
    slug: "nouveaux-delais-introduction-c1-en-ligne",
    title: "Nouveaux délais pour l'introduction du C1 en ligne",
    excerpt:
      "L'ONEM simplifie la procédure d'introduction de la demande d'allocations (C1) : le délai passe à 12 mois pour les primo-demandeurs. La demande peut désormais être introduite entièrement via MyONEM.",
    category: "Annonce ONEM",
    color: "#1A56DB",
    emoji: "🏛️",
    readingTime: 4,
    featured: true,
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=400&fit=crop",
    publishedAt: new Date("2026-04-15"),
    content: `L'Office National de l'Emploi (ONEM) a annoncé des changements importants concernant l'introduction en ligne de la demande d'allocations de chômage (C1).

À partir du 1er mai 2026, le délai pour introduire votre demande C1 passe de 8 mois à 12 mois après votre fin de travail. Cette mesure facilite grandement les procédures administratives pour les primo-demandeurs.

**Les nouvelles modalités**
- Délai d'introduction allongé à 12 mois
- Possibilité d'introduire entièrement via MyONEM
- Simplification de la démarche administrative
- Moins de documents papier requis

**Procédure simplifiée**
1. Accédez à MyONEM avec vos identifiants
2. Remplissez le formulaire C1 en ligne
3. Téléchargez les documents requis
4. Validez votre demande
5. Recevez une confirmation par email

**Avantages de la demande en ligne**
- Pas de déplacement nécessaire
- Traitement plus rapide
- Conservation de l'historique
- Suivi en temps réel de votre dossier

L'ONEM met à disposition une aide en ligne et des tutoriels vidéo pour vous guider à chaque étape de la procédure.`,
  },
  {
    slug: "extension-revenu-integration-fins-de-droits",
    title: "Extension du revenu d'intégration pour les fins de droits",
    excerpt:
      "Le SPP Intégration sociale confirme l'extension temporaire du revenu d'intégration sociale (RIS) pour les chômeurs en fin de droits. Les CPAS ont reçu des instructions complémentaires pour l'application de cette mesure.",
    category: "CPAS",
    color: "#0E9F6E",
    emoji: "✍️",
    readingTime: 6,
    featured: true,
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop",
    publishedAt: new Date("2026-04-08"),
    content: `Le Service Public de Programmation (SPP) Intégration sociale a confirmé l'extension temporaire du revenu d'intégration sociale (RIS) pour les chômeurs en fin de droits.

Cette mesure, qui était initialement prévue jusqu'à la fin du premier trimestre 2026, a été prolongée jusqu'à fin 2026 pour soutenir les personnes en difficulté financière.

**Qui peut en bénéficier ?**
- Les chômeurs ayant épuisé leurs droits aux allocations
- Les personnes sans autres revenus
- Les résidents belges légaux
- Les personnes ayant une situation de besoin

**Montant du RIS**
Le revenu d'intégration sociale offre un minimum de revenus garantis :
- Isolé : montant de base
- Cohabitant : montant réduit
- Responsable de famille : montant majoré
- Avec enfant à charge : suppléments possibles

**Démarches auprès du CPAS**
1. Contactez votre CPAS local
2. Constituez votre dossier
3. Présentez votre demande
4. Participez à un entretien social
5. Recevez votre avis de décision

**Obligations liées au RIS**
- Chercher activement un emploi
- Participer aux projets du CPAS
- Respecter les conditions de suivi social
- Signaler tout changement de situation`,
  },
  {
    slug: "reforme-preavis-nouveaux-baremes-2026",
    title: "Réforme du préavis : nouvelles barèmes 2026",
    excerpt:
      "Suite à la loi du 12 mars 2026, les délais de préavis sont révisés pour les contrats conclus après le 1er mai 2026. Les calculs intègrent désormais les périodes d'interruption de carrière dans l'ancienneté.",
    category: "Réforme",
    color: "#7E3AF2",
    emoji: "⚖️",
    readingTime: 7,
    featured: false,
    image: "https://images.unsplash.com/photo-1557804506-669714d2e9d8?w=800&h=400&fit=crop",
    publishedAt: new Date("2026-04-01"),
    content: `Une réforme majeure des délais de préavis a été adoptée par le Parlement belge, suite à la loi du 12 mars 2026. Ces nouvelles dispositions s'appliqueront à tous les nouveaux contrats de travail conclus après le 1er mai 2026.

**Principaux changements**
Les délais de préavis ont été entièrement révisés pour refléter les mutations du marché du travail contemporain.

**Nouvelle grille de préavis**
- 0 à 2 ans : 2 semaines
- 2 à 5 ans : 4 semaines
- 5 à 10 ans : 8 semaines
- Plus de 10 ans : 12 semaines

**Éléments pris en compte**
- Ancienneté totale de carrière
- Périodes d'interruption justifiées
- Formations suivies
- Promotions internes
- Congés parental/thématique

**Calcul de l'ancienneté**
Les interruptions de carrière (congé parental, sabbatique autorisé, congé thématique) sont désormais intégrés dans le calcul de l'ancienneté. Cela signifie que vos droits sont préservés même pendant ces périodes.

**Transitoire**
- Les contrats avant le 1er mai 2026 : ancienne loi
- Les contrats après le 1er mai 2026 : nouvelle loi
- Application individuelle selon le contrat`,
  },
];

const categories = [
  { name: "Mise à jour", color: "#7C3AED" },
  { name: "Annonce ONEM", color: "#1A56DB" },
  { name: "CPAS", color: "#0E9F6E" },
  { name: "Réforme", color: "#7E3AF2" },
];

async function main() {
  console.log("🌱 Seeding categories...");
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { color: cat.color },
      create: cat,
    });
  }
  console.log(`   ✓ ${categories.length} categories upserted`);

  console.log("🌱 Seeding tool sections...");
  const chomageSection = await prisma.toolSection.upsert({
    where: { name: "Chômage" },
    update: {},
    create: {
      name: "Chômage",
      description: "Outils pour les demandeurs d'emploi et chômeurs",
      order: 1,
      icon: "💼",
    },
  });
  console.log(`   ✓ Chômage section created`);

  console.log("🌱 Seeding tools...");
  const tools = [
    {
      sectionId: chomageSection.id,
      name: "Calcul du préavis",
      slug: "preavis",
      description: "Calculez votre délai de préavis selon la loi belge",
      type: "calc_preavis",
      icon: "📅",
      popular: true,
      timeMin: 5,
      order: 1,
    },
    {
      sectionId: chomageSection.id,
      name: "Allocation de Garantie de Revenu",
      slug: "agr",
      description: "Calcul de l'AGR et conditions d'accès",
      type: "calc_agr",
      icon: "💰",
      popular: true,
      timeMin: 5,
      order: 2,
    },
    {
      sectionId: chomageSection.id,
      name: "Salaire minimum par secteur",
      slug: "salaire-min",
      description: "Consultez le salaire minimum dans votre secteur",
      type: "calc_cp",
      icon: "💵",
      popular: false,
      timeMin: 3,
      order: 3,
    },
    {
      sectionId: chomageSection.id,
      name: "Trouver un bureau",
      slug: "bureaux",
      description:
        "CPAS, Commune, ONEM, organismes de paiement, syndicats : un seul outil pour tout trouver, partout en Belgique.",
      type: "locator",
      icon: "🗺️",
      popular: true,
      timeMin: 2,
      order: 4,
    },
  ];

  let toolsCreated = 0;
  for (const tool of tools) {
    const exists = await prisma.tool.findUnique({ where: { slug: tool.slug } });
    if (exists) {
      console.log(`   ~ skipped (already exists): ${tool.name}`);
      continue;
    }

    await prisma.tool.create({
      data: tool,
    });

    console.log(`   ✓ created: ${tool.name}`);
    toolsCreated++;
  }
  console.log(`   ✓ ${toolsCreated} tools created`);

  console.log("🌱 Seeding demo articles...");
  let created = 0;
  let skipped = 0;

  for (const article of articles) {
    const html = toHtml(article.content);
    const exists = await prisma.news.findUnique({ where: { slug: article.slug } });

    if (exists) {
      console.log(`   ~ skipped (already exists): ${article.title}`);
      skipped++;
      continue;
    }

    await prisma.news.create({
      data: {
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        content: html,
        category: article.category,
        color: article.color,
        emoji: article.emoji,
        status: "published",
        featured: article.featured,
        image: article.image,
        readingTime: article.readingTime,
        views: 0,
        publishedAt: article.publishedAt,
        createdBy: "seed",
      },
    });

    console.log(`   ✓ created: ${article.title}`);
    created++;
  }

  console.log(`\nDone. ${created} articles created, ${skipped} skipped, ${toolsCreated} tools created.`);

  console.log("🌱 Seeding commissions paritaires...");
  const items = (commissionsData.items ?? []) as CommissionSeed[];
  let cpCreated = 0;
  let cpUpdated = 0;
  for (const item of items) {
    const existing = await prisma.commissionParitaire.findUnique({
      where: { code: item.code },
      select: { id: true },
    });
    await prisma.commissionParitaire.upsert({
      where: { code: item.code },
      update: {
        numero: item.numero,
        numeroOfficiel: item.numeroOfficiel,
        codeOfficiel5: item.codeOfficiel5,
        suffixeInterne: item.suffixeInterne,
        type: item.type,
        nom: item.nom,
        label: item.label,
        searchText: item.searchText,
      },
      create: {
        code: item.code,
        numero: item.numero,
        numeroOfficiel: item.numeroOfficiel,
        codeOfficiel5: item.codeOfficiel5,
        suffixeInterne: item.suffixeInterne,
        type: item.type,
        nom: item.nom,
        label: item.label,
        searchText: item.searchText,
        updatedBy: "seed",
      },
    });
    if (existing) cpUpdated++;
    else cpCreated++;
  }
  console.log(`   ✓ ${cpCreated} created, ${cpUpdated} updated (total ${items.length})`);

  console.log("🌱 Seeding U1 institutions...");
  const u1Items = (u1Data.items ?? []) as U1Seed[];
  let u1Created = 0;
  let u1Updated = 0;
  for (const item of u1Items) {
    const emails = Array.isArray(item.email)
      ? item.email
      : item.email
        ? [item.email]
        : [];

    const extra: Record<string, unknown> = {};
    if (item.contacts) extra.contacts = item.contacts;
    if (item.visitor_address) extra.visitorAddress = item.visitor_address;
    if (item.regional_services_u1) extra.regionalServicesU1 = item.regional_services_u1;
    if (item.additional_services) extra.additionalServices = item.additional_services;
    if (item.additional_info) extra.additionalInfo = item.additional_info;

    const data = {
      country: item.country,
      countryCode: COUNTRY_CODE_MAP[item.country] ?? null,
      organization: item.organization,
      department: item.department ?? null,
      alternateName: item.alternate_name ?? null,
      addressLines: (item.address ?? []) as Prisma.InputJsonValue,
      postalAddress: item.postal_address ?? null,
      phone: item.phone ?? null,
      fax: item.fax ?? null,
      website: item.website ?? null,
      emails: emails as Prisma.InputJsonValue,
      extra: (Object.keys(extra).length > 0 ? extra : Prisma.JsonNull) as Prisma.InputJsonValue,
    };

    const existing = await prisma.u1Institution.findUnique({
      where: { country: item.country },
      select: { id: true },
    });
    await prisma.u1Institution.upsert({
      where: { country: item.country },
      update: data,
      create: { ...data, updatedBy: "seed" },
    });
    if (existing) u1Updated++;
    else u1Created++;
  }
  console.log(`   ✓ ${u1Created} created, ${u1Updated} updated (total ${u1Items.length})`);

  console.log("🌱 Seeding organismes (ONEM, CPAS, mutuelles, etc.)...");
  await seedOrganismes(prisma);

  console.log("🌱 Seeding field validation presets...");
  await seedFieldValidationPresets(prisma);

  console.log("🌱 Seeding bureaus (communes, CPAS, ONEM)...");
  await seedBureaus(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
