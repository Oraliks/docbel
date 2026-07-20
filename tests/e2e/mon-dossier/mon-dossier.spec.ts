import { test, expect } from "@playwright/test";

// E2E /mon-dossier : guichet à recherche UNIVERSELLE (refonte 2026-07-20).
// Le guichet mène avec « Qu'est-ce qui vous arrive ? » + UNE seule barre de
// recherche (universelle) : à vide → assistant (situations, en-tête masqué) +
// catalogue « Parcourir tous les dossiers » ; en tapant → résultats fusionnés
// « Situations » / « Dossiers » (la vue catalogue par défaut est masquée) ;
// zéro résultat → secours IA « Décrivez votre situation avec vos mots ».
// La barre propre au catalogue ET celle de l'assistant ont fusionné en une seule.
// Nécessite le dev server (pnpm dev) + DB. Lancer : pnpm test:e2e tests/e2e/mon-dossier
// ⚠ Sélecteurs alignés sur les valeurs i18n réelles (guichetTitle,
// guichetBrowseAll, intentFallbackTitle) mais NON rejoués (workflow sans dev
// server) — à confirmer au 1er `pnpm test:e2e`.

test.describe("/mon-dossier — guichet à recherche universelle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/mon-dossier");
    await expect(
      page.getByRole("heading", { name: /Qu'est-ce qui vous arrive/i }),
    ).toBeVisible();
  });

  test("une seule recherche universelle + catalogue par défaut, aucun onglet", async ({
    page,
  }) => {
    // UNE seule barre de recherche sur la page (les barres du catalogue et de
    // l'assistant ont fusionné en une recherche universelle).
    await expect(page.getByRole("searchbox")).toHaveCount(1);
    await expect(page.getByRole("searchbox")).toBeVisible();
    // À vide : le catalogue « Parcourir tous les dossiers » est rendu (vue défaut).
    await expect(
      page.getByRole("heading", { name: /Parcourir tous les dossiers/i }),
    ).toBeVisible();
    // Plus aucun onglet de bascule (hérité de la refonte guichet unique).
    await expect(page.getByRole("tab")).toHaveCount(0);
  });

  test("taper une recherche bascule en mode résultats (le catalogue par défaut disparaît)", async ({
    page,
  }) => {
    await page.getByRole("searchbox").fill("emploi");
    // isSearching → la vue par défaut (catalogue « Parcourir tous les dossiers »)
    // laisse place aux groupes de résultats fusionnés Situations/Dossiers.
    await expect(
      page.getByRole("heading", { name: /Parcourir tous les dossiers/i }),
    ).toBeHidden();
  });

  test("recherche sans résultat → secours IA", async ({ page }) => {
    await page.getByRole("searchbox").fill("zzzznexistepasxyz");
    await expect(
      page.getByText(/Décrivez votre situation avec vos mots/i),
    ).toBeVisible();
  });

  test("ouvrir un dossier depuis le catalogue navigue vers /d/[slug]", async ({
    page,
  }) => {
    // Vue par défaut : les dossiers du catalogue sont des liens /d/…
    const firstDossier = page.locator('a[href^="/d/"]').first();
    // Skip si aucun bundle publié dans l'environnement de test.
    if ((await firstDossier.count()) === 0) test.skip();
    const href = await firstDossier.getAttribute("href");
    await firstDossier.click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, "\\/")));
  });
});
