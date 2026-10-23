/** Real browser + real local API; requires seed-design-fixture.ts and the isolated app on :3107. */
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { extractText } from "unpdf";
import { seedVisiteurDeRetour } from "./helpers/visiteur";

const BASE = process.env.PLAYWRIGHT_BASE_URL === "http://localhost:3107" ? "http://localhost:3107" : "http://127.0.0.1:3107";
const DOCUMENT = "/document/design-recipe";
const GENERATE = "/api/pdf/design-recipe/generate";
const recipeEnabled = process.env.PLAYWRIGHT_BASE_URL === BASE;
test.use({ channel: process.env.DESIGN_RECIPE_BROWSER_CHANNEL, video: "off", trace: "retain-on-failure", actionTimeout: 20_000 });

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
async function selectOther(page: Page) {
  const radio = page.getByRole("radio", { name: "Autre couleur de test", exact: true });
  await radio.focus();
  await page.keyboard.press("Space");
  await expect(radio).toBeChecked();
}
async function switchUiLocale(page: Page, localeName: string) {
  await page.getByRole("banner").getByRole("button", { name: /^Choisir la langue :/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: localeName, exact: true }).click();
  await dialog.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test.describe("design public — fixture strictement isolée", () => {
  test.skip(!recipeEnabled, "Only the disposable design recipe server at localhost:3107 or 127.0.0.1:3107 is allowed.");
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async ({ page, context, baseURL }) => {
    expect(baseURL).toBe(BASE);
    await seedVisiteurDeRetour(page, context, baseURL);
    await context.addCookies([{ name: "BELDOC_LOCALE", value: "fr", url: BASE }]);
  });

  for (const [width, height] of [[320, 800], [390, 844], [768, 1024], [1440, 1000]] as const) {
    test(`accueil et navigation réels à ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Vos démarches,");
      await expect(page.getByRole("heading", { level: 1 }).locator("em")).toHaveText("un pas à la fois.");
      if (width === 390) {
        await expect(page.getByRole("heading", { name: "Fonctionnalités temporairement en pause", exact: true })).toBeVisible();
        await expect(page.getByText("La création et l’enregistrement de nouveaux dossiers sont temporairement suspendus. Les informations et les outils autonomes restent consultables.", { exact: true })).toBeVisible();
      }
      await expect(page.getByRole("link", { name: "Trouver ma démarche", exact: true })).toHaveAttribute("href", "/mon-dossier");
      await expect(page.getByRole("link", { name: /RECETTE — outil actif/ }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /RECETTE — outil désactivé|RECETTE — outil privé/ })).toHaveCount(0);
      await noHorizontalOverflow(page);
      const navigation = page.locator(width < 768 ? ".docbel-bottom-nav" : ".docbel-public-nav");
      await expect(navigation).toBeVisible();
      await expect(navigation.getByRole("link")).toHaveCount(4);
      await expect(navigation.getByRole("link", { name: "Accueil", exact: true })).toHaveAttribute("aria-current", "page");
      await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
      await navigation.getByRole("link", { name: "Outils", exact: true }).click();
      await expect(page).toHaveURL(/\/outils$/, { timeout: 30_000 });
      await expect(navigation.getByRole("link", { name: "Outils", exact: true })).toHaveAttribute("aria-current", "page");
      await noHorizontalOverflow(page);
    });
  }

  test("vraie ancienne démarche : consultation seule et état issu du serveur", async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await context.addCookies([{ name: "beldoc-bundle-session", value: "design-recipe-session", url: BASE }]);
    await page.goto("/");
      await page.waitForLoadState("networkidle");
    const consult = page.getByRole("link", { name: "Consulter ma démarche", exact: true });
    await expect(consult.first()).toHaveAttribute("href", "/d/design-recipe?bundleRun=design-recipe-run");
    await consult.first().click();
    await expect(page.getByText("Ancienne démarche : consultation uniquement", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Démarrer|Enregistrer|Modifier mes réponses/ })).toHaveCount(0);
    const response = await page.request.post("/api/documents/bundles/design-recipe-bundle/run", { data: {} });
    expect(response.status()).toBe(403);
    await page.screenshot({ path: testInfo.outputPath("old-dossier.png"), fullPage: true });
    await page.goto(`${DOCUMENT}?bundleRun=design-recipe-run&bundleSlug=design-recipe`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("fieldset")).toHaveCount(1);
    await expect(page.locator("fieldset")).toHaveJSProperty("disabled", true);
    await expect(page.getByRole("radio", { name: "Violet de test", exact: true })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Violet de test", exact: true })).toBeDisabled();
    await expect(page.locator("#recipe-reference")).toHaveValue("Ancienne recette");
    await expect(page.locator("#recipe-reference")).toBeDisabled();
    await expect(page.locator('button[type="submit"], input[type="submit"]')).toHaveCount(0);
    await expect(page.locator('a[href="/d/design-recipe?bundleRun=design-recipe-run"]').first()).toBeVisible();
    await expect(page.getByText(/Sa modification est temporairement suspendue/)).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("old-form-read-only.png"), fullPage: true });
  });

  test("validation, choix conditionnel, aide mobile et retour conservent les réponses", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(DOCUMENT);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("RECETTE");
    await expect(page.locator(".docbel-bottom-nav")).toHaveCount(0);
    await expect(page.locator("#recipe-detail")).toBeHidden();
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await expect(page.getByText("Choisissez une couleur de test pour continuer.", { exact: true })).toBeVisible();
    await selectOther(page);
    await expect(page.locator("#recipe-detail")).toBeVisible();
    await expect(page.locator("#recipe-reference")).toBeHidden();
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await expect(page.getByText("Indiquez une précision synthétique.", { exact: true })).toBeVisible();
    await page.locator("#recipe-detail").fill("Orange synthétique");
    await page.locator("#recipe-choice").getByRole("radio").first().focus();
    const helpTrigger = page.getByRole("button", { name: "Comprendre cette étape", exact: true });
    await helpTrigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/RECETTE SYNTHÉTIQUE UNIQUEMENT/)).toBeVisible();
    await noHorizontalOverflow(page);
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath("mobile-help.png") });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(helpTrigger).toBeFocused();
    await expect(page.locator("#recipe-detail")).toHaveValue("Orange synthétique");
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await page.locator("#recipe-reference").fill("Recette Alpha");
    await page.getByRole("button", { name: "Précédent", exact: true }).click();
    await expect(page.locator("#recipe-detail")).toHaveValue("Orange synthétique");
    await expect(page.getByRole("radio", { name: "Autre couleur de test", exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await expect(page.locator("#recipe-reference")).toHaveValue("Recette Alpha");
  });

  test("changer la langue après saisie conserve la visite et les réponses", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(DOCUMENT);
    await page.waitForLoadState("networkidle");
    await selectOther(page);
    await page.locator("#recipe-detail").fill("Test multilingue");
    await switchUiLocale(page, "Nederlands");
    await expect(page.locator("html")).toHaveAttribute("lang", "nl");
    await expect(page.locator("#recipe-detail")).toHaveValue("Test multilingue");
    await page.getByRole("button", { name: "NL", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Andere testkleur", exact: true })).toBeChecked();
    await expect(page.locator("#recipe-detail")).toHaveValue("Test multilingue");
  });

  test("Aa : taille, contraste, mouvement réduit et thème sombre utilisent les vrais réglages", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
      await page.waitForLoadState("networkidle");
    await page.locator("[data-docbel-display-trigger]").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Texte normal", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-docbel-text-size", "large");
    await dialog.getByRole("button", { name: "Contraste renforcé", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-docbel-contrast", "high");
    await dialog.getByRole("button", { name: "Réduire les animations", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-docbel-motion", "reduced");
    await dialog.getByRole("button", { name: "Changer le thème", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({ path: testInfo.outputPath("mobile-display-dark.png") });
    await dialog.getByRole("button", { name: "Terminé", exact: true }).click();
    await expect(page.locator("[data-docbel-display-trigger]")).toBeFocused();
    await noHorizontalOverflow(page);
  });

  test("arabe : véritable langue UI et direction RTL sur mobile", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
      await page.waitForLoadState("networkidle");
    await switchUiLocale(page, "العربية");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".docbel-bottom-nav").getByRole("link")).toHaveCount(4);
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("mobile-rtl.png"), fullPage: true });
  });

  test("résumé puis génération par le vrai endpoint : téléchargement PDF valide", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(DOCUMENT);
    await page.waitForLoadState("networkidle");
    // A visible locale transition proves that the real form is interactive.
    // Network idle alone can precede hydration on a cold dev compilation.
    await page.getByRole("button", { name: "NL", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Andere testkleur", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Autre couleur de test", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("01-question.png"), fullPage: true });
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await expect(page.getByText("Choisissez une couleur de test pour continuer.", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("02-validation-error.png"), fullPage: true });
    await selectOther(page);
    await page.locator("#recipe-detail").fill("Orange synthétique");
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await page.locator("#recipe-reference").fill("Recette génération");
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await expect(page.getByText("Orange synthétique", { exact: true })).toBeVisible();
    await expect(page.getByText("Recette génération", { exact: true })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("03-review.png"), fullPage: true });
    await page.getByRole("checkbox").check();
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    // Avoid a secondary unhandled rejection if the HTTP assertion fails first.
    void downloadPromise.catch(() => undefined);
    const [response] = await Promise.all([
      page.waitForResponse((result) => new URL(result.url()).pathname === GENERATE && result.request().method() === "POST"),
      page.getByRole("button", { name: "Générer le document", exact: true }).click(),
    ]);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^design-recipe-\d{4}-\d{2}-\d{2}\.pdf$/);
    const path = testInfo.outputPath("design-recipe-filled.pdf");
    await download.saveAs(path);
    const bytes = await readFile(path);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const filledPdf = await PDFDocument.load(bytes);
    expect(filledPdf.getPageCount()).toBe(1);
    expect(filledPdf.getForm().getFields()).toHaveLength(0);
    const extracted = await extractText(new Uint8Array(bytes), { mergePages: true });
    expect(extracted.text).toContain("Orange synthétique");
    expect(extracted.text).toContain("Recette génération");
    const source = await readFile("private/uploads/design-recipe.pdf");
    expect(Buffer.compare(bytes, source)).not.toBe(0);
    await expect(page.getByRole("button", { name: "Générer un autre document", exact: true })).toBeVisible();
    await expect(page.locator("[data-docbel-scroll-floor]")).toHaveCount(1);
    await expect.poll(() => page.locator("[data-docbel-scroll-floor]").evaluate((node) => (node as HTMLElement).offsetHeight)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("04-result.png"), fullPage: true });
  });
});
