import { expect, test } from '@playwright/test'
import { loginAsAdmin, requireAdminCredentials } from '../helpers/auth'

const importId = process.env.E2E_BAREMES_IMPORT_ID

test('admin examine la comparaison et voit la publication bloquée avant confirmation', async ({ page, request }) => {
  const credentials = requireAdminCredentials(test)
  test.skip(!importId, 'E2E_BAREMES_IMPORT_ID doit viser la fixture synthétique locale.')

  await loginAsAdmin(page, request, credentials)
  await page.goto(`/admin/baremes/import/${importId}`)
  await expect(page.getByRole('heading', { name: 'Mise à jour des barèmes' })).toBeVisible()
  await expect(page.getByText('B-candidate-synthetique.xlsx')).toBeVisible()

  const search = page.getByRole('textbox', { name: 'Rechercher par code, article, libellé ou clé…' })
  await search.fill('fixture:010')
  const row = page.getByRole('row').filter({ hasText: 'fixture:010' })
  await expect(row).toBeVisible()
  await row.locator('button').first().click()
  await expect(page.getByRole('heading', { name: 'Détail du montant' })).toBeVisible()
  await page.getByRole('button', { name: 'Marquer la revue examinée' }).click()
  await expect(page.getByText(/variations importantes doivent être confirmées/i)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ouvrir les confirmations' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publier les changements' })).toBeDisabled()
})
