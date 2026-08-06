import { expect, test } from '@playwright/test'
import { setPlaygroundMode } from '../utils/mode.js'

test('renders provider controls and opens the SDK modal without external services', async ({ page }) => {
  await setPlaygroundMode(page, 'evm')
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort('blockedbyclient'))

  await page.goto('/provider', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('providerOptions', { exact: true })).toBeVisible()
  await expect(page.locator('[data-variable-name="connectOnLogin"]')).toBeVisible()

  await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })
  const landingCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: /connect to start/i })
    .first()
  await expect(landingCard).toBeVisible()
  await landingCard.getByRole('button', { name: /^connect wallet$/i }).click()

  await expect(page.getByPlaceholder('your@email.com')).toBeVisible()
  await expect(page.getByRole('button', { name: /^guest$/i })).toBeVisible()
})
