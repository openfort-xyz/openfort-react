import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../../utils/logger.js'

const h = vi.hoisted(() => ({
  verifyEmail: vi.fn(),
  storeCredentials: vi.fn(),
}))

vi.mock('./useEmailAuth.js', () => ({
  useEmailAuth: () => ({
    verifyEmail: h.verifyEmail,
    isSuccess: false,
    isLoading: false,
    isError: false,
    error: undefined,
  }),
}))

vi.mock('./useOAuth.js', () => ({
  useOAuth: () => ({
    storeCredentials: h.storeCredentials,
    isSuccess: false,
    isLoading: false,
    isError: false,
    error: undefined,
  }),
}))

const { useAuthCallback } = await import('./useAuthCallback.js')

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('useAuthCallback credential cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.head.querySelectorAll('meta[name="referrer"]').forEach((meta) => {
      meta.remove()
    })
    window.history.replaceState({}, '', '/')
  })

  it('captures OAuth credentials and cleans the URL before credential storage settles', async () => {
    const storage = deferred<unknown>()
    h.storeCredentials.mockReturnValueOnce(storage.promise)
    window.history.replaceState(
      { preserved: true },
      '',
      '/callback?openfortAuthProvider=google&access_token=oauth-secret&user_id=player-id&keep=value'
    )
    const replaceState = window.history.replaceState.bind(window.history)
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation((data, unused, url) => {
      expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer')
      replaceState(data, unused, url)
    })

    renderHook(() => useAuthCallback())

    const callbackUrl = new URL(window.location.href)
    expect(window.history.state).toEqual({ preserved: true })
    expect(callbackUrl.searchParams.has('user_id')).toBe(false)
    expect(callbackUrl.searchParams.has('access_token')).toBe(false)
    expect(callbackUrl.searchParams.has('openfortAuthProvider')).toBe(false)
    expect(callbackUrl.searchParams.get('keep')).toBe('value')
    expect(document.querySelector('meta[name="referrer"]')).toBeNull()
    expect(h.storeCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'player-id', token: 'oauth-secret' })
    )

    await act(async () => {
      storage.resolve({})
      await storage.promise
    })
    replaceStateSpy.mockRestore()
  })

  it('captures email credentials and cleans the URL before verification settles', async () => {
    const verification = deferred<unknown>()
    h.verifyEmail.mockReturnValueOnce(verification.promise)
    window.history.replaceState(
      { preserved: true },
      '',
      '/callback?openfortAuthProvider=email&state=verification-secret&email=user%40example.com&keep=value'
    )

    renderHook(() => useAuthCallback())

    const callbackUrl = new URL(window.location.href)
    expect(window.history.state).toEqual({ preserved: true })
    expect(callbackUrl.searchParams.has('state')).toBe(false)
    expect(callbackUrl.searchParams.has('email')).toBe(false)
    expect(callbackUrl.searchParams.has('openfortAuthProvider')).toBe(false)
    expect(callbackUrl.searchParams.get('keep')).toBe('value')
    expect(document.querySelector('meta[name="referrer"]')).toBeNull()
    expect(h.verifyEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com', state: 'verification-secret' })
    )

    await act(async () => {
      verification.resolve({})
      await verification.promise
    })
  })

  it.each([
    ['TOKEN_EXPIRED', 'This verification link has expired. Request a new one.'],
    ['INVALID_TOKEN', 'This verification link is not valid. Request a new one.'],
    ['USER_NOT_FOUND', 'No account matches this verification link.'],
    ['INVALID_USER', 'This verification link belongs to a different account.'],
  ])('fails a rejected verification callback carrying error=%s', (code, message) => {
    const onError = vi.fn()
    const onSuccess = vi.fn()
    window.history.replaceState(
      {},
      '',
      `/callback?openfortAuthProvider=email&email=user%40example.com&error=${code}&keep=value`
    )

    const { result } = renderHook(() => useAuthCallback({ onError, onSuccess }))

    expect(result.current.isSuccess).toBe(false)
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toMatchObject({ name: 'AuthenticationError', shortMessage: message })
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledOnce()
    expect(h.verifyEmail).not.toHaveBeenCalled()
    expect(h.storeCredentials).not.toHaveBeenCalled()

    const callbackUrl = new URL(window.location.href)
    expect(callbackUrl.searchParams.has('error')).toBe(false)
    expect(callbackUrl.searchParams.has('email')).toBe(false)
    expect(callbackUrl.searchParams.get('keep')).toBe('value')
  })

  it('reports an unrecognised callback error code instead of signalling success', () => {
    const onSuccess = vi.fn()
    window.history.replaceState({}, '', '/callback?openfortAuthProvider=email&email=user%40example.com&error=SOMETHING')

    const { result } = renderHook(() => useAuthCallback({ onSuccess }))

    expect(result.current.isSuccess).toBe(false)
    expect(result.current.error).toMatchObject({
      shortMessage: 'Authentication callback failed (SOMETHING).',
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('reports a rejected OAuth callback carrying an error instead of a missing-token failure', () => {
    const onError = vi.fn()
    window.history.replaceState({}, '', '/callback?openfortAuthProvider=google&error=TOKEN_EXPIRED')

    const { result } = renderHook(() => useAuthCallback({ onError }))

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toMatchObject({
      shortMessage: 'This verification link has expired. Request a new one.',
    })
    expect(h.storeCredentials).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledOnce()
  })

  it('reports a verification callback with no state as unconfirmed', () => {
    const onSuccess = vi.fn()
    window.history.replaceState({}, '', '/callback?openfortAuthProvider=email&email=user%40example.com')

    const { result } = renderHook(() => useAuthCallback({ onSuccess }))

    expect(result.current.isSuccess).toBe(true)
    expect(result.current.email).toBe('user@example.com')
    expect(h.verifyEmail).not.toHaveBeenCalled()
    // No token was exchanged, so anyone able to open the URL could reproduce
    // this. The consumer has to be able to tell that apart from a real receipt.
    expect(onSuccess).toHaveBeenCalledWith({ email: 'user@example.com', type: 'verifyEmail', confirmed: false })
  })

  it('reports a verification callback that carried a state token as confirmed', async () => {
    const onSuccess = vi.fn()
    const verification = deferred<unknown>()
    h.verifyEmail.mockReturnValueOnce(verification.promise)
    window.history.replaceState(
      {},
      '',
      '/callback?openfortAuthProvider=email&state=verification-secret&email=user%40example.com'
    )

    renderHook(() => useAuthCallback({ onSuccess }))

    // `verifyEmail` is mocked wholesale here, so it never runs the callbacks it
    // is handed. Drive the one it was given to see what the consumer receives.
    const passedOptions = h.verifyEmail.mock.calls[0]?.[0] as { onSuccess: (data: unknown) => void }
    passedOptions.onSuccess({ email: 'user@example.com' })

    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ type: 'verifyEmail', confirmed: true }))

    await act(async () => {
      verification.resolve({})
      await verification.promise
    })
  })

  it('removes an access token when the callback is missing its user id', async () => {
    const onError = vi.fn()
    window.history.replaceState({}, '', '/callback?openfortAuthProvider=google&access_token=oauth-secret&keep=value')

    const { result } = renderHook(() => useAuthCallback({ onError }))

    const callbackUrl = new URL(window.location.href)
    expect(callbackUrl.searchParams.has('access_token')).toBe(false)
    expect(callbackUrl.searchParams.has('openfortAuthProvider')).toBe(false)
    expect(callbackUrl.searchParams.get('keep')).toBe('value')
    expect(onError).toHaveBeenCalledOnce()
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toMatchObject({
      name: 'AuthenticationError',
      shortMessage: 'Missing user id or access token.',
    })
    expect(h.storeCredentials).not.toHaveBeenCalled()
    expect(document.querySelector('meta[name="referrer"]')).toBeNull()
  })

  it('reports an email callback that carries no email address', () => {
    const onError = vi.fn()
    window.history.replaceState({}, '', '/callback?openfortAuthProvider=email&state=verification-secret')

    const { result } = renderHook(() => useAuthCallback({ onError }))

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toMatchObject({
      name: 'AuthenticationError',
      shortMessage: 'No email found in URL.',
    })
    expect(onError).toHaveBeenCalledOnce()
    expect(h.verifyEmail).not.toHaveBeenCalled()
    expect(new URL(window.location.href).searchParams.has('state')).toBe(false)
  })

  it('cleans every callback field and reports an unknown provider without invoking authentication', () => {
    const onError = vi.fn()
    window.history.replaceState(
      { preserved: true },
      '',
      '/callback?keep=value&openfortAuthProvider=unknown&access_token=oauth-secret&refresh_token=refresh-secret&user_id=user-id&player_id=player-id&state=state-secret&email=user%40example.com'
    )

    const { result } = renderHook(() => useAuthCallback({ onError }))

    const callbackUrl = new URL(window.location.href)
    expect(window.history.state).toEqual({ preserved: true })
    expect(callbackUrl.searchParams.get('keep')).toBe('value')
    for (const key of [
      'openfortAuthProvider',
      'access_token',
      'refresh_token',
      'user_id',
      'player_id',
      'state',
      'email',
    ]) {
      expect(callbackUrl.searchParams.has(key)).toBe(false)
    }
    expect(h.storeCredentials).not.toHaveBeenCalled()
    expect(h.verifyEmail).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledOnce()
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toMatchObject({
      name: 'AuthenticationError',
      shortMessage: 'Unsupported authentication callback provider "unknown".',
    })
    expect(document.querySelector('meta[name="referrer"]')).toBeNull()
  })

  it('preserves host OAuth parameters when the Openfort callback marker is absent', () => {
    window.history.replaceState(
      { preserved: true },
      '',
      '/callback?access_token=host-token&refresh_token=host-refresh&user_id=host-user&player_id=host-player&state=host-state&email=user%40example.com&keep=value'
    )

    renderHook(() => useAuthCallback())

    const url = new URL(window.location.href)
    expect(window.history.state).toEqual({ preserved: true })
    expect(url.searchParams.get('access_token')).toBe('host-token')
    expect(url.searchParams.get('refresh_token')).toBe('host-refresh')
    expect(url.searchParams.get('user_id')).toBe('host-user')
    expect(url.searchParams.get('player_id')).toBe('host-player')
    expect(url.searchParams.get('state')).toBe('host-state')
    expect(url.searchParams.get('email')).toBe('user@example.com')
    expect(url.searchParams.get('keep')).toBe('value')
    expect(h.storeCredentials).not.toHaveBeenCalled()
    expect(h.verifyEmail).not.toHaveBeenCalled()
    expect(document.querySelector('meta[name="referrer"]')).toBeNull()
  })

  it('restores an existing referrer policy after synchronous capture', () => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'strict-origin'
    document.head.appendChild(meta)
    window.history.replaceState({}, '', '/callback?openfortAuthProvider=unknown&access_token=oauth-secret')

    renderHook(() => useAuthCallback())

    expect(meta.isConnected).toBe(true)
    expect(meta.content).toBe('strict-origin')
  })

  it('reports asynchronous credential-storage rejection after the URL is clean', async () => {
    h.storeCredentials.mockRejectedValueOnce(new Error('credential storage failed'))
    window.history.replaceState(
      {},
      '',
      '/callback?openfortAuthProvider=google&access_token=oauth-secret&user_id=player-id'
    )

    const { result } = renderHook(() => useAuthCallback())

    expect(new URL(window.location.href).searchParams.has('access_token')).toBe(false)
    await waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to process authentication callback',
        expect.objectContaining({ name: 'AuthenticationError', details: 'credential storage failed' })
      )
    )
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toMatchObject({ name: 'AuthenticationError', details: 'credential storage failed' })
  })
})
