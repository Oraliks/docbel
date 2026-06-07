import { test, expect } from "@playwright/test"
import { loginAsAdmin, requireAdminCredentials } from "../helpers/auth"

/**
 * Mode "visiteur anonyme" (Phase D #2) :
 *   admin → menu "Voir en tant que" → "Visiteur anonyme" → bannière grise +
 *   plus de session côté client → "Revenir admin" → restauration session admin.
 *
 * Différences avec le flow impersonation classique :
 *   - Pas de session Better Auth pendant le mode (déco navigateur, stash
 *     signé HMAC côté serveur).
 *   - La bannière lit le cookie marqueur `view_as_visitor=1` (non HttpOnly).
 *   - Le bouton "Revenir admin" appelle /api/admin/restore-admin et redirige
 *     vers /admin.
 */
test.describe("Impersonation — mode visiteur anonyme", () => {
  test("admin peut basculer en visiteur anonyme et revenir admin", async ({
    page,
    request,
  }) => {
    const creds = requireAdminCredentials(test)
    await loginAsAdmin(page, request, creds)

    // Ouvre le menu Voir en tant que
    await page.getByRole("button", { name: /voir en tant que/i }).click()

    // Section "Modes" → item "Visiteur anonyme" (cf. view-as-menu.tsx :
    // span "Visiteur anonyme" + description "Te déconnecte avec retour 1-clic en admin").
    const visitorItem = page.getByRole("menuitem", {
      name: /visiteur anonyme/i,
    })
    await expect(visitorItem).toBeVisible()
    await visitorItem.click()

    // /api/admin/view-as-visitor redirige vers / via window.location.
    await page.waitForURL(/\/$/, { timeout: 15_000 })

    // Bannière grise spécifique "Vous voyez le site en visiteur anonyme"
    // (cf. impersonation-banner.tsx branche `if (!session && isVisitor)`).
    const banner = page
      .locator("div")
      .filter({ hasText: /vous voyez le site en/i })
      .filter({ hasText: /visiteur anonyme/i })
      .first()
    await expect(banner).toBeVisible({ timeout: 10_000 })

    // Couleur grise : VISITOR_THEME.wrap utilise bg-slate-100. On vérifie la
    // classe Tailwind (slate plutôt que emerald/violet/sky pour distinguer
    // du flow impersonation).
    const bannerClass = (await banner.getAttribute("class")) || ""
    expect(bannerClass).toMatch(/slate/)

    // Clic "Revenir admin" → POST /api/admin/restore-admin → window.location = /admin
    await banner.getByRole("button", { name: /revenir admin/i }).click()

    await page.waitForURL(/\/admin/, { timeout: 15_000 })

    // Plus aucune bannière (ni impersonation ni visiteur). La session admin
    // est restaurée → SiteHeader admin visible avec le bouton "Voir en tant que".
    await expect(
      page
        .locator("div")
        .filter({ hasText: /vous voyez le site/i })
        .first()
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: /voir en tant que/i })
    ).toBeVisible()
  })
})
