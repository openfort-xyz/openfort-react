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

      // Landing card with the Connect Wallet button
      await expect(page.getByText(/connect to start/i)).toBeVisible({ timeout: 20_000 })
      await page.getByRole('button', { name: /^connect wallet$/i }).click()

      // The widget modal opens with the configured sign-in options
      await expect(page.getByPlaceholder('Enter your email')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('button', { name: /^guest$/i })).toBeVisible({ timeout: 30_000 })
    })
  }
})
