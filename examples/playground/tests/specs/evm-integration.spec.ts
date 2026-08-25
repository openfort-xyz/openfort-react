/**
 * Unified EVM integration test.
 *
 * Playwright storageState preserves cookies + localStorage but NOT IndexedDB,
 * so the embedded signer's key shares are lost between tests. Rather than
 * fighting recovery, we create ONE wallet up-front and exercise all EVM
 * features sequentially — minimising wallet creation while covering:
 *
 *   1. Wallet creation (Automatic + Password)
 *   2. Sign message
 *   3. Switch chain -> sign -> verify chain persisted
 *   4. Write contract (mint)
 *   5. Session keys (create, revoke, delete)
 */

import { expect, test } from '../fixtures/test'
import { EVM_TX_HASH_REGEX } from '../utils/mode'

test.describe('EVM integration', () => {
  test.skip(({ mode }) => mode !== 'evm', 'EVM only')
  test.describe.configure({ retries: 1 })

  test('full flow: wallet, signatures, chain switch, mint, session keys', async ({ page, dashboardPage, mode }) => {
    test.setTimeout(300_000)

    // ── Navigate (authenticated via storageState, wallet not connected) ──
    await dashboardPage.goto()
    await expect(dashboardPage.signOutButton()).toBeVisible({ timeout: 90_000 })

    // ── Step 1: Create wallet (Smart Account, Automatic) ────────────────
    await test.step('create wallet (automatic)', async () => {
      const walletsCard = await dashboardPage.getCardByTitle(/wallets/i)

      await walletsCard.getByRole('button', { name: /create new wallet/i }).click()
      await walletsCard.getByRole('button', { name: /smart account/i }).click()
      await walletsCard.getByRole('button', { name: /^automatic$/i }).click()

      await expect(walletsCard.getByText(/creating wallet.*automatic/i)).toBeVisible({ timeout: 30_000 })

      // Wait for the wallet row to appear
      const walletRow = walletsCard.locator('button').filter({ hasText: /0x[a-f0-9]{4,}\.\.\.[a-f0-9]{4,}/i })
      await expect.poll(() => walletRow.count(), { timeout: 120_000 }).toBeGreaterThanOrEqual(1)

      // Wait for full connection and the Openfort UI card to be ready
      await expect(page.getByText(/Connected with 0x/i)).toBeVisible({ timeout: 60_000 })
      const uiCard = await dashboardPage.getCardByTitle(/openfort ui/i)
      const signButton = uiCard.getByRole('button', { name: /^sign message$/i })
      await expect(signButton).toBeEnabled({ timeout: 60_000 })
    })

    // ── Step 2: Sign message ────────────────────────────────────────────
    await test.step('sign message', async () => {
      const msg = `Sign-test ${Date.now()}`
      await dashboardPage.signMessage(msg, mode)
    })

    // ── Step 3: Switch chain -> sign -> verify chain persisted ──────────
    await test.step('switch chain and sign', async () => {
      const chainCard = await dashboardPage.getCardByTitle(/switch chain/i)

      const currentChain = chainCard
        .locator('p')
        .filter({ hasText: /^current chain:/i })
        .first()
      await expect(currentChain).toBeVisible({ timeout: 30_000 })

      // The wallet is created on whichever chain the Openfort project configures,
      // not on wagmi's default, so the starting chain is not known up front. The
      // card disables the button for the active chain, so the enabled buttons are
      // exactly the chains worth switching to. The heading reads "Current chain:
      // Base Sepolia (84532)" while the buttons carry the bare name.
      const readChainName = async () =>
        ((await currentChain.textContent()) ?? '')
          .replace(/^current chain:\s*/i, '')
          .replace(/\s*\(\d+\)\s*$/, '')
          .trim()
      const startingChain = await readChainName()
      expect(startingChain).toBeTruthy()

      const switchBtn = chainCard.locator('button:enabled').filter({ hasText: /^switch to /i })
      await expect(switchBtn.first()).toBeEnabled({ timeout: 60_000 })
      const targetLabel = ((await switchBtn.first().textContent()) ?? '').replace(/^switch to\s*/i, '').trim()
      expect(targetLabel).toBeTruthy()
      expect(targetLabel).not.toBe(startingChain)
      await switchBtn.first().click()

      await expect(currentChain).toContainText(targetLabel, { timeout: 90_000 })

      // Sign after chain switch
      const msg = `Chain-sign ${Date.now()}`
      await dashboardPage.signMessage(msg, mode)

      // Verify chain stayed
      await expect(currentChain).toContainText(targetLabel, { timeout: 30_000 })

      // Return to the wallet's own chain so the mint below runs where the wallet
      // was deployed rather than on whichever chain this step happened to pick.
      const backBtn = chainCard.getByRole('button', { name: new RegExp(`^switch to ${startingChain}$`, 'i') })
      await expect(backBtn).toBeEnabled({ timeout: 60_000 })
      await backBtn.click()
      await expect(currentChain).toContainText(startingChain, { timeout: 90_000 })
    })

    // ── Step 4: Write contract (mint) ───────────────────────────────────
    await test.step('mint tokens', async () => {
      const writeCard = await dashboardPage.getCardByTitle(/write contract/i)
      await expect(writeCard).toBeVisible({ timeout: 60_000 })

      await expect(writeCard.getByText(/balance:\s*\d+/i)).toBeVisible({ timeout: 60_000 })

      const amountInput = writeCard.getByPlaceholder(/enter amount to mint/i)
      await expect(amountInput).toBeVisible({ timeout: 30_000 })
      await amountInput.fill('7')

      const mintBtn = writeCard.getByRole('button', { name: /mint tokens/i })
      await expect(mintBtn).toBeEnabled({ timeout: 30_000 })
      await mintBtn.click()

      await expect(page.getByText(EVM_TX_HASH_REGEX)).toBeVisible({ timeout: 120_000 })
    })

    // ── Step 5: Create wallet (Password) — tests creation UI ────────────
    await test.step('create wallet (password)', async () => {
      const walletsCard = await dashboardPage.getCardByTitle(/wallets/i)
      const walletRow = walletsCard.locator('button').filter({ hasText: /0x[a-f0-9]{4,}\.\.\.[a-f0-9]{4,}/i })
      const initialCount = await walletRow.count()

      await walletsCard.getByRole('button', { name: /create new wallet/i }).click()
      await walletsCard.getByRole('button', { name: /smart account/i }).click()
      await walletsCard.getByRole('button', { name: /^password$/i }).click()

      await expect(walletsCard.getByText(/creating wallet with password recovery/i)).toBeVisible({ timeout: 30_000 })
      await expect.poll(() => walletRow.count(), { timeout: 120_000 }).toBeGreaterThan(initialCount)
    })

    // ── Step 6: Session keys (create, revoke, delete) ───────────────────
    await test.step('session keys', async () => {
      const sessionCard = await dashboardPage.getCardByTitle(/session keys/i)
      await expect(sessionCard).toBeVisible({ timeout: 60_000 })

      const createBtn = sessionCard.getByRole('button', { name: /create session key/i })
      await expect(createBtn).toBeEnabled({ timeout: 30_000 })

      const keySpans = sessionCard.locator('span.truncate.font-mono')

      // Ensure at least 2 session keys
      while ((await keySpans.count()) < 2) {
        const before = await keySpans.count()
        await expect(createBtn).toBeEnabled({ timeout: 30_000 })
        await createBtn.click()
        await expect.poll(() => keySpans.count(), { timeout: 120_000 }).toBeGreaterThan(before)
      }

      const initialCount = await keySpans.count()
      expect(initialCount).toBeGreaterThanOrEqual(2)

      // Select the 2nd key
      const targetKeySpan = keySpans.nth(1)
      const targetKeyText = (await targetKeySpan.textContent())?.trim()
      expect(targetKeyText).toBeTruthy()

      const targetRow = targetKeySpan.locator('xpath=ancestor::div[@data-slot="tooltip-trigger"][1]')
      await expect(targetRow).toBeVisible({ timeout: 30_000 })

      // Revoke (X button)
      const rowButtons = targetRow.locator('button')
      await expect(rowButtons).toHaveCount(1, { timeout: 30_000 })
      await rowButtons.first().click()

      const struck = targetRow.locator('.line-through')
      await expect(struck).toBeVisible({ timeout: 60_000 })

      // Delete (trash button appears after revoke)
      const trashBtn = targetRow.locator('button:has(svg.lucide-trash)').or(targetRow.locator('button').last())
      await expect(trashBtn.first()).toBeVisible({ timeout: 60_000 })
      await trashBtn.first().click()

      // Confirm key is removed
      await expect
        .poll(
          async () => {
            const all = (await keySpans.allTextContents()).map((t) => t.trim())
            return all.includes(targetKeyText!)
          },
          { timeout: 120_000 }
        )
        .toBeFalsy()
    })
  })
})
