import { test, expect } from "@playwright/test"
import {
  DEMO_ACCOUNTS,
  loginAsAdmin,
  requireAdminCredentials,
} from "../helpers/auth"

/**
 * Audit log /admin/impersonation (table AdminImpersonationLog, migration 39) :
 *   - admin impersonifie le compte demo citoyen
 *   - admin stop l'impersonation
 *   - admin va sur /admin/impersonation
 *   - une ligne récente doit lister cet event avec l'email de l'admin,
 *     l'email du target et "impersonation" comme mode.
 *
 * On ne fait pas d'assertion stricte sur la position (1ère ligne) car
 * d'autres tests/dev concurrents peuvent injecter des events. On scrute le
 * tableau pour une ligne qui matche notre couple {admin, target} et est
 * récente.
 */
test.describe("Impersonation — page audit /admin/impersonation", () => {
  test("liste les events d'impersonation après un cycle complet", async ({
    page,
    request,
  }) => {
    const creds = requireAdminCredentials(test)
    await loginAsAdmin(page, request, creds)

    // Snapshot du nombre total d'events AVANT (pour vérifier qu'on en ajoute
    // bien un nouveau). Lit le header de la page.
    await page.goto("/admin/impersonation")
    const headerText = await page
      .getByText(/\d+ entrée/i)
      .first()
      .textContent()
    const beforeMatch = headerText?.match(/(\d+)\s+entrée/i)
    const beforeCount = beforeMatch ? parseInt(beforeMatch[1], 10) : 0

    // Déclenche un cycle complet impersonation citoyen → stop, via les
    // routes API directement (plus rapide et déterministe que le clic dans
    // l'UI ; les autres tests couvrent déjà l'UI).
    const accountsRes = await request.get("/api/admin/demo-accounts")
    expect(accountsRes.ok()).toBe(true)
    const accounts = (await accountsRes.json()) as {
      accounts: Array<{ id: string; email: string }>
    }
    const citoyen = accounts.accounts.find(
      (a) => a.email === DEMO_ACCOUNTS.citoyen
    )
    expect(
      citoyen,
      `compte demo citoyen absent — lance scripts/seed-demo-accounts.ts`
    ).toBeDefined()

    const impRes = await request.post("/api/admin/impersonate", {
      data: {
        userId: citoyen!.id,
        // En NODE_ENV != production la raison est optionnelle, mais on
        // l'envoie quand même pour rendre la ligne d'audit plus identifiable.
        reason: "E2E test audit-log.spec",
      },
    })
    expect(impRes.ok()).toBe(true)

    const stopRes = await request.post("/api/admin/stop-impersonate")
    expect(stopRes.ok()).toBe(true)

    // Recharge la page audit. Better Auth a restauré la session admin via
    // stop-impersonate, donc on devrait revoir la page.
    await page.goto("/admin/impersonation")

    // Vérifie qu'il y a au moins 1 entrée de plus qu'avant.
    const headerAfter = await page
      .getByText(/\d+ entrée/i)
      .first()
      .textContent()
    const afterMatch = headerAfter?.match(/(\d+)\s+entrée/i)
    const afterCount = afterMatch ? parseInt(afterMatch[1], 10) : 0
    expect(afterCount).toBeGreaterThan(beforeCount)

    // Cherche dans le tableau une ligne avec l'email du citoyen demo + mode
    // "impersonation". Le tableau est rendu via <table> donc on peut cibler
    // via les <tr> qui contiennent ces 2 textes.
    const tableRow = page
      .locator("tbody tr")
      .filter({ hasText: DEMO_ACCOUNTS.citoyen })
      .filter({ hasText: /impersonation/i })
      .first()
    await expect(tableRow).toBeVisible()

    // Vérifie aussi qu'on retrouve l'email de l'admin sur la ligne (colonne
    // "Admin").
    await expect(tableRow).toContainText(creds.email)
  })
})
