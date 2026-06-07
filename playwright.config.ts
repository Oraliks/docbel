import { defineConfig, devices } from "@playwright/test"

/**
 * Configuration Playwright pour les tests E2E Beldoc.
 *
 * Choix structurants :
 *   - 1 seul worker : la DB Neon est PARTAGÉE entre dev + agents Claude. Lancer
 *     plusieurs workers en parallèle créerait des fuites d'état entre tests
 *     (sessions Better Auth, AdminImpersonationLog, etc.). On préfère la
 *     lenteur à l'instabilité.
 *   - Pas de webServer auto : le dev server doit déjà tourner (ou être lancé
 *     manuellement) car il dépend d'ANTHROPIC_API_KEY etc. configurés
 *     localement (cf. feedback_dev_server_env). Lancer `pnpm dev` puis
 *     `pnpm test:e2e`.
 *   - baseURL configurable via PLAYWRIGHT_BASE_URL pour pouvoir pointer sur
 *     une preview Vercel le cas échéant.
 *   - testDir = tests/e2e (séparé de vitest qui vit dans lib/**\/__tests__).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Pas de parallélisme : voir commentaire ci-dessus.
  fullyParallel: false,
  workers: 1,
  // Pas de retry : un test E2E qui flake doit être fixé, pas réessayé en
  // silence. En CI on peut surcharger via CLI si nécessaire.
  retries: 0,
  // Timeout généreux : les routes API touchent une Neon partagée qui peut
  // cold-starter (P1001 → ~5s de pause + retry).
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Locale fr-BE pour aligner sur le formatage français des dates dans
    // /admin/impersonation (toLocaleString("fr-BE")).
    locale: "fr-BE",
    timezoneId: "Europe/Brussels",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
