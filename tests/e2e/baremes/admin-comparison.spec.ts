import { expect, test } from '@playwright/test'
import { loginAsAdmin, requireAdminCredentials } from '../helpers/auth'

const importId = process.env.E2E_BAREMES_IMPORT_ID

test('admin inspecte une comparaison synthétique et voit la publication bloquée avant confirmation', async ({ page, request }) => {
  const credentials = requireAdminCredentials(test)
  test.skip(!importId, 'E2E_BAREMES_IMPORT_ID doit viser la fixture synthétique locale.')

  await loginAsAdmin(page, request, credentials)
  await page.goto(`/admin/baremes/import/${importId}`)
  await expect(page.getByRole('heading', { name: /B-candidate-synthetique\.xlsx/ })).toBeVisible()

  await page.getByRole('tab', { name: 'Diagnostic' }).click()
  await expect(page.getByText('Feuille hors périmètre')).toBeVisible()

  await page.getByRole('tab', { name: 'Changements' }).click()
  const search = page.getByRole('textbox', { name: 'Rechercher par code, article, libellé ou clé…' })
  await search.fill('fixture:010')
  await expect(page.getByText('fixture:010', { exact: true })).toBeVisible()
  await expect(page.getByRole('row', { name: /fixture:010.*60%/ })).toBeVisible()
  await page.getByRole('button', { name: 'Marquer la revue examinée' }).click()

  await page.getByRole('tab', { name: 'Erreurs & warnings' }).click()
  await expect(page.getByText(/56 éléments/)).toBeVisible()
  await expect(page.getByText(/9 éléments/)).toBeVisible()
  await expect(page.getByLabel('Justification de la confirmation').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publier' })).toBeDisabled()
})
