import { expect, test } from '@playwright/test'
import { requireAdminCredentials } from '../helpers/auth'

const importId = process.env.E2E_BAREMES_IMPORT_ID

test('admin examine la comparaison et confirme son blocage avant publication sur desktop et mobile', async ({ page, request }) => {
  test.setTimeout(180_000)
  const credentials = requireAdminCredentials(test)
  test.skip(!importId, 'E2E_BAREMES_IMPORT_ID doit viser la fixture synthétique locale.')

  const desktopScreenshot = process.env.BAREMES_E2E_DESKTOP_SCREENSHOT
  const mobileScreenshot = process.env.BAREMES_E2E_MOBILE_SCREENSHOT
  if (!desktopScreenshot || !mobileScreenshot) throw new Error('Chemins de capture desktop et mobile requis pour la recette locale.')

  const login = await request.post('/api/auth/sign-in/email', { data: credentials })
  if (!login.ok()) throw new Error(`Authentification locale refusée (${login.status()}).`)
  const apiState = await request.storageState()
  await page.context().addCookies(apiState.cookies)
  await page.goto(`/admin/baremes/import/${importId}`, { waitUntil: 'domcontentloaded', timeout: 150_000 })
  await expect(page.getByRole('heading', { name: 'Mise à jour des barèmes' })).toBeVisible()
  await expect(page.getByText('browser-baremes-review-B-candidate-synthetique.xlsx').first()).toBeVisible()
  await page.screenshot({ path: desktopScreenshot, fullPage: true })

  const search = page.getByRole('textbox', { name: 'Rechercher par code, article, libellé ou clé…' })
  await search.fill('CODE-010')
  const row = page.getByRole('row').filter({ hasText: 'CODE-010' })
  await expect(row).toBeVisible()
  await row.locator('button').first().click()
  await expect(page.getByRole('heading', { name: 'Détail du montant' })).toBeVisible()
  await page.getByRole('button', { name: 'Marquer la revue examinée' }).click()
  await expect(page.getByText(/variations importantes doivent être confirmées/i)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ouvrir les confirmations' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publier les changements' })).toBeDisabled()

  await page.getByRole('link', { name: 'Ouvrir les confirmations' }).click()
  await expect(page.getByLabel('Justification de la confirmation').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publier les changements' })).toBeDisabled()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: 'Mise à jour des barèmes' })).toBeVisible()
  await page.screenshot({ path: mobileScreenshot, fullPage: true })
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(documentWidth).toBeLessThanOrEqual(390)
})
