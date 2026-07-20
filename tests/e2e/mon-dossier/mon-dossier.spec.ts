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
  test.beforeEach(async ({ page, context, baseURL }) => {
    // État « visiteur de retour » : on neutralise les surcouches d'onboarding
    // qui apparaissent en contexte navigateur NEUF et bloquent par
    // intermittence les interactions (fill/click). Deux gardes :
    //  - la modale « Choisissez votre langue » (WelcomeLocaleModal) est MODALE
    //    (fond `inert`) et s'ouvre dans un useEffect → course qui rend fill/
    //    click flaky ; on seed son drapeau localStorage pour qu'elle ne s'ouvre
    //    pas (clé `beldoc.locale.chosen`) ;
    //  - la bannière cookies (lue serveur + client) chevauche le bas de page ;
    //    on pose une décision de consentement (cookie `docbel-consent`, v1)
    //    pour qu'elle ne s'affiche pas.
    await context.addCookies([
      {
        name: "docbel-consent",
        value: encodeURIComponent(
          JSON.stringify({ v: 1, analytics: false, ts: "1970-01-01T00:00:00.000Z" }),
        ),
        url: baseURL ?? "http://localhost:3000",
      },
    ]);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("beldoc.locale.chosen", "fr");
      } catch {}
    });
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
    // isSearching → la vue par défaut (catalogue « Parcourir tous les dossiers »)
    // laisse place aux groupes de résultats fusionnés Situations/Dossiers.
    // En dev, l'hydratation React peut arriver APRÈS le premier fill (le onChange
    // n'est pas encore attaché → la saisie ne bascule pas la vue). On ré-essaie
    // donc la saisie jusqu'à ce que le guichet réagisse (course d'hydratation).
    const searchbox = page.getByRole("searchbox");
    const catalogue = page.getByRole("heading", {
      name: /Parcourir tous les dossiers/i,
    });
    await expect(async () => {
      // `fill` pose la valeur en direct : le value-tracker de React peut juger
      // « rien n'a changé » et avaler l'event (onChange non déclenché → la vue ne
      // bascule pas). On tape au clavier après avoir vidé → frappes réelles =
      // onChange fiable. Le retry couvre en plus la course d'hydratation dev.
      await searchbox.fill("");
      await searchbox.pressSequentially("emploi");
      await expect(catalogue).toBeHidden({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
  });

  test("recherche sans résultat → secours IA", async ({ page }) => {
    // Même course d'hydratation dev que ci-dessus → saisie ré-essayée.
    const searchbox = page.getByRole("searchbox");
    const fallback = page.getByText(/Décrivez votre situation avec vos mots/i);
    await expect(async () => {
      // Frappes réelles (cf. test ci-dessus) : évite que le value-tracker React
      // n'avale l'event de `fill`. Le retry couvre la course d'hydratation dev.
      await searchbox.fill("");
      await searchbox.pressSequentially("zzzznexistepasxyz");
      await expect(fallback).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
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
    // Le catalogue utilise un <Link> Next (soft-nav) : l'App Router ne valide
    // l'URL qu'APRÈS avoir récupéré le RSC de /d/[slug]. En dev (compile à la
    // demande, ~20-25 s à froid) sur la Neon partagée, ça dépasse les 10 s par
    // défaut d'un expect → délai généreux, aligné sur la philosophie du config
    // (« Neon partagée qui peut cold-starter »).
    await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, "\\/")), {
      timeout: 30_000,
    });
  });
});
