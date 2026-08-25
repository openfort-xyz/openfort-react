import type { EmbeddedAccount } from '@openfort/openfort-js'
import { AccountTypeEnum, ChainTypeEnum, EmbeddedState, OpenfortEvents, RecoveryMethod } from '@openfort/openfort-js'
import type { Hex } from 'viem'
import type { Mock } from 'vitest'
import { vi } from 'vitest'

export const MOCK_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as Hex
export const MOCK_SOLANA_ADDRESS = '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs'
const MOCK_USER_ID = 'usr_test_123'
const MOCK_ACCESS_TOKEN = 'test-access-token'
export const MOCK_ENCRYPTION_SESSION = 'test-encryption-session'
const MOCK_CHAIN_ID = 80002

export function createMockEmbeddedAccount(overrides: Partial<EmbeddedAccount> = {}): EmbeddedAccount {
  return {
    id: 'emb_test_123',
    address: MOCK_ADDRESS,
    chainId: MOCK_CHAIN_ID,
    chainType: ChainTypeEnum.EVM,
    recoveryMethod: RecoveryMethod.AUTOMATIC,
    accountType: AccountTypeEnum.SMART_ACCOUNT,
    ownerAddress: MOCK_ADDRESS,
    createdAt: Date.now(),
    ...overrides,
  } as EmbeddedAccount
}

export function createMockSolanaEmbeddedAccount(overrides: Partial<EmbeddedAccount> = {}): EmbeddedAccount {
  return {
    id: 'emb_sol_test_123',
    address: MOCK_SOLANA_ADDRESS,
    chainType: ChainTypeEnum.SVM,
    recoveryMethod: RecoveryMethod.AUTOMATIC,
    accountType: AccountTypeEnum.EOA,
    createdAt: Date.now(),
    ...overrides,
  } as EmbeddedAccount
}

type MockClient = {
  embeddedWallet: {
    create: Mock
    list: Mock
    recover: Mock
    get: Mock
    getEmbeddedState: Mock
    getEthereumProvider: Mock
    signMessage: Mock
    setRecoveryMethod: Mock
    exportPrivateKey: Mock
  }
  user: {
    get: Mock
  }
  getAccessToken: Mock
  auth: {
    logout: Mock
  }
}

/**
 * Creates a flat SDK stub whose calls resolve to fixture accounts.
 * Use when a test only needs the SDK to answer, not to drive state changes.
 */
export function createMockClient(): MockClient {
  return {
    embeddedWallet: {
      create: vi.fn().mockResolvedValue(createMockEmbeddedAccount()),
      list: vi.fn().mockResolvedValue([createMockEmbeddedAccount()]),
      recover: vi.fn().mockResolvedValue(createMockEmbeddedAccount()),
      get: vi.fn().mockResolvedValue(createMockEmbeddedAccount()),
      getEmbeddedState: vi.fn().mockResolvedValue(EmbeddedState.READY),
      getEthereumProvider: vi.fn().mockResolvedValue({ request: vi.fn().mockResolvedValue([]) }),
      signMessage: vi.fn().mockResolvedValue('mock-signature'),
      setRecoveryMethod: vi.fn().mockResolvedValue(undefined),
      exportPrivateKey: vi.fn().mockResolvedValue('0xprivatekey'),
    },
    user: {
      get: vi.fn().mockResolvedValue({
        id: MOCK_USER_ID,
        email: 'test@example.com',
        phoneNumber: undefined,
        linkedAccounts: [],
      }),
    },
    getAccessToken: vi.fn().mockResolvedValue(MOCK_ACCESS_TOKEN),
    auth: {
      logout: vi.fn().mockResolvedValue(undefined),
    },
  }
}

export function createMockWalletConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    createEncryptedSessionEndpoint: 'https://example.com/session',
    accountType: AccountTypeEnum.SMART_ACCOUNT,
    connectOnLogin: true,
    ethereum: {
      accountType: AccountTypeEnum.SMART_ACCOUNT,
    },
    ...overrides,
  }
}

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
  let connectionLostListener:
    | ((payload: { reason: 'rpc-timeout' | 'handshake-timeout' | 'iframe-reloaded' }) => void)
    | null = null

  const unwatchFn = vi.fn()

  const client = {
    eventEmitter: {
      on: vi.fn((event: OpenfortEvents, listener: typeof connectionLostListener) => {
        if (event === OpenfortEvents.ON_EMBEDDED_WALLET_CONNECTION_LOST) connectionLostListener = listener
      }),
      off: vi.fn((event: OpenfortEvents, listener: typeof connectionLostListener) => {
        if (event === OpenfortEvents.ON_EMBEDDED_WALLET_CONNECTION_LOST && connectionLostListener === listener) {
          connectionLostListener = null
        }
      }),
    },
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
      linkPhoneOtp: vi.fn(),
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
      emitConnectionLost(reason: 'rpc-timeout' | 'handshake-timeout' | 'iframe-reloaded') {
        connectionLostListener?.({ reason })
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
        connectionLostListener = null
        unwatchFn.mockClear()
        for (const ns of [client.embeddedWallet, client.auth, client.user, client.eventEmitter]) {
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
