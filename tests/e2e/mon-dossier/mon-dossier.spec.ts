import { test, expect } from "@playwright/test";

// E2E /mon-dossier : parcours (segmented control), wizard, recherche, aide.
// Le toggle « Je me laisse guider » / « J'accède directement » est un vrai
// switch : l'accès direct est MASQUÉ tant qu'on n'a pas basculé d'onglet.
// Nécessite le dev server (pnpm dev) + DB accessible.
// Lancer : pnpm test:e2e tests/e2e/mon-dossier

test.describe("/mon-dossier — porte d'entrée", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/mon-dossier");
    await expect(
      page.getByRole("heading", { name: /Créer ou retrouver/i }),
    ).toBeVisible();
  });

  test("parcours guidé visible par défaut + aide persistante", async ({
    page,
  }) => {
    // Le wizard est affiché par défaut (onglet « Je me laisse guider »).
    await expect(page.getByText(/L'assistant dossier/i)).toBeVisible();
    // L'aide est une colonne toujours présente.
    await expect(
      page.getByRole("heading", { name: /Besoin d'aide/i }),
    ).toBeVisible();
    // L'accès direct n'est pas l'onglet actif au chargement.
    await expect(
      page.getByRole("tab", { name: /J'accède directement/i }),
    ).toHaveAttribute("aria-selected", "false");
  });

  test("le toggle bascule vers l'accès direct (recherche)", async ({ page }) => {
    const directTab = page.getByRole("tab", { name: /J'accède directement/i });
    await directTab.click();
    await expect(directTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel(/Rechercher un dossier/i)).toBeVisible();
  });

  test("le wizard avance à l'étape 2 après une situation", async ({ page }) => {
    await page.getByRole("button", { name: /perdu mon emploi/i }).click();
    await expect(page.getByText(/Quel est votre parcours/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Précédent/i })).toBeVisible();
  });

  test("recherche sans résultat affiche le message dédié", async ({ page }) => {
    await page.getByRole("tab", { name: /J'accède directement/i }).click();
    await page.getByLabel(/Rechercher un dossier/i).fill("zzzznexistepasxyz");
    await expect(page.getByText(/Aucun dossier ne correspond/i)).toBeVisible();
  });

  test("ouvrir un dossier depuis l'accès direct navigue vers /d/[slug]", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: /J'accède directement/i }).click();
    const firstDossier = page.locator('a[href^="/d/"]').first();
    // Skip si aucun bundle publié dans l'environnement de test.
    if ((await firstDossier.count()) === 0) test.skip();
    const href = await firstDossier.getAttribute("href");
    await firstDossier.click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, "\\/")));
  });
});
