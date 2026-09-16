import { ChainTypeEnum, EmbeddedState, type Openfort, RecoveryMethod } from '@openfort/openfort-js'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoreApi } from 'zustand/vanilla'
import { setActiveWallet } from '../../actions/setActiveWallet.js'
import type { OpenfortWalletConfig } from '../../components/Openfort/types.js'
import { useAutoRecovery } from '../../openfort/hooks/useAutoRecovery.js'
import type { OpenfortStore } from '../../openfort/store.js'
import { runEmbeddedSignerOperation } from '../../shared/utils/embeddedSignerOperationQueue.js'

/**
 * Recovery is requested from two places on a single login: the provider's
 * auto-recovery effect and the modal's recover page through `setActive`. Each
 * `embeddedWallet.recover()` derives its own credential, so on a passkey account
 * a second call is a second WebAuthn ceremony the user has to answer — the same
 * saved passkey, twice, to reach one signer.
 *
 * `recover` call count is the ceremony count. It stays at one whichever path
 * gets there first.
 */

const PASSKEY_ACCOUNT = {
  id: 'emb_passkey_1',
  address: 'GTt5JxXsq4bR4A9UaYbLtKM3wVfucbGpgcfCsojEz7c3',
  chainType: ChainTypeEnum.SVM,
  recoveryMethod: RecoveryMethod.PASSKEY,
  recoveryMethodDetails: { passkeyId: 'pk_stored' },
}

/** Client whose `get()` reports whatever its last successful `recover()` configured. */
function testClient(options: { onRecover?: () => Promise<void> } = {}) {
  let held: string | null = null
  const recover = vi.fn(async ({ account }: { account: string }) => {
    await options.onRecover?.()
    held = account
    return PASSKEY_ACCOUNT
  })
  const get = vi.fn(async () => {
    if (!held) throw new Error('No signer configured')
    return { id: held }
  })
  return {
    recover,
    get,
    client: {
      embeddedWallet: { recover, get },
      getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
      user: { get: vi.fn().mockResolvedValue({ id: 'usr_test_123' }) },
    } as unknown as Openfort,
  }
}

function testStore() {
  return {
    getState: () => ({
      embeddedAccounts: [PASSKEY_ACCOUNT],
      setEmbeddedState: vi.fn(),
      setRecoveryError: vi.fn(),
    }),
  } as unknown as StoreApi<OpenfortStore>
}

/** Drives the modal's path: the recover page calls `setActive`, which queues this. */
function recoverThroughModal(client: Openfort) {
  return runEmbeddedSignerOperation(client, ({ assertCurrent }) =>
    setActiveWallet({
      client,
      walletConfig: {} as OpenfortWalletConfig,
      account: PASSKEY_ACCOUNT as never,
      options: { recoveryMethod: RecoveryMethod.PASSKEY, passkeyId: 'pk_stored' },
      assertCurrent,
    })
  )
}

function renderAutoRecovery(client: Openfort) {
  return renderHook(() =>
    useAutoRecovery({
      storeEmbeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
      storeActiveEmbeddedAddress: PASSKEY_ACCOUNT.address,
      openfort: client,
      walletConfig: {} as OpenfortWalletConfig,
      store: testStore(),
    })
  )
}

describe('one recovery per login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('asks once when the modal requests the account auto-recovery is already recovering', async () => {
    // The first recovery is still waiting on the user — the state the modal's
    // recover page mounts in — when the second request is made.
    let answerPasskey!: () => void
    const passkeyDialog = new Promise<void>((resolve) => {
      answerPasskey = resolve
    })
    const { client, recover } = testClient({ onRecover: () => passkeyDialog })

    renderAutoRecovery(client)
    await waitFor(() => expect(recover).toHaveBeenCalledOnce())

    let modalResult!: Promise<{ needsRecovery: boolean }>
    act(() => {
      modalResult = recoverThroughModal(client)
    })
    answerPasskey()

    await act(async () => {
      expect(await modalResult).toEqual({ needsRecovery: false })
    })
    expect(recover).toHaveBeenCalledOnce()
  })

  it('asks once when auto-recovery follows a recovery the modal already completed', async () => {
    const { client, recover } = testClient()

    await act(async () => {
      expect(await recoverThroughModal(client)).toEqual({ needsRecovery: false })
    })
    expect(recover).toHaveBeenCalledOnce()

    renderAutoRecovery(client)
    await waitFor(() => expect(client.embeddedWallet.get).toHaveBeenCalled())
    expect(recover).toHaveBeenCalledOnce()
  })
})
