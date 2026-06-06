/**
 * Seed de données démo pour les comptes "demo+*@docbel.local" — afin que
 * l'admin qui les impersonifie via "Voir en tant que" voie un vrai contenu
 * plutôt que des pages vides.
 *
 * Idempotent : relançable, upsert sur l'id du user.
 *
 * Scope volontairement minimal pour cette première version :
 *   - Citoyen : UserProfile complet avec NISS valide (mod-97), IBAN belge,
 *     adresse, contrat, organisme de paiement. Suffisant pour démontrer le
 *     flow "profil → calculs personnalisés".
 *
 * Le partenaire et l'employeur ne sont pas alimentés ici pour éviter une
 * collision avec les sessions parallèles d'autres agents qui touchent aux
 * tables Booking / DocumentBundle. À étendre quand stabilisé.
 *
 * Usage : pnpm tsx scripts/seed-demo-data.ts
 *
 * Prérequis : avoir lancé scripts/seed-demo-accounts.ts au moins une fois.
 */
import { prisma } from "@/lib/prisma"

const CITIZEN_EMAIL = "demo+citoyen@docbel.local"

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

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: CITIZEN_EMAIL },
    select: { id: true },
  })
  if (!user) {
    console.error(
      `Compte ${CITIZEN_EMAIL} introuvable. Lance d'abord scripts/seed-demo-accounts.ts.`
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
    "    Champs : identité, adresse Bruxelles, contrat CDI, organisme CAPAC."
  )
  console.log(
    "    Étendre ce script quand les autres tables (Booking, Dossier, etc.) seront stabilisées."
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
