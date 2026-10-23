/** Real isolated app only; viewport/text zoom are emulations, not physical-device tests. */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { seedVisiteurDeRetour } from "./helpers/visiteur";

const BASE = "http://localhost:3107";
test.use({ channel: "msedge", video: "off", trace: "retain-on-failure", actionTimeout: 15_000 });
test.describe.configure({ timeout: 120_000 });
test.skip(process.env.PLAYWRIGHT_BASE_URL !== BASE, "Only the disposable fixture app at http://localhost:3107 is permitted.");

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
async function centerClear(target: Locator) {
  await expect(target).toBeVisible();
  await expect.poll(() => target.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit === node || (hit !== null && node.contains(hit));
  })).toBe(true);
}
async function returning(page: Page, context: Parameters<typeof seedVisiteurDeRetour>[1], baseURL: string | undefined) {
  await seedVisiteurDeRetour(page, context, baseURL);
}
async function ready(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
}
async function renderedContrast(target: Locator) {
  return target.evaluate((node) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const rgba = (color: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    };
    const foreground = rgba(getComputedStyle(node).color);
    let background: number[] | null = null;
    for (let parent: Element | null = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const color = rgba(style.backgroundColor);
      if (color[3] === 255) {
        if (style.backgroundImage !== "none") throw new Error("Measure a flat rendered surface, not an assumed gradient color.");
        background = color;
        break;
      }
      if (color[3] !== 0) throw new Error("Translucent surface requires explicit compositing.");
    }
    if (!background || foreground[3] !== 255) throw new Error("No opaque rendered text/background pair.");
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const a = luminance(foreground);
    const b = luminance(background);
    return { foreground, background, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
  });
}

test.beforeEach(async ({ context, baseURL }) => {
  expect(baseURL).toBe(BASE);
  await context.addCookies([{ name: "BELDOC_LOCALE", value: "fr", url: BASE }]);
});

test("première visite : langue, cookies et navigation/action restent accessibles", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, "/");
  const language = page.locator('[data-slot="dialog-content"]');
  await expect(language).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("first-visit-overlays.png"), fullPage: true });
  const continueButton = language.getByRole("button", { name: "Continuer", exact: true });
  await centerClear(continueButton);
  await continueButton.click();
  await expect(language).toBeHidden();
  const cookies = page.getByRole("dialog", { name: "Votre vie privée, votre choix", exact: true });
  await expect(cookies).toBeVisible();
  await centerClear(page.locator(".docbel-bottom-nav").getByRole("link", { name: "Aide", exact: true }));
  await centerClear(cookies.getByRole("button", { name: "Tout refuser", exact: true }));
  await cookies.getByRole("button", { name: "Tout refuser", exact: true }).click();
  await expect(cookies).toBeHidden();
  await centerClear(page.locator(".docbel-bottom-nav").getByRole("link", { name: "Aide", exact: true }));
  const start = page.getByRole("link", { name: "Trouver ma démarche", exact: true });
  await start.scrollIntoViewIfNeeded();
  await centerClear(start);
  await noOverflow(page);
});

test("aide réelle et panneau Aa au clavier : focus contenu puis restitué", async ({ page, context, baseURL }, testInfo) => {
  await returning(page, context, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, "/aide");
  await expect(page.getByRole("main").getByRole("link", { name: /Comprendre les mots/ })).toHaveAttribute("href", "/glossaire");
  await expect(page.locator("#affichage")).toBeVisible();
  const trigger = page.locator("[data-docbel-display-trigger]");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator(".docbel-display-panel");
  await expect(dialog).toBeVisible();
  await centerClear(dialog.getByRole("button", { name: "Terminé", exact: true }));
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("help-display-keyboard.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await noOverflow(page);
});

test("émulation texte 200% et reflow 400% à 320 CSS px sans débordement", async ({ page, context, baseURL }, testInfo) => {
  await returning(page, context, baseURL);
  await page.setViewportSize({ width: 320, height: 900 });
  await ready(page, "/aide");
  const normalSize = await page.locator("html").evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  await page.locator("html").evaluate((node, size) => { (node as HTMLElement).style.fontSize = `${size * 2}px`; }, normalSize);
  expect(await page.locator("html").evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBe(normalSize * 2);
  await noOverflow(page);
  await page.locator("[data-docbel-display-trigger]").click();
  const dialog = page.locator(".docbel-display-panel");
  await expect(dialog).toBeVisible();
  for (const button of await dialog.locator("section button").all()) {
    expect(await button.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: testInfo.outputPath("reflow-320-text-200-top.png") });
  await noOverflow(page);
  await dialog.getByRole("button", { name: "Terminé", exact: true }).scrollIntoViewIfNeeded();
  await centerClear(dialog.getByRole("button", { name: "Terminé", exact: true }));
  await page.screenshot({ path: testInfo.outputPath("reflow-320-text-200.png") });
});

test("sombre + contraste renforcé : paires réellement rendues atteignent 4,5:1", async ({ page, context, baseURL }, testInfo) => {
  await returning(page, context, baseURL);
  await ready(page, "/aide");
  await page.locator("[data-docbel-display-trigger]").click();
  const dialog = page.locator(".docbel-display-panel");
  await dialog.getByRole("button", { name: "Contraste renforcé", exact: true }).click();
  await dialog.getByRole("button", { name: "Changer le thème", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveAttribute("data-docbel-contrast", "high");
  const pairs = [];
  for (const locator of [dialog.locator('[data-slot="dialog-description"]'), dialog.getByRole("button", { name: "Terminé", exact: true })]) {
    const pair = await renderedContrast(locator);
    expect(pair.ratio).toBeGreaterThanOrEqual(4.5);
    pairs.push(pair);
  }
  await dialog.getByRole("button", { name: "Terminé", exact: true }).click();
  const bodyPair = await renderedContrast(page.locator("#affichage > h2"));
  expect(bodyPair.ratio).toBeGreaterThanOrEqual(4.5);
  const contrastFile = testInfo.outputPath("rendered-contrast.json");
  await writeFile(contrastFile, JSON.stringify([...pairs, bodyPair], null, 2));
  await testInfo.attach("rendered-contrast.json", { path: contrastFile, contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath("dark-high-contrast.png"), fullPage: true });
});

test("connexion hors shell public et garde admin anonyme conservée", async ({ page, context, baseURL }) => {
  await returning(page, context, baseURL);
  await ready(page, "/login");
  await expect(page.locator(".glass-root")).toHaveCount(0);
  await expect(page.locator(".docbel-public-header")).toHaveCount(0);
});

test("gardes anonymes admin et partenaire existantes restent actives", async ({ page, context, baseURL }) => {
  await returning(page, context, baseURL);
  const admin = await page.goto("/admin");
  expect(admin?.status()).toBe(404); // Existing guard intentionally conceals the private route.
  await expect(page.locator(".glass-root")).toHaveCount(0);
  await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0);
  await page.goto("/partenaire");
  await expect(page).toHaveURL(`${BASE}/p/partenaire`); // Existing anonymous redirect; no private pro session fabricated.
});

test("lecture vocale indisponible : message progressif et aucun faux état actif", async ({ page, context, baseURL }) => {
  await returning(page, context, baseURL);
  await page.addInitScript(() => { Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined }); });
  await ready(page, "/");
  const listen = page.getByRole("button", { name: "Écouter", exact: true });
  await listen.click();
  await expect(page.getByRole("status").filter({ hasText: "La lecture vocale n’est pas disponible" })).toBeVisible();
  await expect(listen).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Arrêter la lecture", exact: true })).toHaveCount(0);
});
