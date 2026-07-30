import { expect, type Page } from '@playwright/test'
import type { PlaygroundMode } from '../utils/mode'

export class DashboardPage {
  constructor(private readonly page: Page) {}

  // Navigate to the dashboard directly (skip auth page to avoid isLoading deadlock with wagmi bridge)
  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' })
  }

  // Sign out button
  signOutButton() {
    return this.page.getByRole('button', { name: /^sign out$/i })
  }

  /**
   * Verify that the dashboard is loaded.
   * @param mode - Optional; used for stricter connectivity checks.
   */
  async expectLoaded(mode: PlaygroundMode) {
    await expect(this.signOutButton()).toBeVisible({ timeout: 90_000 })
    // SVM addresses are base58 (start with 1-9 or A-H etc.), EVM addresses start with 0x.
    // Avoid matching the placeholder "Connected with ..." which appears before the wallet connects.
    const connectedRegex = mode === 'svm' ? /Connected with [1-9A-HJ-NP-Za-km-z]/i : /Connected with 0x/i
    await expect(this.page.getByText(connectedRegex)).toBeVisible({ timeout: 60_000 })
    await new Promise((r) => setTimeout(r, 1000))
  }

  /**
   * Ensure navigation and ready state.
   * Auth is persisted via storageState for both modes; the SDK auto-recovers the wallet on load.
   * If the app redirects to auth or gets stuck loading, force-navigate to the dashboard.
   */
  async ensureReady(mode: PlaygroundMode) {
    if (!mode) {
      throw new Error('Mode is required')
    }
    await this.goto()

    // If the app redirected to auth (wagmi bridge isLoading deadlock), force-navigate to dashboard
    const signOut = this.signOutButton()
    const isOnDashboard = await signOut.isVisible().catch(() => false)
    if (!isOnDashboard) {
      await this.page.waitForTimeout(5_000)
      if (this.page.url().includes('/auth')) {
        await this.page.goto('/', { waitUntil: 'domcontentloaded' })
      }
    }

    await this.expectLoaded(mode)
  }

  /**
   * Sign a message through the Openfort UI widget: open the modal from the
   * "Openfort UI" card, confirm, wait for the success screen, then close it.
   * (The message content is fixed by the widget demo, so the argument is unused.)
   */
  async signMessage(_message: string, _mode: PlaygroundMode) {
    const card = await this.getCardByTitle(/openfort ui/i)
    const signBtn = card.getByRole('button', { name: /^sign message$/i })
    await expect(signBtn).toBeEnabled({ timeout: 90_000 })
    await signBtn.click()

    const confirmBtn = this.page.getByRole('button', { name: /sign and continue/i })
    await expect(confirmBtn).toBeVisible({ timeout: 30_000 })
    await confirmBtn.click()

    try {
      await expect(this.page.getByText(/message signed/i)).toBeVisible({ timeout: 120_000 })
    } catch (e) {
      await this.page.screenshot({ path: 'test-results/sign-message-failed.png', fullPage: true }).catch(() => {})
      throw e
    }

    // Close the success screen so the dashboard is interactive again.
    await this.page.getByRole('button', { name: /^done$/i }).click()
  }

  async getCardByTitle(title: string | RegExp) {
    // Match the card TITLE slot, not any text in the card: body copy can
    // legitimately contain another card's title word (e.g. the Session keys
    // card's "EOA wallets cannot use session keys" note matches /wallets/i once
    // the shared test account has a wallet), and `hasText` + `.first()` would
    // then grab the wrong card and strand the spec.
    const titleLocator = this.page
      .locator('[data-slot="card"]')
      .filter({ has: this.page.locator('[data-slot="card-title"]', { hasText: title }) })
      .first()

    await expect(titleLocator).toBeVisible({ timeout: 10_000 })

    return titleLocator
  }
}
