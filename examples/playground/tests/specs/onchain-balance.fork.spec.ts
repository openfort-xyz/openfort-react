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

    const reloadedCard = await dashboardPage.getCardByTitle(/write contract/i)
    await expect(reloadedCard.getByText(new RegExp(`^balance:\\s*${SEEDED_TOKENS}$`, 'i'))).toBeVisible({
      timeout: 60_000,
    })
  })
})
