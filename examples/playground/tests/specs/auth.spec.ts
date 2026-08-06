import { expect, test } from '@playwright/test'
import type { PlaygroundMode } from '../utils/mode'
import { setPlaygroundMode } from '../utils/mode'

const MODES: PlaygroundMode[] = ['svm', 'evm']

test.describe('auth screen renders correctly', () => {
  for (const mode of MODES) {
    test(`${mode}: onboarding opens the Openfort widget with guest + email`, async ({ page }) => {
      await setPlaygroundMode(page, mode)
      await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/showcase\/auth/i)

      // Landing card with the Connect Wallet button. Scope to the landing
      // card because the dashboard sidebar also renders a "Connect Wallet"
      // button in the header.
      const landingCard = page
        .locator('[data-slot="card"]')
        .filter({ hasText: /connect to start/i })
        .first()
      await expect(landingCard).toBeVisible({ timeout: 20_000 })
      await landingCard.getByRole('button', { name: /^connect wallet$/i }).click()

      // The widget modal opens with the configured sign-in options
      await expect(page.getByPlaceholder('your@email.com')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('button', { name: /^guest$/i })).toBeVisible({ timeout: 30_000 })
    })
  }

  test('evm: creates an automatic-recovery wallet through the SDK modal', async ({ page }) => {
    await setPlaygroundMode(page, 'evm')
    await page.goto('/provider', { waitUntil: 'domcontentloaded' })

    const connectOnLogin = page.locator('[data-variable-name="connectOnLogin"]')
    await expect(connectOnLogin).toBeVisible({ timeout: 30_000 })
    await connectOnLogin.getByRole('button', { name: 'true' }).click()
    await connectOnLogin.locator('select').selectOption('false')

    await page.getByRole('link', { name: /^wallet actions$/i }).click()
    await expect(page).toHaveURL(/\/showcase\/auth/i)
    await page
      .getByRole('button', { name: /^connect wallet$/i })
      .first()
      .click()
    await page.getByRole('button', { name: /^guest$/i }).click()

    const createWallet = page.getByRole('button', { name: /^create wallet$/i })
    await expect(createWallet).toBeVisible({ timeout: 60_000 })
    await createWallet.click()
    await expect(
      page
        .getByText(/creating wallet with automatic recovery/i)
        .or(page.getByText(/Connected with 0x/i))
        .first()
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Connected with 0x/i)).toBeVisible({ timeout: 120_000 })
  })
})
