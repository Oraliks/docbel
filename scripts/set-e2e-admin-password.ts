/**
 * Pose le mot de passe E2E sur un compte admin **EXISTANT**.
 *
 * Sert à disposer d'identifiants de test dédiés (cf. tests/e2e/helpers/auth.ts)
 * sans utiliser son mot de passe personnel, et SANS créer de compte : la base
 * Neon est partagée, on ne la pollue pas de fixtures (cf. AGENTS.md).
 *
 * Le mot de passe n'est jamais saisi ici ni affiché : il est lu depuis
 * `.env.local` (gitignoré) via `E2E_ADMIN_PASSWORD`.
 *
 * Garde-fous :
 *   - refuse si le compte n'existe pas (aucune création, jamais) ;
 *   - refuse si le compte n'est pas `admin` ;
 *   - refuse un compte hors fixture (`*.local`) sauf `--force` — évite
 *     d'écraser le mot de passe d'un compte réel par erreur ;
 *   - dry-run par défaut : n'écrit qu'avec `--yes`.
 *
 * Usage :
 *   pnpm e2e:set-admin-password           # dry-run
 *   pnpm e2e:set-admin-password --yes     # applique
 */
import * as bcrypt from "bcryptjs"
import { UserRole, UserStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"

const email = process.env.E2E_ADMIN_EMAIL?.trim()
const password = process.env.E2E_ADMIN_PASSWORD?.trim()
const APPLY = process.argv.includes("--yes")
const FORCE = process.argv.includes("--force")
const MIN_LEN = 12

async function main() {
  if (!email || !password) {
    console.error("✖ E2E_ADMIN_EMAIL et E2E_ADMIN_PASSWORD doivent être remplies dans .env.local.")
    console.error("  Exemple :")
    console.error('    E2E_ADMIN_EMAIL="admin@docbel.local"')
    console.error('    E2E_ADMIN_PASSWORD="un-mot-de-passe-que-tu-choisis"')
    process.exit(1)
  }
  if (password.length < MIN_LEN) {
    console.error(`✖ Mot de passe trop court (${MIN_LEN} caractères minimum).`)
    process.exit(1)
  }
  if (!email.endsWith(".local") && !FORCE) {
    console.error(`✖ « ${email} » n'est pas un compte de fixture (*.local).`)
    console.error("  Écraser le mot de passe d'un compte RÉEL exige --force (à tes risques).")
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, status: true },
  })
  if (!user) {
    console.error(`✖ Aucun compte « ${email} » en base.`)
    console.error("  Ce script ne CRÉE jamais de compte — choisis un compte admin existant.")
    process.exit(1)
  }
  if (user.role !== UserRole.admin) {
    console.error(`✖ « ${email} » a le rôle « ${user.role} », pas « admin ».`)
    process.exit(1)
  }

  console.log(`Compte ciblé : ${user.email}  (rôle ${user.role}, statut ${user.status})`)
  if (!APPLY) {
    console.log("\n[DRY-RUN] Rien n'a été écrit. Relance avec --yes pour appliquer.")
    return
  }

  const hash = await bcrypt.hash(password, 10)
  // Miroir sur User + source de vérité Better Auth (table Account "credential").
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hash,
      status: UserStatus.active,
      emailVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })
  await prisma.account.upsert({
    where: {
      providerId_accountId: { providerId: "credential", accountId: user.id },
    },
    update: { password: hash },
    create: {
      id: `acc_${user.id}_credential`,
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hash,
    },
  })

  console.log("✓ Mot de passe mis à jour (bcrypt), compte actif et déverrouillé.")
  console.log("  → pnpm test:e2e tests/e2e/reglementation/lookup-encart.spec.ts")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
