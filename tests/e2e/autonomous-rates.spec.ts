import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import * as XLSX from 'xlsx'
const original = process.env.DOCBEL_REFERENCE_XLSX
const root = '/api/admin/baremes-autonome/versions'
test.skip(!process.env.AUTONOMOUS_RATES_E2E || !original, 'Requires explicitly isolated local rates database')
test('guided real module: review, revoke, accept withdrawals, publish and preserve history', async ({
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(360000)
  if (baseURL !== 'http://localhost:3010') throw new Error('LOCAL_ISOLATED_PREVIEW_REQUIRED')
  await expect
    .poll(
      async () => {
        try {
          return (await request.get(root)).status()
        } catch {
          return 0
        }
      },
      { timeout: 60000 },
    )
    .toBe(401)
  // Compile private development routes before hydration and verify anonymous denial.
  for (const [method, path] of [
    ['POST', 'test/publish'],
    ['POST', 'test/decisions'],
    ['GET', 'test/reviews/test'],
    ['GET', 'test/report'],
  ] as const) {
    const response =
      method === 'POST' ? await request.post(`${root}/${path}`) : await request.get(`${root}/${path}`)
    expect(response.status()).toBe(401)
  }
  const credentials = JSON.parse(
    fs.readFileSync('private/backups/autonomous-rates-test/credentials.json', 'utf8'),
  )
  expect(
    (
      await request.post('/api/auth/sign-in/email', {
        data: { email: credentials.email, password: credentials.password },
        headers: { Origin: baseURL },
      })
    ).ok(),
  ).toBe(true)
  await page.context().addCookies((await request.storageState()).cookies)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const ready = () =>
    expect(page.locator('section[aria-label="Barèmes — nouveau"]')).toHaveAttribute('aria-busy', 'false', {
      timeout: 60000,
    })
  const capture = async (name: string) => {
    await ready()
    await page.screenshot({ path: `test-results/autonomous-rates/${name}.png`, fullPage: true })
  }
  const importBook = async (name: string, book?: XLSX.WorkBook) => {
    const waiting = page.waitForResponse(
      (response) => response.url().endsWith(root) && response.request().method() === 'POST',
    )
    await page.locator('input[type=file]').setInputFiles(
      book
        ? {
            name,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })),
          }
        : original!,
    )
    const result = await waiting
    expect(result.ok()).toBe(true)
    const id = (await result.json()).id
    await expect.poll(() => new URL(page.url()).searchParams.get('version')).toBe(id)
    await ready()
    return id as string
  }
  const publish = async () => {
    await page.getByRole('button', { name: 'Publier cette version', exact: true }).click()
    const waiting = page.waitForResponse(
      (response) => response.url().endsWith('/publish') && response.request().method() === 'POST',
    )
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Publier cette version', exact: true })
      .click()
    expect((await waiting).ok()).toBe(true)
    await expect(page.getByRole('button', { name: 'Version publiée', exact: true })).toBeDisabled({
      timeout: 30000,
    })
  }
  const confirmDecision = async (name: string) => {
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Motif de votre décision (8 caractères minimum)')).toBeVisible({
      timeout: 30000,
    })
    await expect(dialog.getByLabel('Motif de votre décision (8 caractères minimum)')).toHaveValue(
      name === 'Accepter ce retrait'
        ? 'Retrait documentaire constaté dans le nouveau fichier'
        : 'Montant confirmé dans le nouveau fichier',
    )
    await dialog.getByLabel('J’ai vérifié les sources et tous les éléments de ce périmètre.').check()
    await dialog.getByRole('button', { name, exact: true }).click()
    await expect(dialog).toHaveCount(0, { timeout: 30000 })
    await ready()
  }
  await page.setViewportSize({ width: 1536, height: 1100 })
  await page.goto('/admin/baremes-autonome')
  await ready()
  await expect(page.getByRole('heading', { name: 'Votre mise à jour, en clair.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Commençons par votre fichier' })).toBeVisible()
  await capture('01-empty')
  const first = await importBook('original')
  await expect(page.getByRole('heading', { name: 'Première version à créer' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await capture('02-first-import')
  const sheetSelect = page.getByRole('combobox', { name: 'Feuille source', exact: true })
  await expect(sheetSelect.locator('option')).toHaveCount(13)
  const names = [
    'A_N_B_vol_plein',
    'A_N_B_half_demi',
    'TW-CT_JS',
    'SpecCat',
    'Loonschijven_Tranches salariale',
    'Uurlonen_Salaires horaires',
    'W ',
    'AndereBedrWLH_AutresMontCHOM',
    'Activering_Activation',
    'AndereUitk_AutresAlloc',
    'Bonus',
    'Basisbedragen',
  ]
  for (const name of names) {
    const data = await (await request.get(`${root}/${first}?page=1&sheet=${encodeURIComponent(name)}`)).json()
    expect(data.items.length, name).toBeGreaterThan(0)
    expect(data.counts.added).toBe(6059)
    expect(data.review.pending).toBe(0)
  }
  await publish()
  expect(
    (await (await request.get(`${root}/${first}/source`)).body()).equals(fs.readFileSync(original!)),
  ).toBe(true)
  await importBook('SYNTHETIC-IDENTICAL-TEST.xlsx', XLSX.readFile(original!))
  await expect(page.getByRole('heading', { name: 'Aucun changement', exact: true })).toBeVisible()
  const book = XLSX.readFile(original!)
  book.Sheets.A_N_B_vol_plein.C12 = { ...book.Sheets.A_N_B_vol_plein.C12, v: 79.09 }
  const ordinary = await importBook('SYNTHETIC-ORDINARY-TEST.xlsx', book)
  await expect(page.getByText('1 changement dans votre fichier', { exact: true })).toBeVisible()
  await expect(page.getByText('79,09 € par jour', { exact: true })).toBeVisible()
  await capture('03-ordinary')
  await page.getByRole('button', { name: 'Avant / après', exact: true }).click()
  await expect(page.getByText('79,09 € par jour', { exact: true })).toBeVisible()
  await capture('04-before-after')
  const row = page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name: 'Minimum', exact: true }) })
  // Business title first; detail appears only on request and returns focus with Escape.
  await row.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByText('Consulter les sources des deux fichiers', { exact: true }).click()
  const sourceUrl = `${baseURL}${root}/${ordinary}/source`
  await page.route(sourceUrl, (route) =>
    route.fulfill({ status: 503, body: 'source unavailable in synthetic network test' }),
  )
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Télécharger le fichier source', exact: true })
    .last()
    .click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'La source n’a pas pu être téléchargée',
  )
  await page.unroute(sourceUrl)
  const retrySource = page.waitForEvent('download')
  await page.getByRole('dialog').getByRole('button', { name: 'Réessayer', exact: true }).click()
  expect((await retrySource).suggestedFilename()).toBe('SYNTHETIC-ORDINARY-TEST.xlsx')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(row).toBeFocused()
  await page.getByRole('button', { name: 'Par thèmes', exact: true }).click()
  await capture('05-themes')
  await page.getByRole('button', { name: 'Parcours guidé', exact: true }).click()
  await page.getByLabel('Afficher les éléments identiques').check()
  await ready()
  await expect(page.getByRole('button', { name: 'Page suivante' })).toBeEnabled()
  await page.getByLabel('Afficher les éléments identiques').uncheck()
  await ready()
  await publish()
  book.Sheets.A_N_B_vol_plein.C12 = { ...book.Sheets.A_N_B_vol_plein.C12, v: 160 }
  const large = await importBook('SYNTHETIC-LARGE-VARIATION-TEST.xlsx', book)
  await expect(page.getByRole('button', { name: 'Vérifier le prochain point', exact: true })).toBeEnabled()
  const largeState = await (await request.get(`${root}/${large}`)).json()
  expect(
    (
      await request.post(`${root}/${large}/publish`, {
        data: largeState.snapshot,
        headers: { Origin: baseURL },
      })
    ).status(),
  ).toBe(422)
  await page.getByRole('button', { name: 'Vérifier le prochain point', exact: true }).click()
  await expect(page.getByRole('dialog').getByText('160,00 € par jour', { exact: true })).toBeVisible({
    timeout: 30000,
  })
  await capture('06-variation-review')
  await confirmDecision('Confirmer ce montant')
  await page.reload()
  await ready()
  await expect(page.getByRole('button', { name: 'Publier cette version', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: /Un montant à confirmer/ }).click()
  await page
    .getByRole('dialog')
    .getByLabel('Motif de votre décision (8 caractères minimum)')
    .fill('Vérification complémentaire de recette')
  await page.getByRole('dialog').getByRole('button', { name: 'Révoquer cette confirmation' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30000 })
  await page.getByRole('button', { name: 'Vérifier le prochain point', exact: true }).click()
  await confirmDecision('Confirmer ce montant')
  await capture('07-checks-complete')
  await publish()
  // Remove the entire Walloon block, preserve the Brussels and SINE branches.
  book.Sheets.A_N_B_vol_plein.C12 = { ...book.Sheets.A_N_B_vol_plein.C12, v: 40 }
  for (const cell of Object.keys(book.Sheets.Activering_Activation))
    if (
      !cell.startsWith('!') &&
      ['I', 'J'].includes(cell.replace(/\d/g, '')) &&
      Number(cell.replace(/\D/g, '')) >= 7 &&
      Number(cell.replace(/\D/g, '')) <= 15
    )
      delete book.Sheets.Activering_Activation[cell]
  const removal = await importBook('SYNTHETIC-WALLONIA-WITHDRAWAL-TEST.xlsx', book)
  await page.getByRole('button', { name: 'Vérifier le prochain point', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Un retrait à confirmer' }),
  ).toBeVisible()
  await expect(
    page.getByRole('dialog').getByLabel('Motif de votre décision (8 caractères minimum)'),
  ).toBeVisible({ timeout: 30000 })
  await capture('08-withdrawal-review')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await capture('09-mobile-withdrawal')
  await confirmDecision('Accepter ce retrait')
  await page.getByRole('button', { name: 'Vérifier le prochain point', exact: true }).click()
  await expect(page.getByRole('dialog').getByText('40,00 € par jour', { exact: true })).toBeVisible({
    timeout: 30000,
  })
  await confirmDecision('Confirmer ce montant')
  await page.reload()
  await ready()
  await expect(page.getByRole('button', { name: 'Publier cette version', exact: true })).toBeEnabled()
  await capture('10-mobile-accepted')
  await page.setViewportSize({ width: 1536, height: 1100 })
  await publish()
  const report = await (await request.get(`${root}/${removal}/report`)).json()
  expect(
    report.rows
      .filter((row: { kind: string }) => row.kind === 'absent')
      .every(
        (row: { key: string; after: unknown }) =>
          row.key.startsWith('activation/activa_wallonia/') && row.after === null,
      ),
  ).toBe(true)
  const old = await (await request.get(`${root}/${large}`)).json()
  expect(old.counts.absent).toBe(0)
  const download = page.waitForEvent('download')
  await page.getByText('Compte rendu de lecture', { exact: true }).click()
  await page.getByRole('button', { name: 'Télécharger le rapport', exact: true }).click()
  expect((await download).suggestedFilename()).toContain('docbel-verification')
  // An unreadable present amount cannot be waived as a documentary removal.
  delete book.Sheets.A_N_B_vol_plein.C12
  await importBook('SYNTHETIC-UNREADABLE-TEST.xlsx', book)
  await expect(page.getByText('Certains points ne peuvent pas être vérifiés', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publier cette version', exact: true })).toHaveCount(0)
  await capture('11-technical-block')
  expect(errors).toEqual([])
})
