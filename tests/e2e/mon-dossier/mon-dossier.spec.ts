import { test, expect } from "@playwright/test";

// E2E /mon-dossier : guichet unique (refonte Task 4.1). Le toggle « Je me
// laisse guider » / « J'accède directement » a été SUPPRIMÉ : le guichet
// (wizard) ET le catalogue sont désormais TOUJOURS affichés, empilés
// verticalement (plus d'onglet, plus d'écran vide au premier chargement).
// Nécessite le dev server (pnpm dev) + DB accessible.
// Lancer : pnpm test:e2e tests/e2e/mon-dossier
// ⚠ Sélecteurs mis à jour pour la nouvelle UI mais NON rejoués à l'écriture
// (workflow d'implémentation sans dev server) — à confirmer au 1er run e2e.

test.describe("/mon-dossier — guichet unique", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/mon-dossier");
    // Le guichet (wizard) est toujours affiché — plus de bascule.
    await expect(
      page.getByRole("heading", { name: /Qu'est-ce qui vous arrive/i }),
    ).toBeVisible();
  });

  test("guichet ET catalogue visibles d'emblée, plus aucun onglet de bascule", async ({
    page,
  }) => {
    // Le guichet en haut…
    await expect(
      page.getByRole("heading", { name: /Qu'est-ce qui vous arrive/i }),
    ).toBeVisible();
    // …et le catalogue « Parcourir tous les dossiers » en dessous, sans bascule.
    await expect(
      page.getByRole("heading", { name: /Parcourir tous les dossiers/i }),
    ).toBeVisible();
    // Le toggle 2-modes n'existe plus.
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /J'accède directement/i }),
    ).toHaveCount(0);
  });

  test("le wizard avance à l'étape 2 après une situation", async ({ page }) => {
    await page.getByRole("button", { name: /perdu mon emploi/i }).click();
    await expect(page.getByText(/Quel est votre parcours/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Précédent/i })).toBeVisible();
  });

  test("recherche du catalogue sans résultat affiche le message dédié", async ({
    page,
  }) => {
    // Le catalogue est toujours visible : pas besoin de basculer d'onglet.
    const catalogue = page
      .getByRole("heading", { name: /Parcourir tous les dossiers/i })
      .locator("xpath=ancestor::section[1]");
    await catalogue.getByLabel(/Rechercher un dossier/i).fill("zzzznexistepasxyz");
    await expect(page.getByText(/Aucun dossier ne correspond/i)).toBeVisible();
  });

  test("ouvrir un dossier depuis le catalogue navigue vers /d/[slug]", async ({
    page,
  }) => {
    const catalogue = page
      .getByRole("heading", { name: /Parcourir tous les dossiers/i })
      .locator("xpath=ancestor::section[1]");
    const firstDossier = catalogue.locator('a[href^="/d/"]').first();
    // Skip si aucun bundle publié dans l'environnement de test.
    if ((await firstDossier.count()) === 0) test.skip();
    const href = await firstDossier.getAttribute("href");
    await firstDossier.click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, "\\/")));
  });
});
