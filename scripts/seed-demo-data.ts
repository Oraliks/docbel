/**
 * Seed de données démo pour les comptes "demo+*@docbel.local" — afin que
 * l'admin qui les impersonifie via "Voir en tant que" voie un vrai contenu
 * plutôt que des pages vides.
 *
 * Idempotent : relançable, upsert sur des IDs / clés uniques stables.
 *
 * Convention : tous les libellés visibles sont préfixés "DEMO " pour qu'on les
 * repère immédiatement dans la base partagée (Neon).
 *
 *   - Citoyen   : UserProfile complet (NISS valide, IBAN belge, contrat…).
 *   - Partenaire: UserProfile minimal + entrées d'historique de rendez-vous
 *                 (scope = partnerOrganization) + 1 PartnerDomain démo.
 *   - Employeur : UserProfile (employer/BCE/jobTitle) + 1 PartnerDomain démo.
 *
 * Tables Booking* volontairement non touchées : un autre agent y travaille en
 * parallèle, et on évite d'empiéter sur ses fixtures.
 *
 * Usage : pnpm tsx scripts/seed-demo-data.ts
 *
 * Prérequis : avoir lancé scripts/seed-demo-accounts.ts au moins une fois.
 */
import { prisma } from "@/lib/prisma"

const CITIZEN_EMAIL = "demo+citoyen@docbel.local"
const PARTNER_EMAIL = "demo+partenaire@docbel.local"
const EMPLOYER_EMAIL = "demo+employeur@docbel.local"

// Doivent rester strictement alignés sur scripts/seed-demo-accounts.ts.
const PARTNER_ORG = "Demo Partenaire ASBL"
const EMPLOYER_ORG = "Demo Employeur SPRL"

// NISS demo valide (mod-97). Née le 15/06/1985, séquence 123 (impair = M),
// checksum 90. Calculé via la formule du module : 97 - (850615123 % 97) = 90.
// Cohérent avec birthDate ci-dessous.
const CITIZEN_PROFILE = {
  firstName: "DEMO Camille",
  lastName: "DEMO Janssens",
  niss: "85061512390",
  birthDate: new Date("1985-06-15"),
  birthPlace: "Bruxelles",
  nationality: "Belge",
  gender: "M",
  street: "Rue de la Loi (DEMO)",
  streetNum: "16",
  postalCode: "1000",
  city: "Bruxelles",
  country: "BE",
  phone: "02 234 56 78",
  mobilePhone: "0476 12 34 56",
  iban: "BE68539007547034", // exemple Banque Nationale, IBAN valide
  bic: "BBRUBEBB",
  maritalStatus: "single",
  employer: "DEMO Employeur SPRL",
  employerBce: null,
  jobTitle: "Employé administratif",
  contractType: "CDI",
  contractStart: new Date("2020-01-15"),
  organismePaiement: "capac",
}

/**
 * Profil partenaire : seuls les champs identité/contact sont pertinents (un
 * permanent syndical n'a pas de NISS ou IBAN à pré-remplir dans nos outils).
 * On laisse les autres champs à null pour ne pas suggérer de logique métier.
 */
const PARTNER_PROFILE = {
  firstName: "DEMO Léa",
  lastName: "DEMO Mertens",
  phone: "02 555 12 34",
  mobilePhone: "0475 11 22 33",
  city: "Bruxelles",
  country: "BE",
}

/**
 * Profil employeur : informations RH employeur (BCE, intitulé de poste). BCE
 * valide mod-97 (cf. DEMO_VAT_NUMBER de seed-demo-accounts.ts : "0123456749",
 * la TVA "BE0123456749" sans préfixe).
 */
const EMPLOYER_PROFILE = {
  firstName: "DEMO Pauline",
  lastName: "DEMO Lemaire",
  phone: "02 333 44 55",
  mobilePhone: "0498 12 34 56",
  city: "Bruxelles",
  country: "BE",
  employer: EMPLOYER_ORG,
  employerBce: "0123456749",
  jobTitle: "Responsable RH (DEMO)",
}

// Trois entrées d'historique de rendez-vous traités par le service partenaire.
// `scope` doit matcher User.partnerOrganization pour que l'outil "/rendez-vous"
// les liste pour les membres du même service.
const PARTNER_RDV_ENTRIES = [
  {
    id: "demo_partner_rdv_1",
    name: "DEMO Lucas Dubois",
    date: "2026-05-04",
    startTime: "09:00",
    endTime: "09:30",
  },
  {
    id: "demo_partner_rdv_2",
    name: "DEMO Sarah Peeters",
    date: "2026-05-11",
    startTime: "10:30",
    endTime: "11:00",
  },
  {
    id: "demo_partner_rdv_3",
    name: "DEMO Mehdi Bouchard",
    date: "2026-05-18",
    startTime: "14:00",
    endTime: "14:30",
  },
]

// Normalisation identique à lib/rendez-vous/history.ts → normalizeName().
// Recopiée ici pour éviter d'importer un module avec dépendances inattendues
// dans un script qui ne tourne que via tsx.
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // supprime les diacritiques combinants
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

async function seedCitizen() {
  const user = await prisma.user.findUnique({
    where: { email: CITIZEN_EMAIL },
    select: { id: true },
  })
  if (!user) {
    console.error(
      `Compte ${CITIZEN_EMAIL} introuvable. Lance d'abord scripts/seed-demo-accounts.ts.`,
    )
    process.exit(1)
  }

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: CITIZEN_PROFILE,
    create: { userId: user.id, ...CITIZEN_PROFILE },
  })
  console.log(`OK  profil démo pour ${CITIZEN_EMAIL}`)
  console.log(
    "    Champs : identité, adresse Bruxelles, contrat CDI, organisme CAPAC.",
  )
}

async function seedPartner() {
  const user = await prisma.user.findUnique({
    where: { email: PARTNER_EMAIL },
    select: { id: true, partnerOrganization: true },
  })
  if (!user) {
    console.error(
      `Compte ${PARTNER_EMAIL} introuvable. Lance d'abord scripts/seed-demo-accounts.ts.`,
    )
    process.exit(1)
  }
  // Garde-fou : si le compte demo a été manuellement renommé, on ne devine pas.
  if (user.partnerOrganization !== PARTNER_ORG) {
    console.warn(
      `!!  ${PARTNER_EMAIL} a partnerOrganization="${user.partnerOrganization}" — attendu "${PARTNER_ORG}". On continue mais l'historique RDV utilisera "${PARTNER_ORG}".`,
    )
  }

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: PARTNER_PROFILE,
    create: { userId: user.id, ...PARTNER_PROFILE },
  })

  // Historique RDV : la clé unique métier est (scope, nameNormalized, date,
  // startTime). On upsert dessus pour rester idempotent même si l'id explicite
  // change ou existait déjà.
  for (const entry of PARTNER_RDV_ENTRIES) {
    const nameNormalized = normalizeName(entry.name)
    await prisma.rendezVousHistory.upsert({
      where: {
        scope_nameNormalized_date_startTime: {
          scope: PARTNER_ORG,
          nameNormalized,
          date: entry.date,
          startTime: entry.startTime,
        },
      },
      update: {
        // L'historique est conceptuellement immuable, mais on aligne quand
        // même nom (graphie d'origine) et heure de fin si jamais on retouche
        // la liste démo plus tard.
        name: entry.name,
        endTime: entry.endTime,
        createdById: user.id,
      },
      create: {
        id: entry.id,
        scope: PARTNER_ORG,
        nameNormalized,
        name: entry.name,
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        createdById: user.id,
      },
    })
  }

  // 1 PartnerDomain pour le dashboard : autorise les comptes d'un domaine
  // fictif à rejoindre "Demo Partenaire ASBL". `domain` est @unique → idéal
  // pour upsert.
  await prisma.partnerDomain.upsert({
    where: { domain: "demo-partenaire.docbel.local" },
    update: {
      organizationName: PARTNER_ORG,
      segment: "partenaire",
      partnerType: "prive_asbl",
      isActive: true,
      isTest: true,
      notes: "DEMO — domaine fictif pour démonstration impersonation.",
    },
    create: {
      id: "demo_partner_domain",
      kind: "domain",
      domain: "demo-partenaire.docbel.local",
      segment: "partenaire",
      partnerType: "prive_asbl",
      organizationName: PARTNER_ORG,
      isActive: true,
      isTest: true,
      notes: "DEMO — domaine fictif pour démonstration impersonation.",
      createdBy: user.id,
    },
  })

  console.log(`OK  profil démo pour ${PARTNER_EMAIL}`)
  console.log(
    `    + ${PARTNER_RDV_ENTRIES.length} entrées RendezVousHistory (scope="${PARTNER_ORG}"), 1 PartnerDomain.`,
  )
}

async function seedEmployer() {
  const user = await prisma.user.findUnique({
    where: { email: EMPLOYER_EMAIL },
    select: { id: true, partnerOrganization: true },
  })
  if (!user) {
    console.error(
      `Compte ${EMPLOYER_EMAIL} introuvable. Lance d'abord scripts/seed-demo-accounts.ts.`,
    )
    process.exit(1)
  }
  if (user.partnerOrganization !== EMPLOYER_ORG) {
    console.warn(
      `!!  ${EMPLOYER_EMAIL} a partnerOrganization="${user.partnerOrganization}" — attendu "${EMPLOYER_ORG}".`,
    )
  }

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: EMPLOYER_PROFILE,
    create: { userId: user.id, ...EMPLOYER_PROFILE },
  })

  // 1 PartnerDomain pour le dashboard employeur (carte "accès autorisés").
  await prisma.partnerDomain.upsert({
    where: { domain: "demo-employeur.docbel.local" },
    update: {
      organizationName: EMPLOYER_ORG,
      segment: "employeur",
      partnerType: null,
      isActive: true,
      isTest: true,
      notes: "DEMO — domaine fictif pour démonstration impersonation.",
    },
    create: {
      id: "demo_employer_domain",
      kind: "domain",
      domain: "demo-employeur.docbel.local",
      segment: "employeur",
      partnerType: null,
      organizationName: EMPLOYER_ORG,
      isActive: true,
      isTest: true,
      notes: "DEMO — domaine fictif pour démonstration impersonation.",
      createdBy: user.id,
    },
  })

  // NB tables Dossier/Déclaration/Trimestrielle : aucune trouvée dans le
  // schema actuel — l'espace employeur est encore vitrine, donc rien à
  // remplir côté métier au-delà du profil RH et de l'accès au catalogue.

  console.log(`OK  profil démo pour ${EMPLOYER_EMAIL}`)
  console.log(
    `    + 1 PartnerDomain (organizationName="${EMPLOYER_ORG}").`,
  )
}

async function main() {
  await seedCitizen()
  await seedPartner()
  await seedEmployer()
  console.log("\nDonnées démo en place. Connecte-toi en admin → \"Voir en tant que\".")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
