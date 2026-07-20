import { expect, type Page, type APIRequestContext } from "@playwright/test"

/**
 * Identifiants admin pour les tests E2E.
 *
 * Doivent pointer sur un compte admin EXISTANT en DB (pas de création de
 * fixtures — la DB Neon est partagée, on ne pollue pas avec des comptes test).
 * Documenter ces vars dans .env.example si on les ajoute là-bas.
 *
 * Si non définies → les tests appelants doivent `test.skip()` proprement (cf.
 * `requireAdminCredentials`).
 */
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD

/// Emails des comptes demo seedés par `scripts/seed-demo-accounts.ts`.
export const DEMO_ACCOUNTS = {
  citoyen: "demo+citoyen@docbel.local",
  partenaire: "demo+partenaire@docbel.local",
  employeur: "demo+employeur@docbel.local",
} as const

/**
 * Indique au test runner que les credentials sont requis. Renvoie un objet
 * `{ email, password }` non-nul ou skip le test.
 *
 * Usage en tête de test :
 *   const creds = requireAdminCredentials(test)
 */
export function requireAdminCredentials(testFn: {
  skip: (condition: boolean, reason?: string) => void
}): { email: string; password: string } {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    testFn.skip(
      true,
      "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD non définies — voir tests/e2e/README.md"
    )
    // Throw pour que TypeScript comprenne que ça return jamais. Le skip
    // ci-dessus court-circuite mais TS ne le sait pas.
    throw new Error("credentials skipped")
  }
  return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
}

/**
 * Login admin via l'API Better Auth puis attend que la session soit posée.
 *
 * On passe par `request.post("/api/auth/sign-in/email", { ... })` plutôt que
 * par l'UI du `/login` pour gagner ~2s par test (pas de hydration React,
 * pas d'animations glass). Better Auth pose le cookie de session côté
 * réponse — le `BrowserContext` le persiste automatiquement.
 *
 * Vérifie ensuite via /admin que la session est valide : si elle ne l'est
 * pas, l'app render un layout sans le shell admin (cf. middleware), donc
 * on ne risquerait pas de voir le menu "Voir en tant que".
 */
export async function loginAsAdmin(
  page: Page,
  request: APIRequestContext,
  creds: { email: string; password: string }
) {
  const res = await request.post("/api/auth/sign-in/email", {
    data: {
      email: creds.email,
      password: creds.password,
    },
  })
  // Better Auth renvoie 200 sur succès, 401 sur creds invalides.
  if (!res.ok()) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `loginAsAdmin failed (${res.status()}): ${body.slice(0, 200)}`
    )
  }
  // Synchronise les cookies du request context vers le browser context (sinon
  // le page.goto() suivant repart sans session).
  //
  // ⚠️ Le fixture `request` de Playwright est un APIRequestContext SÉPARÉ du
  // navigateur : ses cookies ne remontent PAS tout seuls dans page.context().
  // On les transfère explicitement — sans ça, le sign-in réussit (200) mais la
  // page reste anonyme.
  const apiState = await request.storageState()
  if (apiState.cookies.length > 0) {
    await page.context().addCookies(apiState.cookies)
  }

  const cookies = await page.context().cookies()
  const hasSessionCookie = cookies.some((c) =>
    c.name.includes("session")
  )
  if (!hasSessionCookie) {
    throw new Error(
      "Cookie session Better Auth absent après sign-in — vérifie que page.context() et request partagent le même storageState"
    )
  }
  // Navigate sur /admin pour s'assurer que la session est bien activée.
  await page.goto("/admin")
  // Le shell admin contient un titre/heading "Admin" ou la sidebar — on
  // se contente d'attendre que l'URL reste sur /admin (pas de redirect /login).
  await expect(page).toHaveURL(/\/admin/)
}

/**
 * Wipe l'état d'auth pour repartir d'une page propre. Utile entre tests qui
 * partagent un BrowserContext (rare, mais sécurité).
 */
export async function clearAuth(page: Page) {
  await page.context().clearCookies()
}
