import { test, expect, type Page, type Locator } from '@playwright/test'
import messages from '../../messages/fr.json'

// Requires verify-family-baremes-recipe.ts and the isolated local server.
test.use({ baseURL: 'http://127.0.0.1:3041', channel: 'msedge', video: 'off', locale: 'fr-BE', timezoneId: 'Europe/Brussels' })
const t = messages.public.familySituation
const starts = (value: string) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
const button = (scope: Page | Locator, name: string) => scope.getByRole('button', { name: starts(name) })
const next = (page: Page) => page.getByRole('button', { name: t.continue, exact: true }).click()

async function begin(page: Page, date?: string) {
  await page.goto('/outils/ma-situation-familiale', { waitUntil: 'networkidle' })
  const language = page.getByRole('dialog').getByRole('button', { name: 'Français', exact: true })
  if (!await page.evaluate(() => localStorage.getItem('beldoc.locale.chosen'))) {
    await expect(language).toBeVisible()
    await language.click()
    await expect(language).toBeHidden()
  }
  const cookies = page.getByRole('button', { name: 'Tout refuser', exact: true })
  if (await cookies.isVisible()) await cookies.click()
  await button(page, date ? t.intentChangedTitle : t.intentCurrentTitle).click()
  await next(page)
  if (date) {
    await page.getByLabel(t.dateLabel, { exact: true }).fill(date)
    await next(page)
  }
}

async function person(page: Page, name: string, relation: string) {
  await page.getByLabel(t.personName, { exact: true }).fill(name)
  await page.getByLabel(t.personRelation, { exact: true }).selectOption(relation)
  await page.getByRole('button', { name: t.addPerson, exact: true }).click()
}

async function result(page: Page, category: string) {
  await expect(page.getByRole('heading', { name: t.summaryTitle, exact: true })).toBeVisible()
  await expect(page.locator('main').getByText(category, { exact: true }).first()).toBeVisible()
  await expect(page.locator('main').getByText(t.summaryNoCategoryBody, { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

async function childIncome(page: Page, name = 'Ana') {
  await person(page, name, 'child')
  await next(page)
  await button(page, t.childrenAllowance.no).click()
  await button(page, t.childrenIncome.yes).click()
  const group = page.getByRole('group', { name: t.childFirstWorkPersonLabel.replace('{name}', name) })
  await group.getByRole('button', { name: t.yes, exact: true }).click()
  return group
}

for (const width of [320, 390, 1440]) {
  test.describe(`${width}px real DOM`, () => {
    test.use({ viewport: { width, height: 960 } })

    test('two children without income, optional special situations, responsive result', async ({ page }, info) => {
      await begin(page)
      expect(await page.evaluate(() => innerWidth)).toBe(width)
      await person(page, 'Ana', 'child')
      await person(page, 'Ben', 'child')
      await next(page)
      await button(page, t.childrenAllowance.no).click()
      await button(page, t.childrenIncome.no).click()
      await result(page, t.categoryA)
      await expect(page.getByRole('heading', { name: t.particularQuestion })).toHaveCount(0)
      await page.screenshot({ path: info.outputPath('result-light.png'), fullPage: true })
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
      await page.evaluate(() => {
        localStorage.setItem('docbel-theme', 'dark')
        window.dispatchEvent(new Event('docbel-theme-change'))
      })
      await expect(page.locator('html')).toHaveClass(/dark/)
      await result(page, t.categoryA)
      await page.screenshot({ path: info.outputPath('result-dark.png'), fullPage: true })
      await page.emulateMedia({ forcedColors: 'active' })
      await result(page, t.categoryA)
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
    })

    test('student contract needs neither amount nor first-work declaration', async ({ page }) => {
      await begin(page)
      const group = await childIncome(page)
      await group.getByRole('button', { name: t.childIncomeKind.student, exact: true }).click()
      await expect(group.getByRole('textbox')).toHaveCount(0)
      await next(page)
      await result(page, t.categoryA)
    })

    test('expired first activity resumes amount assessment, unknown and editing remain usable', async ({ page }) => {
      await begin(page, '20/10/2026')
      const group = await childIncome(page)
      await group.getByRole('button', { name: t.childIncomeKind.professional, exact: true }).click()
      await group.getByRole('button', { name: t.yes, exact: true }).last().click()
      await group.getByLabel(t.studiesEndedLabel).fill('01/09/2025')
      await group.getByLabel(t.workStartedLabel).fill('01/10/2025')
      await group.getByLabel(t.childIncomeAmountLabel).fill('1 200')
      await next(page)
      await result(page, t.categoryB)
      await page.getByRole('button', { name: t.back, exact: true }).click()
      await group.getByLabel(t.childIncomeAmountLabel).fill('500,00')
      await next(page)
      await result(page, t.categoryA)
      await page.getByRole('button', { name: t.back, exact: true }).click()
      await group.getByRole('button', { name: t.unknown, exact: true }).last().click()
      await next(page)
      await result(page, t.summaryNoCategoryTitle)
      await page.getByRole('button', { name: t.back, exact: true }).click()
      await group.getByLabel(t.workStartedLabel).fill('01/07/2027')
      await expect(page.getByRole('button', { name: t.continue, exact: true })).toBeDisabled()
      await expect(group.getByRole('alert')).toHaveText(t.childWorkFutureNotice)
    })

    test('published current and historical thresholds change a complete spouse salary result', async ({ page }) => {
      for (const [date, category] of [[undefined, t.categoryA], ['20/08/2026', t.categoryB]] as const) {
        await begin(page, date)
        await person(page, 'Sam', 'spouse')
        await next(page)
        await button(page, t.partnerSituation.employee).click()
        await page.getByLabel(t.amountLabel, { exact: true }).fill('1 200')
        await next(page)
        await button(page, t.partnerFixed.fixed).click()
        await button(page, t.partnerContract.cdi).click()
        await result(page, category)
        await expect(page.getByRole('heading', { name: t.partnerQualificationQuestion })).toHaveCount(0)
      }
    })

    test('variable spouse salary keeps a monthly A rate distinct from a family category', async ({ page }) => {
      await begin(page)
      await person(page, 'Sam', 'spouse')
      await next(page)
      await button(page, t.partnerSituation.employee).click()
      await page.getByLabel(t.amountLabel, { exact: true }).fill('900')
      await next(page)
      await button(page, t.partnerFixed.variable).click()
      await page.getByLabel(t.amountLabel, { exact: true }).fill('900')
      await next(page)
      await button(page, t.partnerContract.cdi).click()
      await result(page, t.summaryNoCategoryTitle)
    })

    test('each parent without a pension can declare no other income', async ({ page }) => {
      await begin(page)
      await person(page, 'Paul', 'parent')
      await person(page, 'Jeanne', 'parent')
      await next(page)
      await button(page, t.relativeIncome.yes).click()
      await button(page, t.relativeIncomeKind.pension).click()
      await page.getByRole('group', { name: 'Pension de Paul', exact: true }).getByLabel(t.relativePensionGrossAmount).fill('700')
      const mother = page.getByRole('group', { name: 'Pension de Jeanne', exact: true })
      await mother.getByRole('button', { name: t.relativePensionNoPension, exact: true }).click()
      await expect(page.getByRole('button', { name: t.continue, exact: true })).toBeDisabled()
      await mother.getByRole('button', { name: t.relativeOtherIncome.noIncome, exact: true }).click()
      await next(page)
      await result(page, t.categoryA)
      await page.getByRole('button', { name: t.back, exact: true }).click()
      await mother.getByRole('button', { name: t.relativeOtherIncome.replacement, exact: true }).click()
      await next(page)
      await result(page, t.summaryNoCategoryTitle)
      await page.getByRole('button', { name: t.back, exact: true }).click()
      await mother.getByRole('button', { name: t.relativeOtherIncome.professional, exact: true }).click()
      await next(page)
      await result(page, t.categoryB)
    })

    test('historical pension threshold asks the decisive SPF question', async ({ page }) => {
      await begin(page, '20/08/2026')
      await person(page, 'Paul', 'parent')
      await next(page)
      await button(page, t.relativeIncome.yes).click()
      await button(page, t.relativeIncomeKind.pension).click()
      await page.getByLabel(t.relativePensionGrossAmount, { exact: true }).fill('1 500')
      await next(page)
      await expect(page.getByRole('heading', { name: t.relativeSpfQuestion, exact: true })).toBeVisible()
      await button(page, t.relativeSpf.yes).click()
      await result(page, t.categoryA)
      await page.getByRole('button', { name: t.back, exact: true }).click()
      await button(page, t.relativeSpf.no).click()
      await result(page, t.categoryB)
    })

    test('child allowances and a parent pension show the shared-engine result', async ({ page }) => {
      await begin(page)
      await person(page, 'Ana', 'child')
      await person(page, 'Paul', 'parent')
      await next(page)
      await button(page, t.childrenAllowance.yes).click()
      await button(page, t.relativeIncome.yes).click()
      await button(page, t.relativeIncomeKind.pension).click()
      await page.getByLabel(t.relativePensionGrossAmount, { exact: true }).fill('700')
      await next(page)
      await result(page, t.categoryA)
    })
  })
}
