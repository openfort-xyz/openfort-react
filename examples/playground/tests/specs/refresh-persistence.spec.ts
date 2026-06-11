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

    // Switch to Polygon Amoy (different from default Base Sepolia)
    const target = 'Polygon Amoy'
    const btn = chainCard.getByRole('button', { name: new RegExp(`^switch to\\s+${escapeRegExp(target)}$`, 'i') })
    if (!(await btn.isDisabled().catch(() => false))) {
      await btn.click()
    }

    await expect(chainCard.getByText(new RegExp(`^switched to chain\\s+${escapeRegExp(target)}$`, 'i'))).toBeVisible({
      timeout: 90_000,
    })
    await expect(currentChain).toContainText(/polygon amoy/i, { timeout: 90_000 })

    // Reload
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Still logged in + chain remains
    await dashboardPage.expectLoaded(m)
    await expect(currentChain).toContainText(/polygon amoy/i, { timeout: 90_000 })

    // Sanity: signatures input still exists (dashboard not broken)
    await expect(page.getByPlaceholder(/enter a message to sign/i)).toBeVisible({ timeout: 60_000 })
  })
})

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
