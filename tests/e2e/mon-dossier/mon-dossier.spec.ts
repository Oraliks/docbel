import { test, expect } from "@playwright/test";

// E2E /mon-dossier : 3 zones, recherche, wizard multi-résultats, reprise.
// Nécessite le dev server (pnpm dev) + DB accessible.
// Lancer : pnpm test:e2e tests/e2e/mon-dossier

test.describe("/mon-dossier — porte d'entrée", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/mon-dossier");
    await expect(
      page.getByRole("heading", { name: /Créer ou retrouver/i }),
    ).toBeVisible();
  });

  test("affiche les 3 zones (Assistant / Accès direct / Reprendre)", async ({
    page,
  }) => {
    await expect(page.getByText(/L'assistant dossier/i)).toBeVisible();
    await expect(page.getByText(/Accès direct/i).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Reprendre un dossier/i }),
    ).toBeVisible();
  });

  test("le wizard avance à l'étape 2 après une situation", async ({ page }) => {
    await page.getByRole("button", { name: /perdu mon emploi/i }).click();
    await expect(page.getByText(/Quel est votre parcours/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Précédent/i })).toBeVisible();
  });

  test("recherche sans résultat affiche le message dédié", async ({ page }) => {
    await page
      .getByLabel(/Rechercher un dossier/i)
      .fill("zzzznexistepasxyz");
    await expect(page.getByText(/Aucun dossier ne correspond/i)).toBeVisible();
  });

  test("un code de reprise invalide affiche une erreur générique", async ({
    page,
  }) => {
    await page.getByLabel(/code de reprise/i).fill("BELDOC-ZZZZ-ZZZZ");
    await page
      .getByRole("button", { name: /Reprendre la démarche/i })
      .click();
    await expect(
      page.getByText(/n'est pas valide ou a expiré/i),
    ).toBeVisible();
  });

  test("ouvrir un dossier depuis l'accès direct navigue vers /d/[slug]", async ({
    page,
  }) => {
    const firstDossier = page.locator('a[href^="/d/"]').first();
    // Skip si aucun bundle publié dans l'environnement de test.
    if ((await firstDossier.count()) === 0) test.skip();
    const href = await firstDossier.getAttribute("href");
    await firstDossier.click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, "\\/")));
  });
});
