import { test, expect } from "@playwright/test"
import {
  DEMO_ACCOUNTS,
  loginAsAdmin,
  requireAdminCredentials,
} from "../helpers/auth"
import { openViewAsMenu } from "../helpers/view-as"

/**
 * Flow basique d'impersonation :
 *   admin → menu compte → sous-menu "Voir en tant que" → clique "Citoyen" →
 *   bannière apparaît → clique "Revenir admin" → retour /admin sans bannière.
 *
 * Pré-requis :
 *   - DB seedée avec les 3 comptes demo (`pnpm tsx scripts/seed-demo-accounts.ts`)
 *   - Dev server lancé sur localhost:3000 (cf. feedback_dev_server_env)
 *   - En NODE_ENV=development pour shortcut le modal raison (le menu
 *     impersonifie directement, sans demander de raison).
 *   - E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD définies sur un VRAI compte admin.
 */
test.describe("Impersonation — flow de base", () => {
  // Dev server : compilation à la demande, mesurée entre 30 s et 230 s selon la
  // route. Le timeout par défaut de 60 s rend la suite ingérable à froid.
  test.describe.configure({ timeout: 240_000 })

  test("admin peut impersonifier le compte demo citoyen puis revenir", async ({
    page,
    request,
  }) => {
    const creds = requireAdminCredentials(test)

    await loginAsAdmin(page, request, creds)
    // Large viewport : la sidebar admin (qui porte le menu compte) doit être
    // déployée, pas repliée en mode icônes.
    await page.setViewportSize({ width: 1600, height: 900 })

    await openViewAsMenu(page, creds.email)

    // Le menu lazy-fetch les comptes demo via /api/admin/demo-accounts dès
    // l'ouverture. On attend que l'item "Citoyen" soit présent.
    const citoyenItem = page.getByRole("menuitem", { name: /citoyen/i }).first()
    await expect(citoyenItem).toBeVisible({ timeout: 10_000 })
    await citoyenItem.click()

    // Le hard reload via window.location.href = "/" suit. On attend que
    // l'URL passe à "/" et que la bannière sticky soit montée.
    await page.waitForURL(/\/$/, { timeout: 90_000 })

    // La bannière contient "Vous voyez le site comme" + le nom du target.
    // On cible une zone stricte (le banner est sticky top, z-60).
    const banner = page
      .locator("div")
      .filter({ hasText: /vous voyez le site comme/i })
      .first()
    // Timeout généreux : la bannière est un composant client qui attend la
    // session, sur une home lourde à compiler en dev (~90 s à froid).
    await expect(banner).toBeVisible({ timeout: 30_000 })
    await expect(banner).toContainText(/citoyen|demo/i)

    // Couleur verte pour le rôle citoyen (ROLE_THEME.user.wrap utilise
    // bg-emerald-100). On vérifie la classe Tailwind directement.
    const bannerClass = (await banner.getAttribute("class")) || ""
    expect(bannerClass).toMatch(/emerald/)

    // Clic "Revenir admin" — texte exact : "Revenir admin" (cf.
    // impersonation-banner.tsx). Sous /admin une autre instance pourrait
    // exister donc on s'attache à la bannière.
    const stopButton = banner.getByRole("button", { name: /revenir admin/i })
    await expect(stopButton).toBeVisible()
    await stopButton.click()

    // Hard redirect vers /admin via window.location.href.
    await page.waitForURL(/\/admin/, { timeout: 90_000 })

    // La bannière ne doit plus être visible (session admin restaurée,
    // impersonatedBy === null).
    await expect(
      page
        .locator("div")
        .filter({ hasText: /vous voyez le site comme/i })
        .first()
    ).toHaveCount(0)
  })

  test("le menu liste les 3 comptes demo après seed", async ({
    page,
    request,
  }) => {
    const creds = requireAdminCredentials(test)
    await loginAsAdmin(page, request, creds)
    await page.setViewportSize({ width: 1600, height: 900 })

    await openViewAsMenu(page, creds.email)

    // Section "Comptes demo" doit lister citoyen / partenaire / employeur
    // (cf. seed-demo-accounts.ts ACCOUNTS).
    await expect(page.getByText(/comptes demo/i)).toBeVisible({
      timeout: 10_000,
    })
    // Au moins un des 3 items doit apparaître. On vérifie les emails plutôt
    // que les labels rôles : c'est moins ambigu et plus stable que de scruter
    // le DOM par rôle (la search field affiche aussi des labels).
    await expect(page.getByText(DEMO_ACCOUNTS.citoyen)).toBeVisible({
      timeout: 10_000,
    })
  })
})
