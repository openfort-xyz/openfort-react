import { act, renderHook } from '@testing-library/react'
import { baseSepolia } from 'viem/chains'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { embeddedWalletId } from '../constants/openfort.js'
import {
  invalidateEmbeddedSignerOperations,
  runEmbeddedSignerOperation,
} from '../shared/utils/embeddedSignerOperationQueue.js'

const providerRequest = vi.fn()
const activeWalletGetProvider = vi.fn(() => new Promise<never>(() => {}))
const grantPermissions = vi.fn()
const bridgeGrantPermissions = vi.fn()
const bridgeGetWalletClient = vi.fn()
const revokePermissionsRequest = vi.fn()

const EMBEDDED_ADDRESS = '0x0000000000000000000000000000000000000001' as const
const OTHER_ADDRESS = '0x0000000000000000000000000000000000000003' as const
const provider = { request: providerRequest }
const client = { embeddedWallet: { getEthereumProvider: vi.fn() } }
const ethereum = {
  status: 'connected',
  address: EMBEDDED_ADDRESS,
  chainId: baseSepolia.id,
  provider,
  activeWallet: { getProvider: activeWalletGetProvider },
}

const bridgeWalletClient = {
  extend: () => ({
    getAddresses: async () => ['0x0000000000000000000000000000000000000002'],
    grantPermissions: bridgeGrantPermissions,
  }),
}

const h = vi.hoisted(() => ({
  bridge: null as null | {
    account: { address?: `0x${string}`; connector?: { id: string } }
    chainId: number
    connectors: { id: string }[]
    getWalletClient: () => Promise<typeof bridgeWalletClient>
  },
}))

vi.mock('../components/Openfort/useOpenfort.js', () => ({
  useOpenfort: () => ({ chains: [baseSepolia] }),
}))
vi.mock('../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: { client: typeof client }) => unknown) => selector({ client }),
}))
vi.mock('../ethereum/hooks/useEthereumEmbeddedWallet.js', () => ({
  useEthereumEmbeddedWallet: () => ethereum,
}))
vi.mock('../ethereum/OpenfortEthereumBridgeContext.js', () => ({ useEthereumBridge: () => h.bridge }))
vi.mock('../ethereum/hooks/getEmbeddedWalletClient.js', () => ({
  getEmbeddedWalletClient: async () => ({ request: revokePermissionsRequest }),
}))
vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createWalletClient: () => ({
      extend: () => ({ getAddresses: async () => ['0x0000000000000000000000000000000000000001'], grantPermissions }),
    }),
  }
})

const { useGrantPermissions } = await import('../hooks/openfort/useGrantPermissions.js')
const { useRevokePermissions } = await import('../hooks/openfort/useRevokePermissions.js')

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('embedded permission signer serialization', () => {
  let providerAccount: `0x${string}`

  beforeEach(() => {
    vi.clearAllMocks()
    h.bridge = null
    providerAccount = EMBEDDED_ADDRESS
    providerRequest.mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [providerAccount]
      if (method === 'eth_chainId') return `0x${baseSepolia.id.toString(16)}`
      throw new Error(`Unexpected provider method: ${method}`)
    })
    grantPermissions.mockResolvedValue({ permissionsContext: '0x01' })
    bridgeGrantPermissions.mockResolvedValue({ permissionsContext: '0x02' })
    bridgeGetWalletClient.mockResolvedValue(bridgeWalletClient)
    revokePermissionsRequest.mockResolvedValue({ id: 'session' })
    client.embeddedWallet.getEthereumProvider.mockResolvedValue(provider)
  })

  it('waits for an earlier signer operation before granting through the cached provider', async () => {
    const { result } = renderHook(() => useGrantPermissions())
    const gate = deferred()
    const blocker = runEmbeddedSignerOperation(client as never, () => gate.promise)
    let permissionRequest!: ReturnType<typeof result.current.grantPermissions>

    act(() => {
      permissionRequest = result.current.grantPermissions({
        request: {
          permissions: [{ type: 'contract-call', data: { address: '0x1' } }],
          expiry: 1,
          signer: { type: 'account' },
        } as never,
      })
    })

    expect(grantPermissions).not.toHaveBeenCalled()
    await act(async () => {
      gate.resolve()
      await blocker
      await expect(permissionRequest).resolves.toMatchObject({
        address: '0x0000000000000000000000000000000000000001',
      })
    })
    expect(activeWalletGetProvider).not.toHaveBeenCalled()
    expect(grantPermissions).toHaveBeenCalledOnce()
  })

  it('waits for an earlier signer operation before revoking through the cached provider', async () => {
    const { result } = renderHook(() => useRevokePermissions())
    const gate = deferred()
    const blocker = runEmbeddedSignerOperation(client as never, () => gate.promise)
    let permissionRequest!: ReturnType<typeof result.current.revokePermissions>

    act(() => {
      permissionRequest = result.current.revokePermissions({ sessionKey: '0x01' })
    })

    expect(revokePermissionsRequest).not.toHaveBeenCalled()
    await act(async () => {
      gate.resolve()
      await blocker
      await expect(permissionRequest).resolves.toEqual({ id: 'session' })
    })
    expect(activeWalletGetProvider).not.toHaveBeenCalled()
    expect(revokePermissionsRequest).toHaveBeenCalledOnce()
  })

  it('does not grant permissions when account verification crosses an auth boundary', async () => {
    const accounts = deferred<`0x${string}`[]>()
    providerRequest.mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'eth_accounts') return accounts.promise
      if (method === 'eth_chainId') return `0x${baseSepolia.id.toString(16)}`
      throw new Error(`Unexpected provider method: ${method}`)
    })
    const { result } = renderHook(() => useGrantPermissions())
    const permissionRequest = result.current.grantPermissions({
      request: {
        permissions: [{ type: 'contract-call', data: { address: '0x1' } }],
        expiry: 1,
        signer: { type: 'account' },
      } as never,
    })
    await vi.waitFor(() => expect(providerRequest).toHaveBeenCalledWith({ method: 'eth_accounts' }))

    invalidateEmbeddedSignerOperations(client as never)
    accounts.resolve([EMBEDDED_ADDRESS])

    await expect(permissionRequest).resolves.toMatchObject({
      error: { cause: { name: 'WalletNotConnectedError' } },
    })
    expect(grantPermissions).not.toHaveBeenCalled()
  })

  it('does not revoke permissions when account verification crosses an auth boundary', async () => {
    const accounts = deferred<`0x${string}`[]>()
    providerRequest.mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'eth_accounts') return accounts.promise
      if (method === 'eth_chainId') return `0x${baseSepolia.id.toString(16)}`
      throw new Error(`Unexpected provider method: ${method}`)
    })
    const { result } = renderHook(() => useRevokePermissions())
    const permissionRequest = result.current.revokePermissions({ sessionKey: '0x01' })
    await vi.waitFor(() => expect(providerRequest).toHaveBeenCalledWith({ method: 'eth_accounts' }))

    invalidateEmbeddedSignerOperations(client as never)
    accounts.resolve([EMBEDDED_ADDRESS])

    await expect(permissionRequest).resolves.toMatchObject({
      error: { cause: { name: 'WalletNotConnectedError' } },
    })
    expect(revokePermissionsRequest).not.toHaveBeenCalled()
  })

  it('rejects a queued grant after the active embedded account changes', async () => {
    const { result } = renderHook(() => useGrantPermissions())
    const gate = deferred()
    const blocker = runEmbeddedSignerOperation(client as never, () => gate.promise)
    let permissionRequest!: ReturnType<typeof result.current.grantPermissions>

    act(() => {
      permissionRequest = result.current.grantPermissions({
        request: {
          permissions: [{ type: 'contract-call', data: { address: '0x1' } }],
          expiry: 1,
          signer: { type: 'account' },
        } as never,
      })
    })

    providerAccount = OTHER_ADDRESS
    await act(async () => {
      gate.resolve()
      await blocker
      await expect(permissionRequest).resolves.toMatchObject({
        error: { cause: { name: 'WalletNotConnectedError' } },
      })
    })
    expect(grantPermissions).not.toHaveBeenCalled()
  })

  it('rejects a queued revoke after the active embedded account changes', async () => {
    const { result } = renderHook(() => useRevokePermissions())
    const gate = deferred()
    const blocker = runEmbeddedSignerOperation(client as never, () => gate.promise)
    let permissionRequest!: ReturnType<typeof result.current.revokePermissions>

    act(() => {
      permissionRequest = result.current.revokePermissions({ sessionKey: '0x01' })
    })

    providerAccount = OTHER_ADDRESS
    await act(async () => {
      gate.resolve()
      await blocker
      await expect(permissionRequest).resolves.toMatchObject({
        error: { cause: { name: 'WalletNotConnectedError' } },
      })
    })
    expect(revokePermissionsRequest).not.toHaveBeenCalled()
  })

  it('runs an embedded wagmi grant atomically on the raw provider queue', async () => {
    h.bridge = {
      account: { address: EMBEDDED_ADDRESS, connector: { id: embeddedWalletId } },
      chainId: baseSepolia.id,
      connectors: [{ id: embeddedWalletId }],
      getWalletClient: bridgeGetWalletClient,
    }
    const { result } = renderHook(() => useGrantPermissions())
    const gate = deferred()
    const blocker = runEmbeddedSignerOperation(client as never, () => gate.promise)
    let permissionRequest!: ReturnType<typeof result.current.grantPermissions>

    act(() => {
      permissionRequest = result.current.grantPermissions({
        request: {
          permissions: [{ type: 'contract-call', data: { address: '0x1' } }],
          expiry: 1,
          signer: { type: 'account' },
        } as never,
      })
    })

    expect(bridgeGetWalletClient).not.toHaveBeenCalled()
    expect(grantPermissions).not.toHaveBeenCalled()
    await act(async () => {
      gate.resolve()
      await blocker
      await expect(permissionRequest).resolves.toMatchObject({
        address: EMBEDDED_ADDRESS,
      })
    })
    expect(grantPermissions).toHaveBeenCalledOnce()
  })

  it('rejects an embedded wagmi grant after a queued wallet switch', async () => {
    h.bridge = {
      account: { address: EMBEDDED_ADDRESS, connector: { id: embeddedWalletId } },
      chainId: baseSepolia.id,
      connectors: [{ id: embeddedWalletId }],
      getWalletClient: bridgeGetWalletClient,
    }
    const { result } = renderHook(() => useGrantPermissions())
    const gate = deferred()
    const blocker = runEmbeddedSignerOperation(client as never, () => gate.promise)
    let permissionRequest!: ReturnType<typeof result.current.grantPermissions>

    act(() => {
      permissionRequest = result.current.grantPermissions({
        request: {
          permissions: [{ type: 'contract-call', data: { address: '0x1' } }],
          expiry: 1,
          signer: { type: 'account' },
        } as never,
      })
    })

    providerAccount = OTHER_ADDRESS
    await act(async () => {
      gate.resolve()
      await blocker
      await expect(permissionRequest).resolves.toMatchObject({
        error: { cause: { name: 'WalletNotConnectedError' } },
      })
    })
    expect(bridgeGetWalletClient).not.toHaveBeenCalled()
    expect(grantPermissions).not.toHaveBeenCalled()
  })

  it('does not queue a permission grant from an external wagmi connector', async () => {
    h.bridge = {
      account: { address: '0x0000000000000000000000000000000000000002', connector: { id: 'io.external.wallet' } },
      chainId: baseSepolia.id,
      connectors: [{ id: 'io.external.wallet' }],
      getWalletClient: bridgeGetWalletClient,
    }
    const { result } = renderHook(() => useGrantPermissions())
    const gate = deferred()
    const blocker = runEmbeddedSignerOperation(client as never, () => gate.promise)
    let permissionRequest!: ReturnType<typeof result.current.grantPermissions>

    act(() => {
      permissionRequest = result.current.grantPermissions({
        request: {
          permissions: [{ type: 'contract-call', data: { address: '0x1' } }],
          expiry: 1,
          signer: { type: 'account' },
        } as never,
      })
    })

    expect(bridgeGetWalletClient).toHaveBeenCalledOnce()
    await act(async () => {
      await expect(permissionRequest).resolves.toMatchObject({
        address: '0x0000000000000000000000000000000000000002',
      })
      gate.resolve()
      await blocker
    })
    expect(bridgeGrantPermissions).toHaveBeenCalledOnce()
  })

  it('uses an explicitly identified external connector even when the bridge connector list is filtered', async () => {
    h.bridge = {
      account: { address: '0x0000000000000000000000000000000000000002', connector: { id: 'io.external.wallet' } },
      chainId: baseSepolia.id,
      connectors: [],
      getWalletClient: bridgeGetWalletClient,
    }
    const { result } = renderHook(() => useGrantPermissions())
    const gate = deferred()
    const blocker = runEmbeddedSignerOperation(client as never, () => gate.promise)

    const permissionRequest = result.current.grantPermissions({
      request: {
        permissions: [{ type: 'contract-call', data: { address: '0x1' } }],
        expiry: 1,
        signer: { type: 'account' },
      } as never,
    })

    await expect(permissionRequest).resolves.toMatchObject({
      address: '0x0000000000000000000000000000000000000002',
    })
    expect(bridgeGetWalletClient).toHaveBeenCalledOnce()
    expect(bridgeGrantPermissions).toHaveBeenCalledOnce()
    expect(grantPermissions).not.toHaveBeenCalled()

    gate.resolve()
    await blocker
  })

  it('rejects a bridge account whose connector identity is not ready without signing or entering the queue', async () => {
    h.bridge = {
      account: { address: OTHER_ADDRESS },
      chainId: baseSepolia.id,
      connectors: [{ id: 'io.external.wallet' }],
      getWalletClient: bridgeGetWalletClient,
    }
    const { result } = renderHook(() => useGrantPermissions())
    const gate = deferred()
    const blocker = runEmbeddedSignerOperation(client as never, () => gate.promise)

    const permissionRequest = result.current.grantPermissions({
      request: {
        permissions: [{ type: 'contract-call', data: { address: '0x1' } }],
        expiry: 1,
        signer: { type: 'account' },
      } as never,
    })

    await expect(permissionRequest).resolves.toMatchObject({
      error: { name: 'ConnectorNotFoundError' },
    })
    expect(bridgeGetWalletClient).not.toHaveBeenCalled()
    expect(grantPermissions).not.toHaveBeenCalled()
    expect(bridgeGrantPermissions).not.toHaveBeenCalled()

    gate.resolve()
    await blocker
  })
})
