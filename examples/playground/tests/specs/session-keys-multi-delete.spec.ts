import { expect, test } from '../fixtures/test'

test.describe('Session keys - multiple + delete flow', () => {
  // test.describe.configure({ retries: 3 })

  test('can create multiple session keys, revoke one (X), and delete it (trash)', async ({
    page,
    dashboardPage,
    mode,
  }) => {
    test.skip(mode === 'svm', 'Session keys are EVM only')
    test.setTimeout(180_000)
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
    await walletsCard.getByRole('button', { name: /smart account/i }).click()
    await walletsCard.getByRole('button', { name: /^password$/i }).click()

    const walletRowLocator = walletsCard.locator('button').filter({
      hasText: /0x[a-f0-9]{4,}\.\.\.[a-f0-9]{4,}/i,
    })

    let initialCount = await walletRowLocator.count()

    await expect(walletsCard.getByText(/^creating wallet with password recovery/i)).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => await walletRowLocator.count(), { timeout: 120_000 }).toBeGreaterThan(initialCount)

    // Wait for any wallet row to become the active account
    await expect
      .poll(
        async () => {
          const count = await walletRowLocator.count()
          if (count <= initialCount) return false
          for (let i = 0; i < count; i++) {
            const isActive = await walletRowLocator.nth(i).evaluate((el) => el.classList.contains('text-primary'))
            if (isActive) return true
          }
          return false
        },
        { timeout: 60_000 }
      )
      .toBe(true)

    const sessionCard = await dashboardPage.getCardByTitle(/session keys/i)

    await expect(sessionCard).toBeVisible({ timeout: 60_000 })

    const createBtn = sessionCard.getByRole('button', { name: /create session key/i })
    await expect(createBtn).toBeVisible({ timeout: 30_000 })

    // Each visible key (truncated) is in this span
    const keySpans = sessionCard.locator('span.truncate.font-mono')

    // Ensure at least 2 session keys (create if missing)
    const ensureAtLeast = async (n: number) => {
      while ((await keySpans.count()) < n) {
        const before = await keySpans.count()
        await page.waitForTimeout(1000)
        await createBtn.click()
        await expect.poll(async () => await keySpans.count(), { timeout: 120_000 }).toBeGreaterThan(before)
      }
    }

    await ensureAtLeast(2)

    initialCount = await keySpans.count()
    expect(initialCount).toBeGreaterThanOrEqual(2)

    // Select the 2nd key for the revoke+delete flow
    const targetKeySpan = keySpans.nth(1)
    const targetKeyText = (await targetKeySpan.textContent())?.trim()
    expect(targetKeyText).toBeTruthy()

    // Row containing that key
    const targetRow = targetKeySpan.locator('xpath=ancestor::div[@data-slot="tooltip-trigger"][1]')
    await expect(targetRow).toBeVisible({ timeout: 30_000 })

    // Inside the row there is 1 button (X) initially.
    const rowButtons = targetRow.locator('button')
    await expect(rowButtons).toHaveCount(1, { timeout: 30_000 })

    // 1) Click on the X (revoke)
    await rowButtons.first().click()

    // The strikethrough (line-through) should appear on the text wrapper
    const struck = targetRow.locator('.line-through')
    await expect(struck).toBeVisible({ timeout: 60_000 })

    // 2) After revoking, the trash button appears

    const trashByClass = targetRow.locator('button:has(svg.lucide-trash)')
    let trashBtn = trashByClass

    if (!(await trashByClass.isVisible().catch(() => false))) {
      // fallback robust
      trashBtn = targetRow.locator('button').last()
    }

    await expect(trashBtn).toBeVisible({ timeout: 60_000 })
    await trashBtn.click()

    // 3) Confirm that the key disappears from the list
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
