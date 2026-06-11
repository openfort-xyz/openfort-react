import { EmbeddedState } from '@openfort/openfort-js'
import { vi } from 'vitest'

type OnChange = (state: EmbeddedState, prevState?: EmbeddedState) => void
type OnError = (error: Error) => void

/**
 * Creates a mock Openfort SDK instance with vi.fn() stubs.
 * Includes `_test` helpers to simulate state changes from tests.
 */
export function createMockOpenfortClient() {
  let currentOnChange: OnChange | null = null
  let currentOnError: OnError | null = null
  let currentState = EmbeddedState.NONE

  const unwatchFn = vi.fn()

  const client = {
    embeddedWallet: {
      watchEmbeddedState: vi.fn((params: { onChange: OnChange; onError?: OnError }) => {
        currentOnChange = params.onChange
        currentOnError = params.onError ?? null
        // Simulate immediate emission like the real SDK
        params.onChange(currentState, undefined)
        return unwatchFn
      }),
      getEmbeddedState: vi.fn(async () => currentState),
      list: vi.fn(async () => []),
      get: vi.fn(async () => null),
      create: vi.fn(),
      recover: vi.fn(),
      getEthereumProvider: vi.fn(async () => ({ request: vi.fn().mockResolvedValue([]) })),
      signMessage: vi.fn(),
      exportPrivateKey: vi.fn(),
      setRecoveryMethod: vi.fn(),
    },
    auth: {
      logout: vi.fn(async () => {}),
      signUpGuest: vi.fn(async () => ({})),
    },
    user: {
      get: vi.fn(async () => ({
        id: 'usr_test-user-id',
        linkedAccounts: [],
      })),
    },
    getAccessToken: vi.fn(async () => 'mock-access-token'),
    validateAndRefreshToken: vi.fn(async () => {}),

    /** Test-only helpers — not part of real SDK */
    _test: {
      get unwatchFn() {
        return unwatchFn
      },
      /** Simulate an embedded state change (triggers onChange) */
      setEmbeddedState(state: EmbeddedState) {
        const prev = currentState
        currentState = state
        currentOnChange?.(state, prev)
      },
      /** Simulate a watcher error (triggers onError) */
      emitError(error: Error) {
        currentOnError?.(error)
      },
      /** Get the current internal state */
      get currentState() {
        return currentState
      },
      /** Reset all mocks */
      reset() {
        currentState = EmbeddedState.NONE
        currentOnChange = null
        currentOnError = null
        unwatchFn.mockClear()
        for (const ns of [client.embeddedWallet, client.auth, client.user]) {
          for (const val of Object.values(ns)) {
            if (typeof val === 'function' && 'mockClear' in val) {
              ;(val as ReturnType<typeof vi.fn>).mockClear()
            }
          }
        }
      },
    },
  }

  return client
}

export type MockOpenfortClient = ReturnType<typeof createMockOpenfortClient>
