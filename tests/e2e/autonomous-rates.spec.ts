import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import * as XLSX from 'xlsx'

const original = process.env.DOCBEL_REFERENCE_XLSX
test.skip(!process.env.AUTONOMOUS_RATES_E2E || !original, 'Requires an explicitly isolated local rates database')
test('real workbook import, persistent comparison, publication and responsive sources', async ({ page, request, baseURL }) => {
  test.setTimeout(240000)
  if (baseURL !== 'http://localhost:3010') throw new Error('LOCAL_ISOLATED_PREVIEW_REQUIRED')
  await expect.poll(async () => { try { return (await request.get('/api/admin/baremes-autonome/versions')).status() } catch { return 0 } }, { timeout: 60000 }).toBe(401)
  const credentials = JSON.parse(fs.readFileSync('private/backups/autonomous-rates-test/credentials.json', 'utf8'))
  const auth = await request.post('/api/auth/sign-in/email', { data: { email: credentials.email, password: credentials.password }, headers: { Origin: baseURL } })
  expect(auth.ok()).toBe(true)
  await page.context().addCookies((await request.storageState()).cookies)
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/admin/baremes-autonome')
  await expect(page.getByRole('heading', { name: 'Barèmes — nouveau' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Barèmes — nouveau', exact: true })).toHaveAttribute('aria-busy', 'false', { timeout: 60000 })
  const importResponse = page.waitForResponse(r => r.url().endsWith('/api/admin/baremes-autonome/versions') && r.request().method() === 'POST')
  await page.locator('input[type=file]').setInputFiles(original!)
  const imported = await importResponse
  expect(imported.ok()).toBe(true)
  const importedId = (await imported.json()).id
  expect(importedId).toBeTruthy()
  await expect.poll(() => new URL(page.url()).searchParams.get('version')).toBe(importedId)
  await expect(page.getByRole('combobox', { name: 'Historique des imports' }).locator('option:checked')).toContainText('barema20260901-new.xlsx', { timeout: 60000 })
  await expect(page.getByRole('button', { name: 'Publier dans le nouvel outil', exact: true })).toBeEnabled({ timeout: 60000 })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Publier dans le nouvel outil', exact: true })).toBeEnabled({ timeout: 30000 })
  const sheetSelect = page.getByRole('combobox', { name: 'Feuille source', exact: true })
  const expectedSheets = ['A_N_B_vol_plein', 'A_N_B_half_demi', 'TW-CT_JS', 'SpecCat', 'Loonschijven_Tranches salariale', 'Uurlonen_Salaires horaires', 'W ', 'AndereBedrWLH_AutresMontCHOM', 'Activering_Activation', 'AndereUitk_AutresAlloc', 'Bonus', 'Basisbedragen']
  await expect(sheetSelect.locator('option')).toHaveCount(13)
  expect(await sheetSelect.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(expect.arrayContaining(['', ...expectedSheets]))
  let globalCounts: unknown
  await page.setViewportSize({ width: 1536, height: 1100 })
  for (const name of expectedSheets) {
    const response = page.waitForResponse(r => r.request().method() === 'GET' && r.url().includes('/api/admin/baremes-autonome/versions/') && new URL(r.url()).searchParams.get('sheet') === name)
    await sheetSelect.selectOption(name)
    const data = await (await response).json()
    expect(data.canPublish, name).toBe(true)
    expect(data.sheets).toHaveLength(12)
    expect(data.items.length, name).toBeGreaterThan(0)
    expect(data.items.every((row: { after: { source: { sheet: string } } }) => row.after.source.sheet === name), name).toBe(true)
    globalCounts ??= data.counts
    expect(data.counts).toEqual(globalCounts)
    await expect(page.getByRole('region', { name: 'Barèmes — nouveau', exact: true })).toHaveAttribute('aria-busy', 'false')
    await page.getByRole('table').getByRole('row').nth(1).getByRole('button').click()
    if (name === 'Activering_Activation') {
      await page.getByRole('table').getByRole('button', { name: /WA1/ }).click()
      await expect(page.getByText('01/01/2023', { exact: false }).first()).toBeVisible()
      await expect(page.getByText('Expression de calcul source, conservée comme texte. Aucun montant individuel n’est calculé ici.')).toBeVisible()
      await page.screenshot({ path: 'test-results/autonomous-rates/activation-source-expression.png', fullPage: true })
    }
    if (name === 'Uurlonen_Salaires horaires') {
      await expect(page.getByText('EUR/hour', { exact: false }).last()).toBeVisible()
      await page.screenshot({ path: 'test-results/autonomous-rates/hourly-source.png', fullPage: true })
    }
  }
  await sheetSelect.selectOption('')
  await page.getByPlaceholder('Rechercher un code ou un libellé').fill('AA1')
  await expect(page.getByRole('cell', { name: /AA1/ }).first()).toBeVisible()
  await page.getByRole('cell', { name: /AA1/ }).first().click()
  await page.setViewportSize({ width: 1536, height: 1100 })
  await page.screenshot({ path: 'test-results/autonomous-rates/desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/autonomous-rates/mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1536, height: 1100 })
  await page.getByRole('button', { name: 'Publier dans le nouvel outil', exact: true }).click()
  const publication = page.waitForResponse(r => r.url().endsWith('/publish') && r.request().method() === 'POST')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publier dans le nouvel outil', exact: true }).click()
  const published = await publication
  expect(await published.json()).toMatchObject({ published: true })
  expect(published.ok()).toBe(true)
  await expect(page.getByRole('button', { name: 'Publier dans le nouvel outil', exact: true })).toBeDisabled({ timeout: 30000 })
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Historique des imports' }).locator('option:checked')).toContainText('barema20260901-new.xlsx')
  await expect(page.getByRole('button', { name: 'Publier dans le nouvel outil', exact: true })).toBeDisabled({ timeout: 30000 })
  const id = new URL(page.url()).searchParams.get('version')!
  const source = await request.get(`/api/admin/baremes-autonome/versions/${id}/source`)
  expect(source.ok()).toBe(true)
  expect((await source.body()).equals(fs.readFileSync(original!))).toBe(true)
  const book = XLSX.readFile(original!)
  book.Sheets.A_N_B_vol_plein.C12 = { t: 'n', v: 79.09 }
  await page.locator('input[type=file]').setInputFiles({ name: 'SYNTHETIC-BROWSER-TEST-ONLY.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })) })
  await expect(page.getByRole('button', { name: 'Publier dans le nouvel outil', exact: true })).toBeEnabled({ timeout: 30000 })
  await page.getByRole('button', { name: /^Modifiés/ }).click()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2)
  await expect(page.getByRole('cell', { name: '79,09', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/autonomous-rates/comparison-synthetic-test-only.png', fullPage: true })
  await page.getByRole('button', { name: 'Publier dans le nouvel outil', exact: true }).click()
  const secondPublication = page.waitForResponse(r => r.url().endsWith('/publish') && r.request().method() === 'POST')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publier dans le nouvel outil', exact: true }).click()
  expect((await secondPublication).ok()).toBe(true)
  await expect(page.getByRole('button', { name: 'Publier dans le nouvel outil', exact: true })).toBeDisabled({ timeout: 30000 })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Publier dans le nouvel outil', exact: true })).toBeDisabled({ timeout: 30000 })
  expect(errors).toEqual([])
})
