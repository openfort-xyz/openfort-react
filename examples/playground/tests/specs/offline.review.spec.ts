import path from 'node:path'
import type { Page } from '@playwright/test'
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
  test.beforeEach(async ({ page }) => {
    await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })
  })

  /** Serializes whatever `logger.error` wrote to the console for one payload. */
  const captureLoggedPayload = (page: Page, payload: Record<string, unknown>) =>
    page.evaluate(
      async ({ moduleUrl, logged }) => {
        const { logger } = await import(moduleUrl)
        const captured: unknown[][] = []
        // biome-ignore lint/suspicious/noConsole: capturing what the SDK writes to the console is the assertion.
        const original = console.error
        console.error = (...args: unknown[]) => captured.push(args)
        try {
          logger.error('operation failed', logged)
        } finally {
          console.error = original
        }
        return JSON.stringify(captured[0])
      },
      { moduleUrl: moduleUrls.logger, logged: payload }
    )

  test('an Error logged alongside a message keeps its message and stack', async ({ page }) => {
    // A sanitized Error keeps `message`/`stack` non-enumerable, exactly as a
    // native Error does, so JSON.stringify is the wrong probe — read the
    // properties a console and an error reporter actually render. The Error is
    // built in the page because it cannot survive serialization into it.
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
    // `share` is the field name Shield returns the recovery share under.
    const serialized = await captureLoggedPayload(page, { share: 'SHARE-MUST-NOT-LEAK' })

    expect(serialized).not.toContain('SHARE-MUST-NOT-LEAK')
  })

  test('a credential under an unlisted key name is redacted', async ({ page }) => {
    const serialized = await captureLoggedPayload(page, {
      sessionToken: 'LEAK-session',
      headers: { 'X-API-Key': 'LEAK-header' },
    })

    expect(serialized).not.toContain('LEAK-session')
    expect(serialized).not.toContain('LEAK-header')
  })
})

test.describe('transaction error classification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/showcase/auth', { waitUntil: 'domcontentloaded' })
  })

  /**
   * Classifies a payload shaped like the error openfort-js actually throws:
   * `JsonRpcError extends Error` with a `code` field and the real reason
   * rewritten into `message`. Anything less faithful than an Error subclass
   * would not reach the text rules at all.
   */
  const classify = (page: Page, code: number, message: string) =>
    page.evaluate(
      async ({ moduleUrl, payload }) => {
        const { parseTransactionError } = await import(moduleUrl)
        class JsonRpcError extends Error {
          code: number
          constructor(errorCode: number, errorMessage: string) {
            super(errorMessage)
            this.message = errorMessage
            this.code = errorCode
          }
        }
        return parseTransactionError(new JsonRpcError(payload.code, payload.message))
      },
      { moduleUrl: moduleUrls.errorHandling, payload: { code, message } }
    )

  /** The four reasons openfort-js writes before wrapping a failure in -32603. */
  const wrappedByOpenfortJs = [
    { label: 'insufficient funds', message: 'Insufficient funds: the account does not have enough funds.' },
    { label: 'contract revert', message: 'Transaction reverted: the contract rejected this call.' },
    { label: 'nonce conflict', message: 'Nonce conflict: a transaction with this nonce is pending.' },
    { label: 'out of gas', message: 'Gas error: the transaction ran out of gas.' },
  ]

  for (const { label, message } of wrappedByOpenfortJs) {
    test(`-32603 wrapping ${label} reports its real cause`, async ({ page }) => {
      const details = await classify(page, -32603, message)

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
      const details = await classify(page, -32000, message)

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

    // The callback runs on mount; wait for the page to settle rather than for a
    // fixed interval, then assert nothing threw while it did.
    await expect(page.locator('body')).toBeVisible()
    await expect.poll(() => pageErrors, { timeout: 5000, intervals: [250] }).toEqual([])
  })

  test('a refresh token is stripped from the address bar', async ({ page }) => {
    await page.goto(
      '/showcase/auth?openfortAuthProviderUI=google&user_id=usr_1&access_token=at_1&refresh_token=rt_SECRET',
      { waitUntil: 'domcontentloaded' }
    )

    // The strip happens in a replaceState once the callback has read the params.
    await expect.poll(() => page.url(), { timeout: 10_000 }).not.toContain('rt_SECRET')
    expect(new URL(page.url()).searchParams.has('refresh_token')).toBe(false)
  })
})
