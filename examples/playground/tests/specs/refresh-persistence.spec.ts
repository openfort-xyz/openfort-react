import { expect, test } from '../fixtures/test'

test.describe('Dashboard regression - refresh persistence', () => {
  test('switch chain persists after reload and dashboard remains usable', async ({ page, dashboardPage, mode }) => {
    test.setTimeout(180_000)
    const m = mode
    await dashboardPage.ensureReady(m)

    const chainCard = await dashboardPage.getCardByTitle(/switch chain/i)

    const currentChain = chainCard
      .locator('p')
      .filter({ hasText: /^current chain:/i })
      .first()
    await expect(currentChain).toBeVisible({ timeout: 30_000 })

    // Switch to whichever chain is not already active. Hardcoding a target makes
    // this pass for free whenever the wallet is created on that chain, which hides
    // the regression: the embedded account carries its own chainId, so a reload can
    // restore the account's chain instead of the one selected here.
    const switchBtn = chainCard
      .locator('button:enabled')
      .filter({ hasText: /^switch to /i })
      .first()
    await expect(switchBtn).toBeEnabled({ timeout: 60_000 })
    const target = ((await switchBtn.textContent()) ?? '').replace(/^switch to\s*/i, '').trim()
    expect(target).toBeTruthy()

    await switchBtn.click()
    await expect(chainCard.getByText(new RegExp(`^switched to chain\\s+${escapeRegExp(target)}$`, 'i'))).toBeVisible({
      timeout: 90_000,
    })
    await expect(currentChain).toContainText(target, { timeout: 90_000 })

    // Reload
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Still logged in + chain remains
    await dashboardPage.expectLoaded(m)
    await expect(currentChain).toContainText(target, { timeout: 90_000 })

    // Sanity: the Openfort UI card still renders (dashboard not broken)
    await expect(page.getByRole('button', { name: /^sign message$/i }).first()).toBeVisible({ timeout: 60_000 })
  })
})

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
