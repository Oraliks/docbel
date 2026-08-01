import type { BrowserContext, Page } from "@playwright/test";

/// Met le navigateur dans l'état « visiteur de retour », seule façon d'obtenir
/// des interactions fiables : en contexte NEUF, deux surcouches d'onboarding
/// s'ouvrent et avalent les clics.
///
///   • la modale « Choisissez votre langue » (WelcomeLocaleModal) est MODALE
///     (fond `inert`) et s'ouvre dans un `useEffect` — course qui rend `fill`
///     et `click` intermittents. On seed son drapeau localStorage ;
///   • la bannière cookies (lue serveur ET client) recouvre le bas de page,
///     donc les boutons d'un formulaire long. On pose une décision de
///     consentement pour qu'elle ne s'affiche pas.
///
/// À appeler dans un `beforeEach`, AVANT le premier `page.goto`.
export async function seedVisiteurDeRetour(
  page: Page,
  context: BrowserContext,
  baseURL: string | undefined,
): Promise<void> {
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
    } catch {
      /* stockage indisponible (mode privé) : la modale s'ouvrira, tant pis */
    }
  });
}
