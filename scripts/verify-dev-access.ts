/**
 * Intégration HTTP réelle des accès, exclusivement sur une DB jetable marquée.
 * Ne charge aucun .env, ne réutilise aucun compte existant et aucun navigateur.
 * Voir docs/operations/DEV_ACCESS_VERIFICATION.md pour les prérequis.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { PrismaClient, UserRole } from "@prisma/client"
import { hash } from "bcryptjs"

const results: Array<{ test: string; result: string }> = []
const runId = `access-${randomUUID()}`
const reportPath = resolve("docs/operations/DEV_ACCESS_VERIFICATION.md")
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"])

function configuration() {
  const databaseUrl = process.env.DOCBEL_ACCESS_TEST_DATABASE_URL
  const databaseName = process.env.DOCBEL_ACCESS_TEST_DATABASE_NAME
  const baseUrl = process.env.DOCBEL_ACCESS_TEST_BASE_URL
  const mode = process.env.DOCBEL_ACCESS_TEST_MODE
  assert(databaseUrl && databaseName && baseUrl, "URL DB, nom DB exact et URL serveur dédiés requis")
  assert(mode === "development" || mode === "production", "Mode serveur explicite requis")
  const db = new URL(databaseUrl)
  const server = new URL(baseUrl)
  assert(["postgres:", "postgresql:"].includes(db.protocol), "PostgreSQL requis")
  assert(/^docbel_audit_access_[a-z0-9_]+$/.test(databaseName), "Nom de DB jetable access attendu")
  assert.equal(decodeURIComponent(db.pathname.slice(1)), databaseName, "La DB de l'URL doit correspondre au nom dédié")
  assert(loopback.has(server.hostname), "Le serveur HTTP doit être local")
  assert(server.protocol === "http:" || server.protocol === "https:", "Protocole HTTP requis")
  assert.equal(server.pathname, "/", "URL serveur sans préfixe de chemin requise")
  assert(!server.username && !server.password, "URL serveur sans identifiants requise")
  return { databaseUrl, databaseName, baseUrl: server.origin, mode }
}

class HttpSession {
  private readonly cookies = new Map<string, string>()
  constructor(private readonly baseUrl: string) {}

  async request(path: string, method = "GET", body?: unknown) {
    assert(path.startsWith("/api/"), "Le runner appelle uniquement les API locales")
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      redirect: "error",
      headers: {
        Origin: this.baseUrl,
        Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(240_000),
    })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0]
      const separator = pair.indexOf("=")
      const key = pair.slice(0, separator)
      const value = pair.slice(separator + 1)
      if (!value || /(?:^|;)\s*max-age=0(?:;|$)/i.test(cookie)) this.cookies.delete(key)
      else this.cookies.set(key, value)
    }
    return response
  }
}

async function check(name: string, test: () => Promise<void>) {
  try {
    await test()
    results.push({ test: name, result: "PASS" })
    console.log(`PASS ${name}`)
  } catch (error) {
    results.push({ test: name, result: "FAIL" })
    throw error
  }
}

async function expectStatus(response: Response, status: number) {
  assert.equal(response.status, status, `HTTP ${status} attendu pour ${new URL(response.url).pathname}`)
}

async function writeReport(config: ReturnType<typeof configuration>, cleaned: boolean, failure?: string) {
  const now = new Date()
  const date = new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Brussels",
  }).format(now)
  const time = new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Brussels",
  }).format(now)
  const table = results.map(({ test, result }) => `| ${test} | ${result} |`).join("\n")
  const productionReasonPassed = results.some(({ test, result }) =>
    test === "Justification obligatoire en production avant toute impersonation" && result === "PASS")
  const content = `# Vérification locale des accès — ${date} à ${time}

Commande : \`node node_modules/tsx/dist/cli.mjs scripts/verify-dev-access.ts\`.

## Environnement et niveau de preuve

- Serveur Next.js réel : ${config.baseUrl}, mode ${config.mode}.
- PostgreSQL : base dédiée \`${config.databaseName}\`, créée vide, marqueur d'isolation vérifié avant écriture. Aucun clone de données réelles.
- Comptes et fichiers créés pour cette exécution : fixtures aléatoires uniquement. Aucun compte existant modifié. Aucun email envoyé.
- Requêtes HTTP réelles via fetch, cookies Better Auth réels, requêtes Prisma réelles. Aucun mock et aucun navigateur.
- Identifiant de l'exécution : \`${runId}\`. Nettoyage des fixtures : **${cleaned ? "réussi" : "non confirmé"}**.

## Résultats

| Vérification | Résultat |
| --- | --- |
${table || "| Aucune vérification exécutée | NON EXÉCUTÉ |"}

${failure ? `**Exécution interrompue :** ${failure}\n` : "**Toutes les vérifications exécutées ont réussi.**\n"}
## Limites

- Le client HTTP transporte les cookies explicitement ; il ne prouve pas le comportement navigateur (Secure, SameSite, interface, bannières). La recette navigateur est distincte.
- Les téléchargements testés utilisent des fichiers locaux factices. Les ACL et la migration des objets Vercel Blob exigent leur propre validation.
- ${productionReasonPassed ? "L'obligation de justification d'impersonation a été exercée avec succès en mode production local." : config.mode === "production" ? "Cette exécution ne confirme pas l'obligation de justification d'impersonation en production : le contrôle n'a pas réussi ou n'a pas été atteint." : "L'obligation de justification en production reste couverte uniquement par tests unitaires ; le serveur de cette exécution est en développement."}
- Ce résultat concerne la copie locale testée. Aucun déploiement ni vérification des comptes de production n'est effectué.

## Relance sûre

Fournir exclusivement les variables dédiées \`DOCBEL_ACCESS_TEST_DATABASE_URL\`, \`DOCBEL_ACCESS_TEST_DATABASE_NAME\`, \`DOCBEL_ACCESS_TEST_BASE_URL\` et \`DOCBEL_ACCESS_TEST_MODE\`. Ne pas charger \`.env.local\` pour le runner. L'URL du serveur doit être locale ; son processus Next.js doit avoir la même DB dédiée et des secrets factices.

La DB doit porter un nom \`docbel_audit_access_*\` exact et contenir \`"_DocbelAuditIsolation"("purpose")\` avec \`access-http-20260927\`. Le runner vérifie aussi \`current_database()\` et refuse une base contenant des comptes autres que ses fixtures \`access-*\`.
`
  await writeFile(reportPath, content, "utf8")
}

async function main() {
  const config = configuration()
  if (process.argv.includes("--check-config")) {
    console.log(`Configuration validée : ${config.databaseName}, ${config.baseUrl}, ${config.mode}`)
    return
  }
  const db = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } })
  const ids = ["controller", "candidate", "owner", "demo"].map((kind) => `${runId}-${kind}`)
  const [controllerId, candidateId, ownerId, demoId] = ids
  const fileIds = [`${runId}-private`, `${runId}-public`]
  const filePaths = [resolve("private/uploads", `${runId}.txt`), resolve("public/uploads", `${runId}.txt`)]
  const password = `Fixture-${randomUUID()}-9!`
  const reason = `Vérification HTTP isolée ${runId}`
  const sentinel = `Sentinelle ${runId}`
  const privatePayload = `Document privé factice ${runId}`
  const email = (kind: string) => `${runId}-${kind}@example.test`
  const demoEmail = `demo+${runId}@docbel.local`
  const controller = new HttpSession(config.baseUrl)
  const candidate = new HttpSession(config.baseUrl)
  const owner = new HttpSession(config.baseUrl)
  const demo = new HttpSession(config.baseUrl)
  const anonymous = new HttpSession(config.baseUrl)
  let isolationVerified = false
  let cleaned = false
  let failure: string | undefined

  async function login(session: HttpSession, loginEmail: string) {
    for (let attempt = 0; attempt <= 2; attempt++) {
      const response = await session.request("/api/auth/sign-in/email", "POST", { email: loginEmail, password })
      if (response.status === 429 && attempt < 2) {
        const retryAfter = response.headers.get("retry-after")?.trim()
        const retryAt = retryAfter ? Date.parse(retryAfter) : Number.NaN
        const waitMs = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter)
          ? Math.ceil(Number(retryAfter) * 1000)
          : Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : 10_000
        assert(waitMs <= 15_000, "Retry-After dépasse l'attente maximale autorisée de 15 secondes")
        await response.text()
        console.log(`Connexion limitée : nouvelle tentative ${attempt + 1}/2 après ${waitMs} ms`)
        await delay(waitMs)
        continue
      }
      await expectStatus(response, 200)
      const body = await response.json()
      assert(body.user && !Object.hasOwn(body.user, "password"), "La connexion ne doit pas exposer le hash")
      return
    }
  }

  try {
    await check("DB dédiée et marqueur d'isolation", async () => {
      const names = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`
      assert.equal(names[0]?.name, config.databaseName, "DB PostgreSQL effective incorrecte")
      const markers = await db.$queryRaw<Array<{ purpose: string }>>`SELECT "purpose" FROM "_DocbelAuditIsolation" WHERE "purpose" = ${"access-http-20260927"} LIMIT 1`
      assert.equal(markers[0]?.purpose, "access-http-20260927", "Marqueur isolé absent")
      assert.equal(await db.user.count({ where: { NOT: { id: { startsWith: "access-" } } } }), 0, "La base contient des comptes étrangers aux fixtures access")
      isolationVerified = true
    })

    const passwordHash = await hash(password, 10)
    for (const [index, kind] of ["controller", "candidate", "owner", "demo"].entries()) {
      await db.user.create({ data: {
        id: ids[index], name: `Fixture ${kind}`, email: kind === "demo" ? demoEmail : email(kind),
        role: index < 2 ? UserRole.admin : UserRole.user, status: "active", password: passwordHash,
        emailVerified: true,
        accounts: { create: { id: `${ids[index]}-credential`, accountId: ids[index], providerId: "credential", password: passwordHash } },
      } })
    }
    await db.userProfile.createMany({ data: ids.map((userId) => ({ userId, firstName: sentinel })) })
    await mkdir(resolve("private/uploads"), { recursive: true })
    await mkdir(resolve("public/uploads"), { recursive: true })
    await writeFile(filePaths[0], privatePayload, { flag: "wx" })
    await writeFile(filePaths[1], `Document public factice ${runId}`, { flag: "wx" })
    for (const [index, isPrivate] of [true, false].entries()) {
      await db.file.create({ data: {
        id: fileIds[index], name: `${runId}.txt`, type: "file", mimeType: "text/plain; charset=utf-8",
        isPrivate, filePath: `${isPrivate ? "private" : "public"}/uploads/${runId}.txt`, createdBy: controllerId,
      } })
    }

    await check("Connexion factice et preuve HTTP que Next utilise la même DB", async () => {
      await login(controller, email("controller"))
      const response = await controller.request("/api/user/profile")
      await expectStatus(response, 200)
      assert.equal((await response.json()).firstName, sentinel, "Sentinelle DB HTTP incorrecte")
      await login(candidate, email("candidate"))
      await login(owner, email("owner"))
      await login(demo, demoEmail)
    })

    await check("Réponses de session sans hash historique", async () => {
      const response = await controller.request("/api/auth/get-session")
      await expectStatus(response, 200)
      const body = await response.json()
      assert.equal(body.user.id, controllerId)
      assert(!Object.hasOwn(body.user, "password"), "Le hash ne doit pas sortir de get-session")
      assert(!JSON.stringify(body).includes(passwordHash), "Le hash ne doit pas sortir dans une autre propriété")
    })

    await check("API Better Auth admin natives fermées malgré une session admin valide", async () => {
      for (const path of ["set-role", "impersonate-user", "stop-impersonating", "remove-user"]) {
        await expectStatus(await controller.request(`/api/auth/admin/${path}`, "POST", { userId: ownerId, role: "admin" }), 404)
      }
      await expectStatus(await controller.request("/api/auth/admin/list-users"), 404)
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: ownerId } })).role, "user")
      assert.equal(await db.adminImpersonationLog.count({ where: { adminId: controllerId } }), 0)
    })

    await check("Téléchargement privé : anonyme 401, utilisateur 403, admin 200 sans cache", async () => {
      const path = `/api/files/${fileIds[0]}/download`
      await expectStatus(await anonymous.request(path), 401)
      await expectStatus(await owner.request(path), 403)
      const response = await candidate.request(path)
      await expectStatus(response, 200)
      assert.equal(response.headers.get("cache-control"), "private, no-store")
      assert.equal(await response.text(), privatePayload)
    })

    await check("Téléchargement public accessible anonymement", async () => {
      const response = await anonymous.request(`/api/files/${fileIds[1]}/download`)
      await expectStatus(response, 200)
      assert.equal(response.headers.get("cache-control"), "public, max-age=3600")
    })

    if (config.mode === "production") {
      await check("Justification obligatoire en production avant toute impersonation", async () => {
        await expectStatus(await controller.request("/api/admin/impersonate", "POST", { userId: ownerId }), 400)
        assert.equal(await db.adminImpersonationLog.count({ where: { adminId: controllerId } }), 0)
      })
    }

    await check("Impersonation custom auditée, profil en lecture seule et retour admin", async () => {
      await expectStatus(await controller.request("/api/admin/impersonate", "POST", { userId: ownerId, reason }), 200)
      const session = await (await controller.request("/api/auth/get-session")).json()
      assert.equal(session.user.id, ownerId)
      assert.equal(session.session.impersonatedBy, controllerId)
      const log = await db.adminImpersonationLog.findFirst({ where: { adminId: controllerId, targetId: ownerId, reason } })
      assert(log && !log.stoppedAt, "Journal d'impersonation ouvert obligatoire")
      const deletion = await controller.request("/api/user/profile", "DELETE")
      await expectStatus(deletion, 403)
      assert.equal((await deletion.json()).code, "impersonation_read_only")
      await expectStatus(await controller.request("/api/user/profile", "PUT", { firstName: "Écriture interdite" }), 403)
      assert.equal((await db.userProfile.findUniqueOrThrow({ where: { userId: ownerId } })).firstName, sentinel)
      await expectStatus(await controller.request("/api/admin/stop-impersonate", "POST", {}), 200)
      assert.equal((await (await controller.request("/api/auth/get-session")).json()).user.id, controllerId)
      assert((await db.adminImpersonationLog.findUniqueOrThrow({ where: { id: log.id } })).stoppedAt)
    })

    await check("Compte démo : PUT et DELETE profil refusés sans altération", async () => {
      for (const method of ["PUT", "DELETE"]) {
        const response = await demo.request("/api/user/profile", method, method === "PUT" ? { firstName: "Interdit" } : undefined)
        await expectStatus(response, 403)
        assert.equal((await response.json()).code, "demo_read_only")
      }
      assert.equal((await db.userProfile.findUniqueOrThrow({ where: { userId: demoId } })).firstName, sentinel)
    })

    await check("Propriétaire normal : suppression puis mise à jour du profil autorisées", async () => {
      await expectStatus(await owner.request("/api/user/profile", "DELETE"), 200)
      assert.equal(await db.userProfile.count({ where: { userId: ownerId } }), 0)
      await expectStatus(await owner.request("/api/user/profile", "PUT", { firstName: sentinel }), 200)
      assert.equal((await db.userProfile.findUniqueOrThrow({ where: { userId: ownerId } })).firstName, sentinel)
    })

    await check("Statut admin relu en DB même si une session existe encore", async () => {
      await db.user.update({ where: { id: candidateId }, data: { status: "disabled" } })
      assert(await db.session.count({ where: { userId: candidateId } }) > 0)
      await expectStatus(await candidate.request(`/api/files/${fileIds[0]}/download`), 401)
      await expectStatus(await candidate.request("/api/admin/impersonate", "POST", { userId: ownerId, reason }), 401)
      await db.user.update({ where: { id: candidateId }, data: { status: "active" } })
    })

    await check("Désactivation HTTP : sessions révoquées et ancien cookie refusé immédiatement", async () => {
      await expectStatus(await controller.request(`/api/users/${candidateId}`, "PUT", { status: "disabled" }), 200)
      assert.equal(await db.session.count({ where: { userId: candidateId } }), 0)
      await expectStatus(await candidate.request(`/api/files/${fileIds[0]}/download`), 401)
      await expectStatus(await candidate.request("/api/user/profile", "PUT", { firstName: "Interdit" }), 401)
      await expectStatus(await candidate.request("/api/user/profile", "DELETE"), 401)
      await expectStatus(await candidate.request("/api/admin/impersonate", "POST", { userId: ownerId, reason }), 401)
      assert.equal((await db.userProfile.findUniqueOrThrow({ where: { userId: candidateId } })).firstName, sentinel)
    })

    await check("Rétrogradation HTTP : ancien cookie révoqué, nouveau rôle refusé en admin", async () => {
      await expectStatus(await controller.request(`/api/users/${candidateId}`, "PUT", { status: "active" }), 200)
      await login(candidate, email("candidate"))
      await expectStatus(await controller.request(`/api/users/${candidateId}`, "PUT", { role: "user" }), 200)
      assert.equal(await db.session.count({ where: { userId: candidateId } }), 0)
      await expectStatus(await candidate.request(`/api/files/${fileIds[0]}/download`), 401)
      await login(candidate, email("candidate"))
      await expectStatus(await candidate.request(`/api/files/${fileIds[0]}/download`), 403)
      await expectStatus(await candidate.request("/api/admin/impersonate", "POST", { userId: ownerId, reason }), 403)
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : "Erreur inconnue"
    console.error(failure)
    process.exitCode = 1
  } finally {
    try {
      if (isolationVerified) {
        await db.$transaction([
          db.userProfile.deleteMany({ where: { userId: { in: ids } } }),
          db.file.deleteMany({ where: { id: { in: fileIds } } }),
          db.user.deleteMany({ where: { id: { in: ids } } }),
        ])
        for (const path of filePaths) await rm(path, { force: true })
        cleaned = true
      }
    } catch {
      failure = `${failure ? `${failure}; ` : ""}Nettoyage des fixtures non confirmé (${runId})`
      process.exitCode = 1
    }
    await db.$disconnect()
    await writeReport(config, cleaned, failure)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Configuration invalide")
  process.exitCode = 1
})
