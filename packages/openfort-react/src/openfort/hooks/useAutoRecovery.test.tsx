import { ChainTypeEnum, EmbeddedState, type Openfort, RecoveryMethod } from '@openfort/openfort-js'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoreApi } from 'zustand/vanilla'
import type { OpenfortWalletConfig } from '../../components/Openfort/types.js'
import {
  invalidateEmbeddedSignerOperations,
  runEmbeddedSignerOperation,
} from '../../shared/utils/embeddedSignerOperationQueue.js'
import type { OpenfortStore } from '../store.js'

const mockBuildRecoveryParams = vi.hoisted(() => vi.fn().mockResolvedValue({ recoveryMethod: 'automatic' }))

vi.mock('../../shared/utils/recovery.js', () => ({
  buildRecoveryParams: mockBuildRecoveryParams,
}))

const { useAutoRecovery } = await import('./useAutoRecovery.js')

function account(address: string, recoveryMethod = RecoveryMethod.AUTOMATIC) {
  return {
    id: `emb_${address.slice(-4)}`,
    address,
    chainType: ChainTypeEnum.EVM,
    recoveryMethod,
  }
}

function setup(accounts: ReturnType<typeof account>[]) {
  const setEmbeddedState = vi.fn()
  const setRecoveryError = vi.fn()
  const store = {
    getState: () => ({ embeddedAccounts: accounts, setEmbeddedState, setRecoveryError }),
  } as unknown as StoreApi<OpenfortStore>
  const recover = vi.fn().mockResolvedValue(accounts[0])
  const openfort = {
    embeddedWallet: { recover },
    getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
    user: { get: vi.fn().mockResolvedValue({ id: 'usr_test_123' }) },
  } as unknown as Openfort
  return { setEmbeddedState, setRecoveryError, store, recover, openfort }
}

describe('useAutoRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBuildRecoveryParams.mockResolvedValue({ recoveryMethod: RecoveryMethod.AUTOMATIC })
  })

  it('publishes READY after the signer is recovered', async () => {
    const target = account('0x1234567890abcdef1234567890abcdef12345678')
    const context = setup([target])

    renderHook(() =>
      useAutoRecovery({
        storeEmbeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
        storeActiveEmbeddedAddress: target.address,
        openfort: context.openfort,
        walletConfig: {} as OpenfortWalletConfig,
        store: context.store,
      })
    )

    await waitFor(() => {
      expect(context.recover).toHaveBeenCalledWith({
        account: target.id,
        recoveryParams: { recoveryMethod: RecoveryMethod.AUTOMATIC },
      })
      expect(context.setEmbeddedState).toHaveBeenCalledWith(EmbeddedState.READY)
    })
  })

  it('stores parameter-construction failures without publishing READY', async () => {
    const target = account('0x1234567890abcdef1234567890abcdef12345678')
    const context = setup([target])
    const error = new Error('session unavailable')
    mockBuildRecoveryParams.mockRejectedValueOnce(error)

    renderHook(() =>
      useAutoRecovery({
        storeEmbeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
        storeActiveEmbeddedAddress: target.address,
        openfort: context.openfort,
        walletConfig: {} as OpenfortWalletConfig,
        store: context.store,
      })
    )

    await waitFor(() => expect(context.setRecoveryError).toHaveBeenLastCalledWith(error))
    expect(context.recover).not.toHaveBeenCalled()
    expect(context.setEmbeddedState).not.toHaveBeenCalled()
  })

  it('stores signer-recovery failures without publishing READY', async () => {
    const target = account('0x1234567890abcdef1234567890abcdef12345678')
    const context = setup([target])
    const error = new Error('signer unavailable')
    context.recover.mockRejectedValueOnce(error)

    renderHook(() =>
      useAutoRecovery({
        storeEmbeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
        storeActiveEmbeddedAddress: target.address,
        openfort: context.openfort,
        walletConfig: {} as OpenfortWalletConfig,
        store: context.store,
      })
    )

    await waitFor(() => expect(context.setRecoveryError).toHaveBeenLastCalledWith(error))
    expect(context.setEmbeddedState).not.toHaveBeenCalled()
  })

  it('leaves password recovery to explicit user input', async () => {
    const target = account('0x1234567890abcdef1234567890abcdef12345678', RecoveryMethod.PASSWORD)
    const context = setup([target])

    renderHook(() =>
      useAutoRecovery({
        storeEmbeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
        storeActiveEmbeddedAddress: target.address,
        openfort: context.openfort,
        walletConfig: {} as OpenfortWalletConfig,
        store: context.store,
      })
    )

    await Promise.resolve()
    expect(mockBuildRecoveryParams).not.toHaveBeenCalled()
    expect(context.recover).not.toHaveBeenCalled()
  })

  it('recovers the latest address when the target changes during parameter construction', async () => {
    const first = account('0x1111111111111111111111111111111111111111')
    const second = account('0x2222222222222222222222222222222222222222')
    const context = setup([first, second])
    let resolveFirst: ((value: { recoveryMethod: RecoveryMethod }) => void) | undefined
    mockBuildRecoveryParams
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce({ recoveryMethod: RecoveryMethod.AUTOMATIC })

    const { rerender } = renderHook(
      ({ address }) =>
        useAutoRecovery({
          storeEmbeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
          storeActiveEmbeddedAddress: address,
          openfort: context.openfort,
          walletConfig: {} as OpenfortWalletConfig,
          store: context.store,
        }),
      { initialProps: { address: first.address } }
    )

    await waitFor(() => expect(mockBuildRecoveryParams).toHaveBeenCalledTimes(1))
    rerender({ address: second.address })
    resolveFirst?.({ recoveryMethod: RecoveryMethod.AUTOMATIC })

    await waitFor(() => expect(context.recover).toHaveBeenCalledTimes(1))
    expect(context.recover).toHaveBeenCalledWith(
      expect.objectContaining({
        account: second.id,
      })
    )
    expect(context.recover).not.toHaveBeenCalledWith(expect.objectContaining({ account: first.id }))
  })

  it('does not recover when parameter construction crosses an auth boundary', async () => {
    const target = account('0x1234567890abcdef1234567890abcdef12345678')
    const context = setup([target])
    let resolveParams!: (value: { recoveryMethod: RecoveryMethod }) => void
    mockBuildRecoveryParams.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveParams = resolve
      })
    )

    renderHook(() =>
      useAutoRecovery({
        storeEmbeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
        storeActiveEmbeddedAddress: target.address,
        openfort: context.openfort,
        walletConfig: {} as OpenfortWalletConfig,
        store: context.store,
      })
    )
    await waitFor(() => expect(mockBuildRecoveryParams).toHaveBeenCalledOnce())

    invalidateEmbeddedSignerOperations(context.openfort)
    resolveParams({ recoveryMethod: RecoveryMethod.AUTOMATIC })

    await waitFor(() => expect(mockBuildRecoveryParams).toHaveResolved())
    expect(context.recover).not.toHaveBeenCalled()
    expect(context.setEmbeddedState).not.toHaveBeenCalled()
    expect(context.setRecoveryError).toHaveBeenLastCalledWith(null)
  })

  it('does not recover a stale address after its signer operation was blocked in the queue', async () => {
    const first = account('0x1111111111111111111111111111111111111111')
    const second = account('0x2222222222222222222222222222222222222222')
    const context = setup([first, second])
    let releaseQueue!: () => void
    const queueGate = new Promise<void>((resolve) => {
      releaseQueue = resolve
    })
    const blocker = runEmbeddedSignerOperation(context.openfort, () => queueGate)

    const { rerender } = renderHook(
      ({ address }) =>
        useAutoRecovery({
          storeEmbeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
          storeActiveEmbeddedAddress: address,
          openfort: context.openfort,
          walletConfig: {} as OpenfortWalletConfig,
          store: context.store,
        }),
      { initialProps: { address: first.address } }
    )

    await waitFor(() => expect(mockBuildRecoveryParams).toHaveBeenCalledOnce())
    rerender({ address: second.address })
    releaseQueue()
    await blocker

    await waitFor(() => expect(context.recover).toHaveBeenCalledOnce())
    expect(context.recover).toHaveBeenCalledWith(expect.objectContaining({ account: second.id }))
    expect(context.recover).not.toHaveBeenCalledWith(expect.objectContaining({ account: first.id }))
  })
})
