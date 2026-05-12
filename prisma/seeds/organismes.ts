import { PrismaClient, OrganismeType } from "@prisma/client";

interface OrganismeSeed {
  code: string;
  name: string;
  shortName?: string;
  type: OrganismeType;
  color: string;
  website?: string;
  description?: string;
  order: number;
}

const ORGANISMES: OrganismeSeed[] = [
  // === Fédéral ===
  {
    code: "onem",
    name: "Office National de l'Emploi",
    shortName: "ONEM",
    type: "federal",
    color: "#0050A0",
    website: "https://www.onem.be",
    description: "Sécurité sociale fédérale — chômage, interruptions de carrière, crédit-temps.",
    order: 10,
  },
  {
    code: "onp",
    name: "Service Fédéral des Pensions",
    shortName: "SFP",
    type: "federal",
    color: "#7A1F8C",
    website: "https://www.sfpd.fgov.be",
    description: "Pensions des salariés et fonctionnaires.",
    order: 20,
  },
  {
    code: "inasti",
    name: "Institut National d'Assurances Sociales pour Travailleurs Indépendants",
    shortName: "INASTI",
    type: "federal",
    color: "#D4A017",
    website: "https://www.inasti.be",
    description: "Sécurité sociale des indépendants.",
    order: 30,
  },
  {
    code: "bcss",
    name: "Banque Carrefour de la Sécurité Sociale",
    shortName: "BCSS",
    type: "federal",
    color: "#003F87",
    website: "https://www.ksz-bcss.fgov.be",
    description: "Échanges électroniques entre institutions de sécurité sociale.",
    order: 40,
  },
  {
    code: "famifed",
    name: "Famifed (Allocations Familiales Fédérales)",
    shortName: "Famifed",
    type: "federal",
    color: "#E94B3C",
    website: "https://www.famifed.be",
    description: "Allocations familiales (compétence transférée aux régions depuis 2019).",
    order: 50,
  },
  {
    code: "spf-finances",
    name: "SPF Finances",
    shortName: "SPF FIN",
    type: "federal",
    color: "#1B5E20",
    website: "https://finances.belgium.be",
    description: "Impôts, TVA, douanes.",
    order: 60,
  },
  {
    code: "spf-emploi",
    name: "SPF Emploi, Travail et Concertation Sociale",
    shortName: "SPF ETCS",
    type: "federal",
    color: "#0050A0",
    website: "https://emploi.belgique.be",
    description: "Législation du travail, contrats, conventions collectives.",
    order: 70,
  },
  {
    code: "riziv",
    name: "INAMI / RIZIV",
    shortName: "INAMI",
    type: "federal",
    color: "#00838F",
    website: "https://www.inami.fgov.be",
    description: "Assurance maladie-invalidité.",
    order: 80,
  },

  // === Régional ===
  {
    code: "forem",
    name: "Forem",
    shortName: "Forem",
    type: "regional",
    color: "#E30613",
    website: "https://www.leforem.be",
    description: "Service public de l'emploi en Wallonie.",
    order: 100,
  },
  {
    code: "actiris",
    name: "Actiris",
    shortName: "Actiris",
    type: "regional",
    color: "#FFC72C",
    website: "https://www.actiris.brussels",
    description: "Service public de l'emploi à Bruxelles.",
    order: 110,
  },
  {
    code: "vdab",
    name: "VDAB",
    shortName: "VDAB",
    type: "regional",
    color: "#E2001A",
    website: "https://www.vdab.be",
    description: "Service public de l'emploi en Flandre.",
    order: 120,
  },
  {
    code: "adg",
    name: "Arbeitsamt der Deutschsprachigen Gemeinschaft",
    shortName: "ADG",
    type: "regional",
    color: "#FFCC00",
    website: "https://www.adg.be",
    description: "Service public de l'emploi de la Communauté germanophone.",
    order: 130,
  },
  {
    code: "iriscare",
    name: "Iriscare",
    shortName: "Iriscare",
    type: "regional",
    color: "#005EB8",
    website: "https://www.iriscare.brussels",
    description: "Bicommunautaire bruxelloise — santé, aide aux personnes, allocations familiales.",
    order: 140,
  },
  {
    code: "aviq",
    name: "Agence pour une Vie de Qualité",
    shortName: "AViQ",
    type: "regional",
    color: "#0E5BA8",
    website: "https://www.aviq.be",
    description: "Wallonie — bien-être, santé, handicap, familles.",
    order: 150,
  },

  // === Local ===
  {
    code: "cpas",
    name: "Centre Public d'Action Sociale",
    shortName: "CPAS",
    type: "local",
    color: "#5E3A8E",
    description: "CPAS communaux — aide sociale, RIS, médiation de dettes.",
    order: 200,
  },
  {
    code: "commune",
    name: "Administration Communale",
    shortName: "Commune",
    type: "local",
    color: "#2E7D32",
    description: "Communes — état civil, urbanisme, population.",
    order: 210,
  },

  // === Caisses de chômage / syndicats / mutuelles ===
  {
    code: "capac",
    name: "Caisse Auxiliaire de Paiement des Allocations de Chômage",
    shortName: "CAPAC",
    type: "social",
    color: "#003F87",
    website: "https://www.capac.fgov.be",
    description: "Organisme public de paiement des allocations de chômage.",
    order: 300,
  },
  {
    code: "csc",
    name: "CSC (Confédération des Syndicats Chrétiens)",
    shortName: "CSC",
    type: "social",
    color: "#FFA500",
    website: "https://www.csc-en-ligne.be",
    description: "Syndicat — organisme de paiement chômage.",
    order: 310,
  },
  {
    code: "fgtb",
    name: "FGTB (Fédération Générale du Travail de Belgique)",
    shortName: "FGTB",
    type: "social",
    color: "#E30613",
    website: "https://www.fgtb.be",
    description: "Syndicat — organisme de paiement chômage.",
    order: 320,
  },
  {
    code: "cgslb",
    name: "CGSLB (Centrale Générale des Syndicats Libéraux de Belgique)",
    shortName: "CGSLB",
    type: "social",
    color: "#0050A0",
    website: "https://www.cgslb.be",
    description: "Syndicat — organisme de paiement chômage.",
    order: 330,
  },
  {
    code: "mutualite",
    name: "Mutualité",
    shortName: "Mutualité",
    type: "social",
    color: "#00838F",
    description: "Mutualités (groupe générique).",
    order: 340,
  },
  {
    code: "solidaris",
    name: "Solidaris (Mutualité socialiste)",
    shortName: "Solidaris",
    type: "social",
    color: "#E30613",
    website: "https://www.solidaris.be",
    description: "Mutualité socialiste.",
    order: 341,
  },
  {
    code: "mc",
    name: "Mutualité Chrétienne (MC)",
    shortName: "MC",
    type: "social",
    color: "#0F75BC",
    website: "https://www.mc.be",
    description: "Mutualité chrétienne / Christelijke Mutualiteit.",
    order: 342,
  },
  {
    code: "mloz",
    name: "MLOZ — Mutualités Libres",
    shortName: "MLOZ",
    type: "social",
    color: "#7B2D8E",
    website: "https://www.mloz.be",
    description: "Union nationale des mutualités libres.",
    order: 343,
  },
  {
    code: "mutlibres",
    name: "Mutualité Libérale",
    shortName: "Mut. Libérale",
    type: "social",
    color: "#0050A0",
    website: "https://www.libmut.be",
    description: "Mutualité libérale.",
    order: 344,
  },
  {
    code: "neutrales",
    name: "Mutualités Neutres",
    shortName: "Mut. Neutres",
    type: "social",
    color: "#5E4FA2",
    website: "https://www.mutualitesneutres.be",
    description: "Union des mutualités neutres.",
    order: 345,
  },

  // === Professionnel ===
  {
    code: "secretariat-social",
    name: "Secrétariat Social",
    shortName: "SS",
    type: "professional",
    color: "#455A64",
    description: "Secrétariats sociaux agréés (Securex, Acerta, Group S, SD Worx, Partena, etc.).",
    order: 400,
  },
  {
    code: "fiduciaire",
    name: "Fiduciaire / Comptable",
    shortName: "Fiduciaire",
    type: "professional",
    color: "#37474F",
    description: "Cabinets comptables et fiscaux.",
    order: 410,
  },
];

export async function seedOrganismes(prisma: PrismaClient) {
  let created = 0;
  let updated = 0;

  for (const org of ORGANISMES) {
    const existing = await prisma.organisme.findUnique({ where: { code: org.code } });
    if (existing) {
      // Mettre à jour les métadonnées sans toucher createdBy/active si l'admin les a modifiés
      await prisma.organisme.update({
        where: { code: org.code },
        data: {
          name: org.name,
          shortName: org.shortName,
          type: org.type,
          color: org.color,
          website: org.website,
          description: org.description,
          order: org.order,
        },
      });
      updated++;
    } else {
      await prisma.organisme.create({ data: org });
      created++;
    }
  }

  console.log(`  ✓ Organismes : ${created} créés, ${updated} mis à jour`);
}
