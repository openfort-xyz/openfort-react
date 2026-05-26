import { expect, type Page } from '@playwright/test'
import type { PlaygroundMode } from '../utils/mode'
import { safeClick } from '../utils/ui'

export class AuthPage {
  constructor(private readonly page: Page) {}

  // Navigate to the auth screen
  async goto() {
    await this.page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })
    await expect(this.page).toHaveURL(/\/showcase\/auth/i)
  }

  // Open the "Connect" modal from the navbar
  async openConnectModalFromNavbar() {
    await safeClick(this.page, /^(not connected|connect wallet)$/i, 30_000)

    await expect(this.page.getByText(/^connect$/i)).toBeVisible({ timeout: 30_000 })
    await expect(this.page.getByPlaceholder('Enter your email')).toBeVisible({ timeout: 30_000 })
  }

  /**
   * Sign up as a guest via the Openfort widget, then create a wallet on the dashboard.
   *
   * Flow:
   *  1. The onboarding screen auto-opens the widget; click "Guest" inside the modal
   *  2. Auth redirects to / (dashboard) — no wallet yet (connectOnLogin=false)
   *  3. Dismiss the widget if it lingers on a create-wallet step
   *  4. In the Wallets card: Create new wallet → Smart Account (EVM only) → Automatic
   *  5. Wait for "Connected with <address>"
   */
  async continueAsGuest(mode: PlaygroundMode) {
    // Onboarding auto-opens the Openfort widget modal; sign up via the "Guest" option.
    await expect(this.page.getByPlaceholder('Enter your email')).toBeVisible({ timeout: 30_000 })
    await this.page.getByRole('button', { name: /^guest$/i }).click()

    // Guest auth redirects to the dashboard. With connectOnLogin=false there is no wallet yet,
    // and the widget can linger on a create-wallet step — dismiss it, then create the wallet
    // from the Wallets card so the flow exercises the embedded-wallet create hook.
    const walletsTitle = this.page
      .locator('[data-slot="card-title"]')
      .filter({ hasText: /^wallets$/i })
      .first()
    await expect(walletsTitle).toBeVisible({ timeout: 60_000 })
    await this.page.keyboard.press('Escape')
    const walletsCard = walletsTitle.locator('xpath=ancestor::*[@data-slot="card"][1]')

    // Step 1: open wallet creation
    const createNewBtn = walletsCard.getByRole('button', { name: /create new wallet/i })
    await expect(createNewBtn).toBeVisible({ timeout: 30_000 })
    await createNewBtn.click()

    // Step 2 (EVM only): choose Smart Account type
    if (mode !== 'svm') {
      await walletsCard.getByRole('button', { name: /smart account/i }).click()
    } else {
      // For SVM, the "Create new wallet" button should directly open the flow without asking for wallet type
      await expect(walletsCard.getByRole('button', { name: /EOA/i })).toBeHidden({ timeout: 30_000 })
    }

    // Step 3: choose Automatic recovery
    await walletsCard.getByRole('button', { name: /^automatic$/i }).click()

    // Wait for wallet to be connected and address shown
    const connectedRegex = mode === 'svm' ? /Connected with [1-9A-HJ-NP-Za-km-z]/i : /Connected with 0x/i
    await expect(this.page.getByText(connectedRegex)).toBeVisible({ timeout: 120_000 })
  }
}
