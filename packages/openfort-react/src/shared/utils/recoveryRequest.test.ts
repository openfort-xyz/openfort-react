import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequestError } from '../../errors/operation.js'
import { fetchRecoveryRequest } from './recoveryRequest.js'

describe('fetchRecoveryRequest', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('aborts and rejects with a typed error when the request never settles', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined
        return new Promise<Response>(() => undefined)
      })
    )

    const request = fetchRecoveryRequest('https://example.com/recovery', { method: 'POST' }, 'Recover wallet')
    const rejection = expect(request).rejects.toMatchObject({
      name: 'ApiRequestError',
      body: 'Timed out after 15000ms.',
    } satisfies Partial<ApiRequestError>)

    await vi.advanceTimersByTimeAsync(15_000)

    await rejection
    expect(signal?.aborted).toBe(true)
  })

  it('returns the response and clears the timeout after success', async () => {
    vi.useFakeTimers()
    const response = new Response(null, { status: 204 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await expect(fetchRecoveryRequest('https://example.com/recovery', {}, 'Recover wallet')).resolves.toBe(response)
    expect(vi.getTimerCount()).toBe(0)
  })
})
