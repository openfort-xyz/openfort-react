import path from 'node:path'
import { expect, test } from '@playwright/test'
import { setPlaygroundMode } from '../utils/mode.js'

/**
 * Executable evidence for the hardening-branch review. Each test states the
 * behaviour a consumer is entitled to; a failure here is the defect, not a
 * broken test. Runs offline against browser-loaded SDK source, so it needs no
 * credentials and no live Openfort project.
 */

const sdkSource = path.resolve(import.meta.dirname, '../../../../packages/openfort-react/src')
const moduleUrls = {
  errorHandling: `/@fs${path.join(sdkSource, 'utils/errorHandling.ts')}`,
  logger: `/@fs${path.join(sdkSource, 'utils/logger.ts')}`,
}

test.beforeEach(async ({ page }) => {
  await setPlaygroundMode(page, 'evm')
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort('blockedbyclient'))
})

test.describe('logger', () => {
  test('an Error logged alongside a message keeps its message and stack', async ({ page }) => {
    await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })

    // A sanitized Error keeps `message`/`stack` non-enumerable, exactly as a
    // native Error does, so JSON.stringify is the wrong probe — read the
    // properties a console and an error reporter actually render.
    const rendered = await page.evaluate(async (moduleUrl) => {
      const { logger } = await import(moduleUrl)
      const captured: unknown[][] = []
      // biome-ignore lint/suspicious/noConsole: capturing what the SDK writes to the console is the assertion.
      const original = console.error
      console.error = (...args: unknown[]) => captured.push(args)
      try {
        logger.error('signing failed', new Error('boom'))
      } finally {
        console.error = original
      }
      const logged = captured[0]?.[2] as Error | undefined
      return {
        isError: logged instanceof Error,
        message: logged?.message,
        stack: String(logged?.stack ?? ''),
      }
    }, moduleUrls.logger)

    // logger.warn/error now always emit, so this is what every consumer's
    // console and error reporter receives for ~57 SDK error sites.
    expect(rendered.isError).toBe(true)
    expect(rendered.message).toBe('boom')
    expect(rendered.stack).toContain('boom')
    expect(rendered.stack).not.toContain('[ACCESSOR]')
  })

  test('a Shield recovery share is redacted', async ({ page }) => {
    await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })

    const serialized = await page.evaluate(async (moduleUrl) => {
      const { logger } = await import(moduleUrl)
      const captured: unknown[][] = []
      // biome-ignore lint/suspicious/noConsole: capturing what the SDK writes to the console is the assertion.
      const original = console.error
      console.error = (...args: unknown[]) => captured.push(args)
      try {
        // `share` is the field name Shield returns the recovery share under.
        logger.error('recovery failed', { share: 'SHARE-MUST-NOT-LEAK' })
      } finally {
        console.error = original
      }
      return JSON.stringify(captured[0])
    }, moduleUrls.logger)

    expect(serialized).not.toContain('SHARE-MUST-NOT-LEAK')
  })

  test('a credential under an unlisted key name is redacted', async ({ page }) => {
    await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })

    const serialized = await page.evaluate(async (moduleUrl) => {
      const { logger } = await import(moduleUrl)
      const captured: unknown[][] = []
      // biome-ignore lint/suspicious/noConsole: capturing what the SDK writes to the console is the assertion.
      const original = console.error
      console.error = (...args: unknown[]) => captured.push(args)
      try {
        logger.error('auth failed', {
          sessionToken: 'LEAK-session',
          headers: { 'X-API-Key': 'LEAK-header' },
        })
      } finally {
        console.error = original
      }
      return JSON.stringify(captured[0])
    }, moduleUrls.logger)

    expect(serialized).not.toContain('LEAK-session')
    expect(serialized).not.toContain('LEAK-header')
  })
})

test.describe('transaction error classification', () => {
  /**
   * openfort-js throws `JsonRpcError extends Error` with a `code` field, and
   * rewrites the reason into `message` before wrapping it in -32603. Anything
   * less faithful than an Error subclass would not reach the text rules at all,
   * so these payloads mirror the real class.
   */
  const asJsonRpcError = `
    class JsonRpcError extends Error {
      constructor(code, message) { super(message); this.message = message; this.code = code }
    }
  `

  /** The four reasons openfort-js writes before wrapping a failure in -32603. */
  const wrappedByOpenfortJs = [
    { label: 'insufficient funds', message: 'Insufficient funds: the account does not have enough funds.' },
    { label: 'contract revert', message: 'Transaction reverted: the contract rejected this call.' },
    { label: 'nonce conflict', message: 'Nonce conflict: a transaction with this nonce is pending.' },
    { label: 'out of gas', message: 'Gas error: the transaction ran out of gas.' },
  ]

  for (const { label, message } of wrappedByOpenfortJs) {
    test(`-32603 wrapping ${label} reports its real cause`, async ({ page }) => {
      await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })

      const details = await page.evaluate(
        async ({ moduleUrl, payload, factory }) => {
          const { parseTransactionError } = await import(moduleUrl)
          // biome-ignore lint/security/noGlobalEval: constructing the real error class shape under test.
          const make = eval(`(() => { ${factory}; return (c, m) => new JsonRpcError(c, m) })()`)
          return parseTransactionError(make(-32603, payload))
        },
        { moduleUrl: moduleUrls.errorHandling, payload: message, factory: asJsonRpcError }
      )

      expect(details.title).not.toBe('Network error')
    })
  }

  /** geth's generic code, the shape a public RPC actually returns. */
  const gethErrors = [
    { message: 'insufficient funds for gas * price + value', expected: 'Insufficient funds' },
    { message: 'nonce too low', expected: 'pending' },
    { message: 'replacement transaction underpriced', expected: 'Gas fee' },
  ]

  for (const { message, expected } of gethErrors) {
    test(`-32000 "${message}" keeps its specific classification`, async ({ page }) => {
      await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })

      const details = await page.evaluate(
        async ({ moduleUrl, payload, factory }) => {
          const { parseTransactionError } = await import(moduleUrl)
          // biome-ignore lint/security/noGlobalEval: constructing the real error class shape under test.
          const make = eval(`(() => { ${factory}; return (c, m) => new JsonRpcError(c, m) })()`)
          return parseTransactionError(make(-32000, payload))
        },
        { moduleUrl: moduleUrls.errorHandling, payload: message, factory: asJsonRpcError }
      )

      expect(`${details.title} ${details.message}`).toContain(expected)
    })
  }
})

test.describe('auth callback URL handling', () => {
  test('an unknown verification error code does not crash the app', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    // `error` is attacker-controlled: it arrives on the callback URL.
    // `__proto__` reaches Object.prototype through the error-code lookup.
    await page.goto('/showcase/auth?openfortEmailVerificationUI=true&email=a%40b.com&error=__proto__', {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForTimeout(2000)

    expect(pageErrors).toEqual([])
  })

  test('a refresh token is stripped from the address bar', async ({ page }) => {
    await page.goto(
      '/showcase/auth?openfortAuthProviderUI=google&user_id=usr_1&access_token=at_1&refresh_token=rt_SECRET',
      { waitUntil: 'domcontentloaded' }
    )
    await page.waitForTimeout(3000)

    const url = new URL(page.url())
    expect(url.searchParams.has('refresh_token')).toBe(false)
    expect(page.url()).not.toContain('rt_SECRET')
  })
})
