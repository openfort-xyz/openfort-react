import path from 'node:path'
import { expect, test } from '@playwright/test'
import { setPlaygroundMode } from '../utils/mode.js'

const sdkSource = path.resolve(import.meta.dirname, '../../../../packages/openfort-react/src')
const actionUrls = {
  create: `/@fs${path.join(sdkSource, 'actions/createEmbeddedWallet.ts')}`,
  fundingProviderUrl: `/@fs${path.join(sdkSource, 'utils/fundingProviderUrl.ts')}`,
  importWallet: `/@fs${path.join(sdkSource, 'actions/importEmbeddedWallet.ts')}`,
  setActive: `/@fs${path.join(sdkSource, 'actions/setActiveWallet.ts')}`,
}

test.beforeEach(async ({ page }) => {
  await setPlaygroundMode(page, 'evm')
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort('blockedbyclient'))
})

test('browser-loaded SDK code rejects executable and attacker funding URLs', async ({ page }) => {
  await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })

  const results = await page.evaluate(async (moduleUrl) => {
    const { getTrustedFundingProviderUrl } = await import(moduleUrl)
    const candidates = [
      ['coinbase', 'https://pay.coinbase.com/buy/select-asset?sessionToken=browser-test-session'],
      ['stripe', 'https://crypto.link.com?client_secret=browser-test-secret'],
      ['coinbase', 'javascript:alert(document.domain)'],
      ['coinbase', 'https://pay.coinbase.com.attacker.example/buy'],
      ['stripe', 'http://crypto.link.com/session'],
    ] as const

    return candidates.map(([provider, value]) => {
      try {
        return { provider, trusted: true, url: getTrustedFundingProviderUrl(value, provider).href }
      } catch (error) {
        return { provider, trusted: false, errorName: error instanceof Error ? error.name : 'unknown' }
      }
    })
  }, actionUrls.fundingProviderUrl)

  expect(results).toEqual([
    {
      provider: 'coinbase',
      trusted: true,
      url: 'https://pay.coinbase.com/buy/select-asset?sessionToken=browser-test-session',
    },
    {
      provider: 'stripe',
      trusted: true,
      url: 'https://crypto.link.com/?client_secret=browser-test-secret',
    },
    { provider: 'coinbase', trusted: false, errorName: 'FundingError' },
    { provider: 'coinbase', trusted: false, errorName: 'FundingError' },
    { provider: 'stripe', trusted: false, errorName: 'FundingError' },
  ])
})

test('session invalidation prevents browser-side create, import, and recover mutations', async ({ page }) => {
  await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })

  const results = await page.evaluate(async (urls) => {
    const [{ createEmbeddedWallet }, { importEmbeddedWallet }, { setActiveWallet }] = await Promise.all([
      import(urls.create),
      import(urls.importWallet),
      import(urls.setActive),
    ])

    const runGuarded = async (
      operation: (context: {
        client: Record<string, unknown>
        walletConfig: Record<string, unknown>
        assertCurrent: () => void
      }) => Promise<unknown>
    ) => {
      let resolveSession!: (session: string) => void
      let signalRequested!: () => void
      const requested = new Promise<void>((resolve) => {
        signalRequested = resolve
      })
      const session = new Promise<string>((resolve) => {
        resolveSession = resolve
      })
      let current = true
      let mutations = 0
      const client = {
        getAccessToken: async () => 'browser-test-access-token',
        user: { get: async () => ({ id: 'browser-test-user' }) },
        embeddedWallet: {
          create: async () => {
            mutations += 1
          },
          import: async () => {
            mutations += 1
          },
          recover: async () => {
            mutations += 1
          },
        },
      }
      const walletConfig = {
        getEncryptionSession: () => {
          signalRequested()
          return session
        },
      }
      const assertCurrent = () => {
        if (!current) throw new Error('The browser test invalidated this signer session.')
      }

      const pending = operation({ client, walletConfig, assertCurrent }).then(
        () => 'resolved',
        () => 'rejected'
      )
      await requested
      current = false
      resolveSession('browser-test-encryption-session')
      return { outcome: await pending, mutations }
    }

    const evmAccount = {
      id: 'browser-test-wallet',
      address: '0x0000000000000000000000000000000000000001',
      chainType: 'EVM',
      recoveryMethod: 'automatic',
    }
    const solanaAccount = {
      id: 'browser-test-solana-wallet',
      address: '11111111111111111111111111111111',
      chainType: 'SVM',
      recoveryMethod: 'automatic',
    }
    const shared = (chainType: 'EVM' | 'SVM') => ({
      chainType,
      accountRequest: chainType === 'EVM' ? { accountType: 'Externally Owned Account' } : {},
      recovery: undefined,
      shouldPublish: () => true,
      setActiveEmbeddedAddress: () => {},
      updateEmbeddedAccounts: async () => [],
    })

    return Promise.all([
      runGuarded(({ client, walletConfig, assertCurrent }) =>
        createEmbeddedWallet({ ...shared('EVM'), client, walletConfig, assertCurrent })
      ),
      runGuarded(({ client, walletConfig, assertCurrent }) =>
        importEmbeddedWallet({
          ...shared('EVM'),
          client,
          walletConfig,
          assertCurrent,
          privateKey: 'browser-test-private-key',
        })
      ),
      runGuarded(({ client, walletConfig, assertCurrent }) =>
        setActiveWallet({ client, walletConfig, assertCurrent, account: evmAccount, options: {} })
      ),
      runGuarded(({ client, walletConfig, assertCurrent }) =>
        createEmbeddedWallet({ ...shared('SVM'), client, walletConfig, assertCurrent })
      ),
      runGuarded(({ client, walletConfig, assertCurrent }) =>
        importEmbeddedWallet({
          ...shared('SVM'),
          client,
          walletConfig,
          assertCurrent,
          privateKey: 'browser-test-solana-private-key',
        })
      ),
      runGuarded(({ client, walletConfig, assertCurrent }) =>
        setActiveWallet({ client, walletConfig, assertCurrent, account: solanaAccount, options: {} })
      ),
    ])
  }, actionUrls)

  expect(results).toEqual([
    { outcome: 'rejected', mutations: 0 },
    { outcome: 'rejected', mutations: 0 },
    { outcome: 'rejected', mutations: 0 },
    { outcome: 'rejected', mutations: 0 },
    { outcome: 'rejected', mutations: 0 },
    { outcome: 'rejected', mutations: 0 },
  ])
})

test('OAuth callback credentials are removed from the visible URL', async ({ page }) => {
  await page.goto(
    '/showcase/auth?openfortAuthProviderUI=google&user_id=browser-test-user&access_token=browser-test-access-token',
    { waitUntil: 'domcontentloaded' }
  )

  await expect.poll(() => new URL(page.url()).searchParams.has('access_token')).toBe(false)
  const currentUrl = new URL(page.url())
  expect(currentUrl.searchParams.has('user_id')).toBe(false)
  expect(currentUrl.searchParams.has('openfortAuthProviderUI')).toBe(false)
})

test('modal navigation makes the outgoing page hidden and inert immediately', async ({ page }) => {
  await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })
  const landingCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: /connect to start/i })
    .first()
  await landingCard.getByRole('button', { name: /^connect wallet$/i }).click()
  const email = page.getByPlaceholder('your@email.com')
  await expect(email).toBeVisible()

  // Any in-modal navigation will do; the wallet list is the one reachable without network.
  await page.getByRole('button', { name: /^connect your wallet$/i }).click()

  const outgoing = email.locator('xpath=ancestor::*[@aria-hidden="true" and @inert][1]')
  await expect(outgoing).toHaveCount(1)
  await expect(email).toBeHidden()
})

test('rapid modal reversal restores the active page Back ownership', async ({ page }) => {
  await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })
  const landingCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: /connect to start/i })
    .first()
  await landingCard.getByRole('button', { name: /^connect wallet$/i }).click()

  const email = page.getByPlaceholder('your@email.com')
  await expect(email).toBeVisible()
  // Any in-modal navigation will do; the wallet list is the one reachable without network.
  await page.getByRole('button', { name: /^connect your wallet$/i }).click()

  const back = page.getByRole('button', { name: /^back$/i })
  await expect(back).toBeVisible()
  await back.click()
  await expect(email).toBeVisible()
  await expect(back).toBeHidden()
})
