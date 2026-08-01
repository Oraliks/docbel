import { test, expect, type Page } from "@playwright/test";
import { readFileSync, statSync } from "node:fs";
import { seedVisiteurDeRetour } from "../helpers/visiteur";

// Premier E2E du Form Runner (2 400 lignes, aucun test d'interaction jusqu'ici).
// Le C47 sert de cobaye : c'est le plus court des huit documents (2 étapes hors
// dossier) tout en portant l'essentiel de la mécanique — champ composite
// prénom/nom, NISS auto-formaté, question conditionnant un autre champ
// (`visibleIf`), signature apposée automatiquement, consentement RGPD, et la
// génération elle-même.
//
// Nécessite le dev server (`pnpm dev`) + la DB. Lancer :
//   pnpm test:e2e tests/e2e/pdf-forms
// Volontairement HORS CI : dépend d'un serveur lancé à la main et de la Neon
// partagée.
//
// Sélecteurs : chaque champ porte `id` = son id dans le schéma du seed
// (`#niss`, `#rue`, `#cadreDemande`…). C'est l'ancrage le plus stable — un
// `getByLabel` serait doublement fragile, puisque la CHROME de la page suit la
// langue du navigateur alors que les libellés de champs viennent de la base, et
// que les champs d'adresse n'ont aujourd'hui aucun nom accessible.

const C47_URL = "/document/onem/c47";
/// Le runner poste sur /api/pdf/<slug>/generate — `c47` est le slug interne.
const GENERATE_URL = /\/api\/pdf\/c47\/generate/;

/// NISS valide (checksum correct) déjà utilisé par les tests unitaires.
/// Le champ le reformate tout seul en « 850730-033.28 ».
const NISS = "85073003328";

/// Les libellés d'options sont recopiés du formulaire officiel : leur référence
/// d'article est le repère le plus stable qu'ils offrent.
const CADRE_AVEC_DATE = /art\. 114/;
const CADRE_SANS_DATE = /art\. 58/;

/// Étape 1 — identité + adresse. Frappes réelles (`pressSequentially`) et non
/// `fill` : le value-tracker de React peut juger « rien n'a changé » et avaler
/// l'événement, laissant le champ vide pour le formulaire.
async function remplirIdentite(page: Page) {
  await page.locator("#pr_nom_et_nom").pressSequentially("Marie");
  await page.locator("#pr_nom_et_nom-last").pressSequentially("Dupont");
  await page.locator("#niss").pressSequentially(NISS);
  await page.locator("#rue").pressSequentially("Rue de la Loi");
  await page.locator("#numero").pressSequentially("16");
  await page.locator("#codePostal").pressSequentially("1000");
  // La commune peut se déduire du code postal ; on ne la saisit que si le
  // formulaire ne l'a pas fait, pour ne pas écraser une valeur dérivée.
  const commune = page.locator("#commune");
  if ((await commune.inputValue()) === "") {
    await commune.pressSequentially("Bruxelles");
  }
  // Le NISS formaté prouve que le champ a reçu de vraies frappes et que le
  // masque a tourné — vérifié ici plutôt que de le déduire d'un échec plus loin.
  await expect(page.locator("#niss")).toHaveValue("850730-033.28");
}

/// Passe à l'étape 2. Le libellé du bouton suit la langue de l'INTERFACE (la
/// chrome est traduite, les champs viennent de la base) : on couvre les trois
/// langues du site.
async function allerEtape2(page: Page) {
  await page.getByRole("button", { name: /Continuer|Fortfahren|Continue/i }).click();
  await expect(page.locator("#cadreDemande")).toBeVisible();
}

/// Choisit un cadre de demande. C'est un Select base-ui, pas un `<select>`
/// natif : on ouvre puis on clique l'option.
async function choisirCadre(page: Page, libelle: RegExp) {
  await page.locator("#cadreDemande").click();
  await page.getByRole("option", { name: libelle }).click();
}

test.describe("C47 — parcours citoyen complet jusqu'au PDF", () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await seedVisiteurDeRetour(page, context, baseURL);
    await page.goto(C47_URL);
    // Le titre vient de la base : présent quelle que soit la langue d'interface.
    await expect(page.getByRole("heading", { name: /C47/, level: 1 })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("remplit les deux étapes, signe, et reçoit un vrai PDF", async ({ page }) => {
    await remplirIdentite(page);
    await allerEtape2(page);
    // Cadre sans date : le parcours le plus court jusqu'au document. La branche
    // qui réclame une date est couverte par le test de `visibleIf` ci-dessous.
    await choisirCadre(page, CADRE_SANS_DATE);

    // Consentement RGPD : sans lui, le serveur refuse en 400.
    await page.getByRole("checkbox").check();

    // On attend la réponse ET le téléchargement. La réponse atteste du contrat
    // HTTP ; le fichier atteste de ce que le citoyen obtient VRAIMENT. Le corps
    // de la réponse, lui, n'est pas lisible ici : Playwright ne le bufferise
    // pas quand il part en téléchargement (`body()` renvoie du vide).
    const [reponse, telechargement] = await Promise.all([
      page.waitForResponse(
        (r) => GENERATE_URL.test(r.url()) && r.request().method() === "POST",
        { timeout: 60_000 },
      ),
      page.waitForEvent("download", { timeout: 60_000 }),
      page
        .getByRole("button", { name: /Signer et générer|unterschreiben|Sign and generate/i })
        .click(),
    ]);

    expect(reponse.status()).toBe(200);
    expect(reponse.headers()["content-type"]).toContain("application/pdf");
    // Le nom du fichier est calculé par le SERVEUR (slug + date du jour) et non
    // par le client — c'est ce que corrige le lot S4. On le vérifie tel que le
    // navigateur l'a retenu, donc de bout en bout.
    expect(telechargement.suggestedFilename()).toMatch(/^c47-\d{4}-\d{2}-\d{2}\.pdf$/);

    const chemin = await telechargement.path();
    expect(chemin, "aucun fichier écrit sur le disque").toBeTruthy();
    // Un PDF ONEM rempli pèse ~150 ko ; sous 10 ko, c'est un corps d'erreur ou
    // un document vide qu'on aurait servi au citoyen.
    expect(statSync(chemin!).size).toBeGreaterThan(10_000);
    // Signature d'un vrai PDF, pas un JSON d'erreur maquillé en pièce jointe.
    expect(readFileSync(chemin!).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  test("la date d'inaptitude n'est demandée que sur la branche art. 114", async ({ page }) => {
    // `visibleIf` : le papier n'imprime de date que dans le PREMIER cadre. La
    // réclamer sur l'autre branche rendrait le formulaire impossible à finir.
    await remplirIdentite(page);
    await allerEtape2(page);

    const dateDA = page.locator("#dateDA");
    await expect(dateDA).toBeHidden();

    await choisirCadre(page, CADRE_AVEC_DATE);
    await expect(dateDA).toBeVisible();

    // Et elle disparaît si l'on change d'avis — la condition est réévaluée dans
    // les deux sens, elle ne fait pas qu'ajouter des champs.
    await choisirCadre(page, CADRE_SANS_DATE);
    await expect(dateDA).toBeHidden();
  });

  test("répondre ne fait pas remonter la page en haut", async ({ page }) => {
    // Régression signalée quatre fois par Oraliks : en répondant à une question
    // basse, le document raccourcit, le scroll est écrêté, et l'usager se
    // retrouve projeté en haut de page — il perd le fil de sa saisie.
    await remplirIdentite(page);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const avant = await page.evaluate(() => window.scrollY);
    // Le test n'a de sens que si la page défile vraiment à cette taille de
    // viewport : sans cela, il passerait au vert sans rien prouver.
    expect(avant, "la page doit défiler pour que la garde ait un sens").toBeGreaterThan(0);

    await page.locator("#commune").fill("");
    await page.locator("#commune").pressSequentially("Bruxelles");
    await page.waitForTimeout(500);

    const apres = await page.evaluate(() => window.scrollY);
    expect(apres, "la page a sauté en haut après une réponse").toBeGreaterThan(0);
  });
});
