import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'autonomous-rates.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 240000,
  outputDir: '../../test-results/browser',
  use: {
    ...devices['Desktop Chrome'],
    channel: process.env.AUTONOMOUS_RATES_BROWSER_CHANNEL === 'msedge' ? 'msedge' : undefined,
    baseURL: 'http://localhost:3010',
    locale: 'fr-BE',
    timezoneId: 'Europe/Brussels',
    screenshot: 'only-on-failure',
    actionTimeout: 30000,
  },
})
