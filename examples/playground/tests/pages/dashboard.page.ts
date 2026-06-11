import { expect, type Page } from '@playwright/test'
import type { PlaygroundMode } from '../utils/mode'
import { EVM_SIGNED_REGEX, SOLANA_SIGNED_REGEX } from '../utils/mode'

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
   * Sign a message and validate the result.
   * @param message - Message to sign
   * @param mode - EVM uses 0x signed hash; Solana uses base58.
   */
  async signMessage(message: string, mode: PlaygroundMode) {
    const messageInput = this.page.getByPlaceholder(/enter a message to sign/i)
    await expect(messageInput).toBeVisible({ timeout: 60_000 })
    await messageInput.fill(message)

    const signBtn = this.page.getByRole('button', { name: /sign a message/i })
    await expect(signBtn).toBeEnabled({ timeout: 90_000 })
    await signBtn.click()

    const signedRegex = mode === 'svm' ? SOLANA_SIGNED_REGEX : EVM_SIGNED_REGEX

    try {
      await expect(this.page.getByText(signedRegex)).toBeVisible({ timeout: 120_000 })
    } catch (e) {
      await this.page.screenshot({ path: 'test-results/sign-message-failed.png', fullPage: true }).catch(() => {})
      throw e
    }
  }

  async getCardByTitle(title: string | RegExp) {
    const titleLocator = this.page.locator('[data-slot="card"]').filter({ hasText: title }).first()

    await expect(titleLocator).toBeVisible({ timeout: 10_000 })

    return titleLocator
  }
}
