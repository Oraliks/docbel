/**
 * Seed des 3 comptes demo utilisés par le bouton "Voir en tant que" du shell admin
 * (cf. SiteHeader → ViewAsMenu). L'admin impersonifie ces comptes via le plugin
 * admin Better Auth ; il n'a pas besoin du mot de passe.
 *
 * Par défaut, mot de passe aléatoire haut entropy (les comptes ne sont
 * accessibles qu'en impersonation). Pour pouvoir aussi tester un login direct
 * en local, définir DEMO_ACCOUNTS_PASSWORD avant de relancer le script.
 *
 * Idempotent : relançable, ne casse rien si les comptes existent déjà.
 *
 * Usage : pnpm tsx scripts/seed-demo-accounts.ts
 */
import { prisma } from "@/lib/prisma"
import * as bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"
import { UserRole, UserStatus } from "@prisma/client"

const PASSWORD =
  process.env.DEMO_ACCOUNTS_PASSWORD?.trim() || randomBytes(32).toString("hex")

// TVA belge demo valide (mod-97) : base 01234567 → check 49.
const DEMO_VAT_NUMBER = "BE0123456749"

type DemoAccount = {
  email: string
  name: string
  role: UserRole
  segment: string | null
  partnerType: string | null
  partnerOrganization: string | null
  vatNumber: string | null
}

const ACCOUNTS: DemoAccount[] = [
  {
    email: "demo+citoyen@docbel.local",
    name: "Demo Citoyen",
    role: UserRole.user,
    segment: null,
    partnerType: null,
    partnerOrganization: null,
    vatNumber: null,
  },
  {
    email: "demo+partenaire@docbel.local",
    name: "Demo Partenaire",
    role: UserRole.partner,
    segment: "partenaire",
    partnerType: "prive_asbl",
    partnerOrganization: "Demo Partenaire ASBL",
    vatNumber: null,
  },
  {
    email: "demo+employeur@docbel.local",
    name: "Demo Employeur",
    role: UserRole.employer,
    segment: "employeur",
    partnerType: null,
    partnerOrganization: "Demo Employeur SPRL",
    vatNumber: DEMO_VAT_NUMBER,
  },
]

async function upsertDemoAccount(account: DemoAccount, passwordHash: string) {
  const user = await prisma.user.upsert({
    where: { email: account.email },
    update: {
      // Re-aligne les champs si on change la config du compte ; mais ne
      // ré-écrit pas le mot de passe pour ne pas casser un login en cours.
      name: account.name,
      role: account.role,
      status: UserStatus.active,
      segment: account.segment,
      partnerType: account.partnerType,
      partnerOrganization: account.partnerOrganization,
      vatNumber: account.vatNumber,
      failedLoginAttempts: 0,
      lockedUntil: null,
      emailVerified: true,
    },
    create: {
      name: account.name,
      email: account.email,
      password: passwordHash,
      role: account.role,
      status: UserStatus.active,
      segment: account.segment,
      partnerType: account.partnerType,
      partnerOrganization: account.partnerOrganization,
      vatNumber: account.vatNumber,
      emailVerified: true,
    },
  })

  await prisma.account.upsert({
    where: {
      providerId_accountId: { providerId: "credential", accountId: user.id },
    },
    update: {},
    create: {
      id: `acc_${user.id}_credential`,
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: passwordHash,
    },
  })

  return user
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const isCustomPassword = Boolean(process.env.DEMO_ACCOUNTS_PASSWORD)

  for (const account of ACCOUNTS) {
    const user = await upsertDemoAccount(account, passwordHash)
    console.log(`OK  ${account.role.padEnd(8)} ${user.email}`)
  }

  if (isCustomPassword) {
    console.log("\nMot de passe : valeur de DEMO_ACCOUNTS_PASSWORD")
  } else {
    console.log(
      "\nMot de passe : aléatoire (impersonation uniquement). Définir DEMO_ACCOUNTS_PASSWORD pour permettre un login direct."
    )
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
