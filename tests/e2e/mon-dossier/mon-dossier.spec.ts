import { test, expect } from "@playwright/test";

// E2E /mon-dossier : guichet unique (refonte Task 4.1). Le toggle « Je me
// laisse guider » / « J'accède directement » a été SUPPRIMÉ. Le guichet
// (wizard, dans #guichet, sous « Qu'est-ce qui vous arrive ? ») ET le
// catalogue (« Parcourir tous les dossiers » : recherche + tris + filtres)
// sont désormais TOUJOURS affichés, empilés verticalement dans le même
// scroll — plus d'onglet, plus de rôle "tab"/"aria-selected", plus d'écran
// vide au 1er chargement, et la recherche du catalogue est directement
// visible sans aucune bascule préalable.
// Nécessite le dev server (pnpm dev) + DB accessible.
// Lancer : pnpm test:e2e tests/e2e/mon-dossier
// ⚠ Sélecteurs alignés sur la nouvelle UI (valeurs i18n vérifiées :
// guichetTitle / guichetBrowseAll / wizardAssistantTitle / searchAriaLabel /
// emptyNoMatchTitle) mais NON rejoués à l'écriture — workflow sans dev
// server ; à confirmer au 1er `pnpm test:e2e`.

test.describe("/mon-dossier — guichet unique", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/mon-dossier");
    // Le guichet (wizard) est affiché d'emblée — plus de bascule d'onglet.
    await expect(
      page.getByRole("heading", { name: /Qu'est-ce qui vous arrive/i }),
    ).toBeVisible();
  });

  test("guichet ET catalogue visibles d'emblée, recherche directe, aucun onglet", async ({
    page,
  }) => {
    // 1) Le guichet (wizard) en haut : son titre de section + l'assistant.
    await expect(
      page.getByRole("heading", { name: /Qu'est-ce qui vous arrive/i }),
    ).toBeVisible();
    await expect(page.getByText(/L'assistant dossier/i)).toBeVisible();

    // 2) Le catalogue « Parcourir tous les dossiers » est rendu EN DESSOUS,
    //    dans le même scroll, sans avoir à basculer d'onglet.
    const catalogue = page
      .getByRole("heading", { name: /Parcourir tous les dossiers/i })
      .locator("xpath=ancestor::section[1]");
    await expect(
      catalogue.getByRole("heading", { name: /Parcourir tous les dossiers/i }),
    ).toBeVisible();

    // 3) La recherche du catalogue est directement visible au chargement,
    //    sans aucun clic d'onglet préalable.
    await expect(catalogue.getByRole("searchbox")).toBeVisible();

    // 4) Le toggle 2-modes a disparu : plus d'onglet, ni bouton de bascule.
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /J'accède directement/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Je me laisse guider/i }),
    ).toHaveCount(0);
  });

  test("recherche du catalogue sans résultat affiche le message dédié", async ({
    page,
  }) => {
    // Recherche directement accessible : aucune bascule d'onglet préalable.
    const catalogue = page
      .getByRole("heading", { name: /Parcourir tous les dossiers/i })
      .locator("xpath=ancestor::section[1]");
    await catalogue.getByRole("searchbox").fill("zzzznexistepasxyz");
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
