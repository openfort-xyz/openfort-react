import { ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAutoRecovery } from '../../openfort/hooks/useAutoRecovery.js'

const PASSKEY_ACCOUNT = {
  id: 'emb_passkey_1',
  address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  chainType: ChainTypeEnum.EVM,
  recoveryMethod: RecoveryMethod.PASSKEY,
  recoveryMethodDetails: { passkeyId: 'pk_stored' },
}

const OTHER_ACCOUNT = { ...PASSKEY_ACCOUNT, id: 'emb_passkey_2' }

/** Client whose signer is configured for `configured`, or for nothing when omitted. */
function testClient(configured?: { id: string }) {
  return {
    embeddedWallet: {
      recover: vi.fn().mockResolvedValue(PASSKEY_ACCOUNT),
      get: configured
        ? vi.fn().mockResolvedValue(configured)
        : vi.fn().mockRejectedValue(new Error('No signer configured')),
    },
    getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
    user: { get: vi.fn().mockResolvedValue({ id: 'usr_test_123' }) },
  }
}

function testStore() {
  const setRecoveryError = vi.fn()
  const setEmbeddedState = vi.fn()
  return {
    setRecoveryError,
    setEmbeddedState,
    store: {
      getState: () => ({ embeddedAccounts: [PASSKEY_ACCOUNT], setRecoveryError, setEmbeddedState }),
    },
  }
}

function renderAutoRecovery(client: ReturnType<typeof testClient>, store: ReturnType<typeof testStore>['store']) {
  return renderHook(() =>
    useAutoRecovery({
      storeEmbeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
      storeActiveEmbeddedAddress: PASSKEY_ACCOUNT.address,
      openfort: client as never,
      walletConfig: {} as never,
      store: store as never,
    })
  )
}

describe('useAutoRecovery', () => {
  it('recovers the active account when no signer is configured', async () => {
    const client = testClient()
    const { store, setEmbeddedState } = testStore()

    renderAutoRecovery(client, store)

    await waitFor(() => expect(client.embeddedWallet.recover).toHaveBeenCalledOnce())
    expect(client.embeddedWallet.recover).toHaveBeenCalledWith({
      account: PASSKEY_ACCOUNT.id,
      recoveryParams: { recoveryMethod: RecoveryMethod.PASSKEY, passkeyInfo: { passkeyId: 'pk_stored' } },
    })
    await waitFor(() => expect(setEmbeddedState).toHaveBeenCalledWith(EmbeddedState.READY))
  })

  it('does not recover an account the signer already holds', async () => {
    const client = testClient(PASSKEY_ACCOUNT)
    const { store, setEmbeddedState } = testStore()

    renderAutoRecovery(client, store)

    await waitFor(() => expect(setEmbeddedState).toHaveBeenCalledWith(EmbeddedState.READY))
    expect(client.embeddedWallet.recover).not.toHaveBeenCalled()
  })

  it('recovers when the signer holds a different account', async () => {
    const client = testClient(OTHER_ACCOUNT)
    const { store } = testStore()

    renderAutoRecovery(client, store)

    await waitFor(() => expect(client.embeddedWallet.recover).toHaveBeenCalledOnce())
  })
})
