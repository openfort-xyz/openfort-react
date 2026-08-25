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
      await Promise.race([
        signOut.waitFor({ state: 'visible', timeout: 5_000 }),
        this.page.waitForURL(/\/auth(?:[/?#]|$)/, { timeout: 5_000 }),
      ]).catch(() => undefined)
      if (this.page.url().includes('/auth')) {
        await this.page.goto('/', { waitUntil: 'domcontentloaded' })
      }
    }

    await this.expectLoaded(mode)
  }

  /**
   * Full address of the connected account. The header truncates it, so hover the
   * truncated span and read the tooltip, which carries the untruncated value.
   */
  async connectedAddress(): Promise<`0x${string}`> {
    const truncated = this.page
      .locator('p')
      .filter({ hasText: /^Connected with/i })
      .locator('[data-slot="tooltip-trigger"]')
      .first()
    await expect(truncated).toBeVisible({ timeout: 60_000 })
    await truncated.hover()

    // The tooltip renders the address in more than one node (visible text plus an
    // assistive copy), so extract the first address from its combined text rather
    // than expecting the text to be a single bare address.
    const tooltip = this.page.locator('[data-slot="tooltip-content"]').first()
    await expect(tooltip).toContainText(/0x[a-fA-F0-9]{40}/, { timeout: 30_000 })
    const address = /0x[a-fA-F0-9]{40}/.exec((await tooltip.textContent()) ?? '')?.[0]

    if (!address) throw new Error('Expected a 0x address in the tooltip')
    return address as `0x${string}`
  }

  /**
   * Sign a message through the Openfort UI widget: open the modal from the
   * sign widget, confirm, wait for the success screen, then close it. On EVM
   * the widget lives behind the "Sign" card's UI-widget tab; on SVM it keeps
   * its own "Openfort UI" card. (The message content is fixed by the widget
   * demo, so the argument is unused.)
   */
  async signMessage(_message: string, mode: PlaygroundMode) {
    const card = mode === 'svm' ? await this.getCardByTitle(/openfort ui/i) : await this.openWidgetTab(/^sign$/i)
    const signBtn = card.getByRole('button', { name: /^sign message$/i })
    await expect(signBtn).toBeEnabled({ timeout: 90_000 })
    await signBtn.click()

    const confirmBtn = this.page.getByRole('button', { name: /sign and continue/i })
    await expect(confirmBtn).toBeVisible({ timeout: 30_000 })
    await expect(confirmBtn).toBeEnabled({ timeout: 90_000 })
    await confirmBtn.click()
    await expect(this.page.getByRole('button', { name: /^waiting/i })).toBeVisible({ timeout: 30_000 })

    const success = this.page.getByText(/message signed/i)
    const error = this.page
      .locator('[role="alert"]')
      .or(this.page.getByText(/failed to sign|no connected wallet|signer is not configured/i))
    try {
      await expect(success.or(error).first()).toBeVisible({ timeout: 120_000 })
      if (await error.first().isVisible()) {
        throw new Error(`Sign message failed: ${(await error.first().textContent())?.trim() || 'unknown error'}`)
      }
    } catch (cause) {
      await this.page.screenshot({ path: 'test-results/sign-message-failed.png', fullPage: true }).catch(() => {})
      throw cause
    }

    // Close the success screen so the dashboard is interactive again.
    await this.page.getByRole('button', { name: /^done$/i }).click()
  }

  /**
   * EVM action cards carry a Headless / UI-widget toggle and default to
   * headless; select the widget tab so the prebuilt-modal variant is rendered.
   * A no-op when the widget tab is already active.
   */
  async openWidgetTab(title: string | RegExp) {
    const card = await this.getCardByTitle(title)
    await card.getByRole('tab', { name: /ui widget/i }).click()
    return card
  }

  async getCardByTitle(title: string | RegExp) {
    // Match the card title slot, not any text in the card: body copy can
    // legitimately contain another card's title word.
    const titleLocator = this.page
      .locator('[data-slot="card"]')
      .filter({ has: this.page.locator('[data-slot="card-title"]', { hasText: title }) })
      .first()

    await expect(titleLocator).toBeVisible({ timeout: 10_000 })

    return titleLocator
  }
}
