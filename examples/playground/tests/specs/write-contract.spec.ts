import { expect, test } from '../fixtures/test'
import { EVM_TX_HASH_REGEX } from '../utils/mode'

test.describe('Write Contract - mint tokens', () => {
  test.describe.configure({ retries: 1 })

  // Minting requires a Smart Account (or Delegated) for gas sponsorship via fee sponsorship.
  test('smart account: mint shows transaction hash', async ({ page, dashboardPage, mode }) => {
    const m = mode
    await dashboardPage.ensureReady(m)

    // Wallets card
    const walletsTitle = page
      .locator('[data-slot="card-title"]')
      .filter({ hasText: /^wallets$/i })
      .first()
    await expect(walletsTitle).toBeVisible({ timeout: 60_000 })
    const walletsCard = walletsTitle.locator('xpath=ancestor::*[@data-slot="card"][1]')

    await walletsCard.getByRole('button', { name: /create new wallet/i }).click()
    if (mode !== 'svm') {
      await walletsCard.getByRole('button', { name: /smart account/i }).click()
    }
    await walletsCard.getByRole('button', { name: /^password$/i }).click()

    const walletRowLocator = walletsCard.locator('button').filter({
      hasText: /0x[a-f0-9]{4,}\.\.\.[a-f0-9]{4,}/i,
    })

    const initialCount = await walletRowLocator.count()

    await expect(walletsCard.getByText(/^creating wallet with password recovery/i)).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => await walletRowLocator.count(), { timeout: 120_000 }).toBeGreaterThan(initialCount)

    // Card "Write Contract"
    const writeCard = await dashboardPage.getCardByTitle(/write contract/i)

    await expect(writeCard).toBeVisible({ timeout: 60_000 })
    await expect(writeCard.getByText(/balance:\s*\d+/i)).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(1500)

    const amountInput = writeCard.getByPlaceholder(/enter amount to mint/i)
    await expect(amountInput).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(1500)
    await amountInput.fill('7')

    const mintBtn = writeCard.getByRole('button', { name: /mint tokens/i })
    await expect(mintBtn).toBeVisible({ timeout: 30_000 })
    await mintBtn.click()

    await expect(page.getByText(EVM_TX_HASH_REGEX)).toBeVisible({ timeout: 120_000 })
  })
})
