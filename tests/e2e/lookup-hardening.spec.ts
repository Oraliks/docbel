import { expect, test, type Page } from '@playwright/test'

const password = process.env.LOOKUP_E2E_PASSWORD
const emails = {
  admin: process.env.LOOKUP_E2E_ADMIN_EMAIL,
  user: process.env.LOOKUP_E2E_USER_EMAIL,
  partner: process.env.LOOKUP_E2E_PARTNER_EMAIL,
  disabled: process.env.LOOKUP_E2E_DISABLED_EMAIL,
}
const privateTableId = process.env.LOOKUP_E2E_PRIVATE_TABLE_ID

async function signIn(page: Page, email: string) {
  const response = await page.request.post('/api/auth/sign-in/email', {
    data: { email, password },
  })
  return response
}

async function browserJson(page: Page, path: string) {
  return page.evaluate(async (url) => {
    const response = await fetch(url, { credentials: 'same-origin' })
    const body = await response.json().catch(() => null)
    return {
      status: response.status,
      cacheControl: response.headers.get('cache-control'),
      body,
    }
  }, path)
}

test('Lookup is isolated by role and public street search strips internal fields', async ({ page }) => {
  test.setTimeout(120_000)
  for (const [key, value] of Object.entries({ password, ...emails, privateTableId })) {
    expect(value, 'missing E2E fixture value: ' + key).toBeTruthy()
  }
  await page.goto('/login')

  const visitorPrivate = await browserJson(page, '/api/lookup/tables/' + privateTableId)
  expect(visitorPrivate.status).toBe(401)
  expect(visitorPrivate.cacheControl).toContain('private')
  expect(visitorPrivate.cacheControl).toContain('no-store')

  const publicSearch = await browserJson(page, '/api/lookup/search?tableSlug=code-rue&limit=10')
  expect(publicSearch.status).toBe(200)
  expect(JSON.stringify(publicSearch.body)).not.toContain('LOOKUP_E2E_PRIVATE_SENTINEL')
  expect(JSON.stringify(publicSearch.body)).not.toContain('internal/lookup-e2e-secret-file.csv')

  await page.context().clearCookies()
  const userLogin = await signIn(page, emails.user!)
  expect(userLogin.ok()).toBeTruthy()
  const regularUser = await browserJson(page, '/api/lookup/tables/' + privateTableId)
  expect(regularUser.status).toBe(403)
  expect(regularUser.cacheControl).toContain('private')
  expect(regularUser.cacheControl).toContain('no-store')

  await page.context().clearCookies()
  const partnerLogin = await signIn(page, emails.partner!)
  expect(partnerLogin.ok()).toBeTruthy()
  const partnerTable = await browserJson(page, '/api/lookup/tables/' + privateTableId)
  expect(partnerTable.status).toBe(200)
  expect(JSON.stringify(partnerTable.body)).not.toContain('LOOKUP_E2E_PRIVATE_SENTINEL')
  expect(JSON.stringify(partnerTable.body)).not.toContain('internal/lookup-e2e-secret-file.csv')
  const partnerPatch = await page.evaluate(async (id) => {
    const response = await fetch('/api/lookup/tables/' + id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ labelFr: 'Ne doit pas être modifié' }),
    })
    return response.status
  }, privateTableId)
  expect(partnerPatch).toBe(403)

  const partnerPage = await page.goto('/outils/lookup-onem')
  expect(partnerPage?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: /Lookup\s*ONEM/i })).toBeVisible()

  await page.context().clearCookies()
  const disabledLogin = await signIn(page, emails.disabled!)
  expect(disabledLogin.status()).toBe(403)

  await page.context().clearCookies()
  const adminLogin = await signIn(page, emails.admin!)
  expect(adminLogin.ok()).toBeTruthy()
  const adminTable = await browserJson(page, '/api/lookup/tables/' + privateTableId)
  expect(adminTable.status).toBe(200)
  expect(JSON.stringify(adminTable.body)).toContain('LOOKUP_E2E_PRIVATE_SENTINEL')
  expect(JSON.stringify(adminTable.body)).toContain('internal/lookup-e2e-secret-file.csv')

  const adminPage = await page.goto('/admin/chomage/lookup')
  expect(adminPage?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Lookup ONEM' })).toBeVisible()
  await expect(page.getByText('Lookup e2e privé')).toBeVisible()
})
