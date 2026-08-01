import { test, expect } from "@playwright/test";
import { seedVisiteurDeRetour } from "../helpers/visiteur";

// E2E /mon-dossier — l'ASSISTANT en 4 étapes (refonte du front public, été 2026).
//
// Réécrit le 2026-08-01. La version précédente testait un « guichet à recherche
// universelle » : une barre de recherche unique, une bascule vers un mode
// résultats, un secours IA. Cette page-là n'existe plus — la refonte l'a
// remplacée par un assistant pas-à-pas. Ces trois tests ne pouvaient donc pas
// être « réparés » : ils décrivaient une fonctionnalité retirée, et ils
// n'avaient jamais tourné (le cahier portait l'aveu « non rejoués »).
//
// Ce qu'on couvre désormais, c'est ce que la page promet aujourd'hui : trouver
// sa démarche, soit guidé par l'assistant, soit en direct, soit en reprenant un
// dossier commencé.
//
// Nécessite le dev server (pnpm dev) + DB. Lancer :
//   pnpm test:e2e tests/e2e/mon-dossier
// Hors CI : dépend d'un serveur lancé à la main et de la Neon partagée.
//
// Sélecteurs volontairement insensibles à la langue (`href`, rôles, comptes
// d'éléments) : la chrome du site suit la langue du navigateur, et c'est
// précisément un libellé traduit qui avait figé la version précédente.

/// Une carte de situation de l'assistant : un bouton porteur d'une vraie
/// phrase (au moins dix caractères), par opposition aux boutons d'icône du
/// gabarit — thème, notifications, accessibilité.
function cartesSituation(page: import("@playwright/test").Page) {
  return page.locator("main button").filter({ hasText: /.{10,}/ });
}

test.describe("/mon-dossier — assistant de choix de démarche", () => {
  // Au-dessus des 60 s du config : sur un dev server qui vient d'être lancé, le
  // PREMIER passage compile la route à la demande (~1 min ici, Neon partagée
  // comprise) et fait dépasser le premier test — les suivants tournent en une
  // dizaine de secondes. C'est un coût d'environnement, pas une lenteur de la
  // page ; le masquer par un retry rendrait la suite trompeuse.
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async ({ page, context, baseURL }) => {
    // État « visiteur de retour » : neutralise les surcouches d'onboarding qui
    // avalent les clics en contexte navigateur neuf (helper partagé avec l'E2E
    // du Form Runner).
    await seedVisiteurDeRetour(page, context, baseURL);
    await page.goto("/mon-dossier");
    // Le titre suit la langue : on se contente d'exiger qu'il y en ait un.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("l'assistant s'ouvre sur un choix de situations", async ({ page }) => {
    // L'étape 1 propose une douzaine de situations de vie (chômage temporaire,
    // fin d'études, réforme 2026…). Peu importe lesquelles : ce qui compte est
    // qu'on entre par un CHOIX, et non par un formulaire ou une recherche.
    const cartes = cartesSituation(page);
    await expect(cartes.first()).toBeVisible();
    expect(await cartes.count()).toBeGreaterThan(5);
  });

  test("choisir une situation avance à l'étape suivante, et l'on peut revenir", async ({
    page,
  }) => {
    const cartes = cartesSituation(page);
    const avant = await cartes.count();

    await cartes.first().click();

    // L'assistant a changé d'étape : les situations laissent place à d'autres
    // questions, et un retour apparaît. On vérifie la TRANSITION, pas le
    // contenu de l'étape 2 (qui dépend de la situation choisie).
    const retour = page.getByRole("button", { name: /Précédent|Retour|Zurück|Back/i });
    await expect(retour).toBeVisible({ timeout: 15_000 });
    expect(await cartes.count()).toBeLessThan(avant);

    // Et le retour ramène bien au choix de situations : l'assistant n'est pas
    // un entonnoir dont on ne sort plus.
    await retour.click();
    await expect
      .poll(async () => cartes.count(), { timeout: 15_000 })
      .toBe(avant);
  });

  test("un dossier de l'accès direct mène à sa page /d/[slug]", async ({ page }) => {
    const premier = page.locator('a[href^="/d/"]').first();
    // Aucun bundle publié dans cet environnement → rien à ouvrir, on passe.
    if ((await premier.count()) === 0) test.skip();
    const href = await premier.getAttribute("href");

    await premier.click();
    // <Link> Next : l'App Router ne valide l'URL qu'APRÈS avoir récupéré le RSC
    // de /d/[slug]. En dev (compilation à la demande) sur la Neon partagée, ça
    // dépasse largement les 10 s par défaut d'un expect.
    await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, "\\/")), {
      timeout: 30_000,
    });
  });

  test("le bloc de reprise mène au formulaire de code", async ({ page }) => {
    // Un dossier commencé se reprend avec un code BELDOC-XXXX-XXXX : c'est la
    // troisième porte d'entrée de la page, à côté de l'assistant et de l'accès
    // direct.
    const reprise = page.locator('[href="/reprendre"]').first();
    await expect(reprise).toBeVisible();
    await reprise.click();
    await expect(page).toHaveURL(/\/reprendre/, { timeout: 30_000 });
  });
});
