/**
 * On-chain read path, asserted against a local anvil fork.
 *
 * The playground's Write Contract card reads `balanceOf` over the chain's RPC
 * endpoint, which a fork run points at anvil. That makes the balance a function of
 * what this spec writes to the fork and nothing else — no faucet, no testnet
 * congestion, no rate-limited public node.
 *
 * Signing in still goes through live Openfort infrastructure; only the chain state
 * is local.
 */

import { FORK_CHAIN } from '../anvil/fork'
import { forkTokenBalance, mintOnFork, tokens } from '../anvil/token'
import { expect, test } from '../fixtures/test'

/** Whole tokens minted to the connected wallet, then expected back in the UI. */
const SEEDED_TOKENS = 7n

test.describe('on-chain balance (anvil fork)', () => {
  test('Write Contract balance reflects the forked chain', { tag: '@fork' }, async ({ page, dashboardPage }) => {
    test.setTimeout(240_000)

    await dashboardPage.ensureReady('evm')

    // The storage state carries the guest session (cookies + localStorage) but not
    // IndexedDB, where the embedded signer's key shares live — so the wallet is
    // created here, inside the spec.
    await test.step('create wallet (automatic)', async () => {
      const walletsCard = await dashboardPage.getCardByTitle(/^wallets$/i)

      const walletRow = walletsCard.locator('button').filter({ hasText: /0x[a-f0-9]{4,}\.\.\.[a-f0-9]{4,}/i })
      const rowsBefore = await walletRow.count()

      await walletsCard.getByRole('button', { name: /create new wallet/i }).click()
      await walletsCard.getByRole('button', { name: /smart account/i }).click()
      await walletsCard.getByRole('button', { name: /^automatic$/i }).click()

      await expect.poll(() => walletRow.count(), { timeout: 120_000 }).toBeGreaterThan(rowsBefore)
      // The header pill reads "Not connected" until the embedded signer is ready;
      // its disappearance is the connect signal (the "Connected with 0x…" welcome
      // line renders the last-known address even while disconnected).
      await expect(page.getByRole('button', { name: /not connected/i })).toBeHidden({ timeout: 60_000 })
    })

    const chainCard = await dashboardPage.getCardByTitle(/switch chain/i)
    const currentChain = chainCard
      .locator('p')
      .filter({ hasText: /^current chain:/i })
      .first()
    await expect(currentChain).toContainText(new RegExp(FORK_CHAIN.name, 'i'), { timeout: 90_000 })

    const address = await dashboardPage.connectedAddress()

    // The wallet is created per run, so at the pinned fork height it has never held
    // the token — the starting balance is exactly zero on chain and in the UI.
    expect(await forkTokenBalance(address)).toBe(0n)
    const writeCard = await dashboardPage.getCardByTitle(/write contract/i)
    await expect(writeCard.getByText(/^balance:\s*0$/i)).toBeVisible({ timeout: 60_000 })

    await mintOnFork(address, tokens(SEEDED_TOKENS))
    expect(await forkTokenBalance(address)).toBe(tokens(SEEDED_TOKENS))

    // Reload rather than waiting on a cache invalidation, so the assertion covers a
    // cold read of the seeded state.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await dashboardPage.expectLoaded('evm')

    // Active-account selection does not survive a reload (the store starts empty
    // and recovery picks an account from the API list), so re-activate the minted
    // wallet before reading its balance.
    const reloadedWallets = await dashboardPage.getCardByTitle(/^wallets$/i)
    const mintedRow = reloadedWallets
      .locator('button')
      .filter({ hasText: new RegExp(`${address.slice(0, 6)}.*${address.slice(-4)}`, 'i') })
      .first()
    await expect(mintedRow).toBeVisible({ timeout: 30_000 })
    await mintedRow.click()
    await expect.poll(() => dashboardPage.connectedAddress(), { timeout: 90_000 }).toBe(address)

    const reloadedCard = await dashboardPage.getCardByTitle(/write contract/i)
    await expect(reloadedCard.getByText(new RegExp(`^balance:\\s*${SEEDED_TOKENS}$`, 'i'))).toBeVisible({
      timeout: 60_000,
    })
  })
})
