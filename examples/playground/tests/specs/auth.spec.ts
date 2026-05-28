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
      await expect(page.getByPlaceholder('Enter your email')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('button', { name: /^guest$/i })).toBeVisible({ timeout: 30_000 })
    })
  }
})
