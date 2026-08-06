import { ChainTypeEnum } from '@openfort/openfort-js'
import { act, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  invalidateEmbeddedSignerOperations,
  runEmbeddedSignerOperation,
} from '../../shared/utils/embeddedSignerOperationQueue.js'

/**
 * SendConfirmation guards owned by the React layer:
 *  - a provider error must reach the error UI, not be swallowed;
 *  - signer operations must be serialized across hook instances;
 *  - once a transaction is in flight, the page must not submit another.
 */

const FROM_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222' as const
const RECIPIENT = '0x2222222222222222222222222222222222222222'
const TX_HASH = `0x${'ab'.repeat(32)}` as const
const CHAIN_ID = 84532

const nativeAsset = {
  type: 'native' as const,
  balance: 10n ** 18n,
  metadata: { symbol: 'ETH', decimals: 18, fiat: { value: 0, currency: 'USD' } },
}
const erc20Asset = {
  type: 'erc20' as const,
  address: '0x3333333333333333333333333333333333333333' as const,
  balance: 10n ** 18n,
  metadata: { symbol: 'TEST', name: 'Test Token', decimals: 18, fiat: { value: 0, currency: 'USD' } },
}

const h = vi.hoisted(() => ({
  providerRequest: vi.fn<(args: { method: string; params?: unknown[] }) => Promise<unknown>>(),
  client: undefined as unknown as {
    embeddedWallet: { getEthereumProvider: () => Promise<{ request: typeof h.providerRequest }> }
  },
  providerAccount: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
  providerChainId: 84532,
  sendForm: undefined as unknown as {
    recipient: string
    amount: string
    asset: typeof nativeAsset | typeof erc20Asset
  },
}))
h.client = { embeddedWallet: { getEthereumProvider: async () => ({ request: h.providerRequest }) } }
h.sendForm = { recipient: RECIPIENT, amount: '0.1', asset: nativeAsset }

vi.mock('../../components/Openfort/useOpenfort', () => {
  const hook = () => ({
    sendForm: h.sendForm,
    setRoute: vi.fn(),
    triggerResize: vi.fn(),
    walletConfig: undefined,
    uiConfig: {},
    setOnBack: vi.fn(),
    setPreviousRoute: vi.fn(),
    setRouteHistory: vi.fn(),
  })
  return { useOpenfort: hook, useOpenfortConfig: hook, useOpenfortRouting: hook, useOpenfortForms: hook }
})
vi.mock('../../openfort/useOpenfort', () => {
  const getState = () => ({ chainType: ChainTypeEnum.EVM, client: h.client })
  return { useOpenfortCore: (selector: (s: ReturnType<typeof getState>) => unknown) => selector(getState()) }
})
vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet', () => ({
  useEthereumEmbeddedWallet: () => ({
    status: 'connected',
    address: FROM_ADDRESS,
    chainId: CHAIN_ID,
    provider: { request: h.providerRequest },
    activeWallet: { address: FROM_ADDRESS, getProvider: () => Promise.resolve({ request: h.providerRequest }) },
  }),
}))
vi.mock('../../ethereum/hooks/useEthereumWalletAssets', () => ({
  useEthereumWalletAssets: () => ({ data: [h.sendForm.asset] }),
}))
vi.mock('../../hooks/useBalance', () => ({
  useBalance: () => ({ status: 'success', value: 10n ** 18n, decimals: 18, symbol: 'ETH', refetch: vi.fn() }),
}))
vi.mock('../../hooks/openfort/auth/useSignOut', () => ({ useSignOut: () => ({ signOut: vi.fn() }) }))
vi.mock('../../components/Common/FitText', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../../components/Pages/SendConfirmation/EstimatedFees', () => ({ EstimatedFees: () => null }))
// Receipt wait stays pending so a submitted tx is observably "in flight".
vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: () => ({
      waitForTransactionReceipt: () => new Promise(() => {}),
      readContract: () => Promise.resolve(10n ** 18n),
    }),
  }
})

const { default: SendConfirmation } = await import('../../components/Pages/SendConfirmation/index.js')
const { createQueryWrapper } = await import('../mocks/TestWrapper.js')

/** The page reads balances, fees and receipts through queries, so it needs a QueryClient in scope. */
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: createQueryWrapper() })

describe('SendConfirmation', () => {
  beforeEach(() => {
    h.providerRequest.mockReset()
    h.providerAccount = FROM_ADDRESS
    h.providerChainId = CHAIN_ID
    h.sendForm = { recipient: RECIPIENT, amount: '0.1', asset: nativeAsset }
    h.providerRequest.mockImplementation(async ({ method }) => {
      if (method === 'eth_accounts') return [h.providerAccount]
      if (method === 'eth_chainId') return `0x${h.providerChainId.toString(16)}`
      return TX_HASH
    })
  })

  const sendRequests = () =>
    h.providerRequest.mock.calls.filter(([request]) => request.method === 'eth_sendTransaction')

  it('surfaces a provider error in the error UI instead of swallowing it', async () => {
    h.providerRequest.mockImplementation(async ({ method }) => {
      if (method === 'eth_accounts') return [h.providerAccount]
      throw new Error('User rejected the request.')
    })

    render(<SendConfirmation />)
    fireEvent.click(screen.getByText('Confirm'))

    expect(await screen.findByText('Transaction cancelled')).toBeTruthy()
  })

  it('never fires a second eth_sendTransaction while a tx is in flight', async () => {
    render(<SendConfirmation />)
    fireEvent.click(screen.getByText('Confirm'))

    // Tx submitted, receipt still pending → in-flight, button shows the spinner.
    await waitFor(() => expect(sendRequests()).toHaveLength(1))
    expect(await screen.findByText('Confirming...')).toBeTruthy()

    // Clicking again must not submit a second transaction.
    fireEvent.click(screen.getByText('Confirming...'))
    await act(async () => {})
    expect(sendRequests()).toHaveLength(1)
  })

  it('keeps provider access and transaction submission behind the client signer queue', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocker = runEmbeddedSignerOperation(h.client as never, () => gate)

    render(<SendConfirmation />)
    fireEvent.click(screen.getByText('Confirm'))

    expect(h.providerRequest).not.toHaveBeenCalled()
    release()
    await blocker
    await waitFor(() => expect(sendRequests()).toHaveLength(1))
  })

  it('does not submit when the provider account no longer matches the address captured before the queue wait', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocker = runEmbeddedSignerOperation(h.client as never, () => gate)
    render(<SendConfirmation />)

    fireEvent.click(screen.getByText('Confirm'))
    h.providerAccount = OTHER_ADDRESS
    release()
    await blocker

    expect(await screen.findByText('Wallet not connected')).toBeTruthy()
    expect(h.providerRequest).toHaveBeenCalledWith({ method: 'eth_accounts' })
    expect(sendRequests()).toHaveLength(0)
  })

  it('does not submit a native transfer when the selected chain changes during the queue wait', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocker = runEmbeddedSignerOperation(h.client as never, () => gate)
    render(<SendConfirmation />)

    fireEvent.click(screen.getByText('Confirm'))
    h.providerChainId = 1
    release()
    await blocker

    expect(await screen.findByText('Wallet not connected')).toBeTruthy()
    expect(h.providerRequest).toHaveBeenCalledWith({ method: 'eth_chainId' })
    expect(sendRequests()).toHaveLength(0)
  })

  it('does not submit an ERC20 transfer when the selected chain changes during the queue wait', async () => {
    h.sendForm = { recipient: RECIPIENT, amount: '0.1', asset: erc20Asset }
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocker = runEmbeddedSignerOperation(h.client as never, () => gate)
    render(<SendConfirmation />)

    await waitFor(() => expect(screen.getByText('Confirm')).not.toHaveProperty('disabled', true))
    fireEvent.click(screen.getByText('Confirm'))
    h.providerChainId = 1
    release()
    await blocker

    expect(await screen.findByText('Wallet not connected')).toBeTruthy()
    expect(h.providerRequest).toHaveBeenCalledWith({ method: 'eth_chainId' })
    expect(sendRequests()).toHaveLength(0)
  })

  it.each([
    ['native', nativeAsset],
    ['ERC20', erc20Asset],
  ])('does not submit an %s transfer when provider verification crosses an auth boundary', async (_kind, asset) => {
    h.sendForm = { recipient: RECIPIENT, amount: '0.1', asset }
    let resolveAccounts!: (accounts: string[]) => void
    h.providerRequest.mockImplementation(async ({ method }) => {
      if (method === 'eth_accounts') {
        return new Promise<string[]>((resolve) => {
          resolveAccounts = resolve
        })
      }
      if (method === 'eth_chainId') return `0x${h.providerChainId.toString(16)}`
      return TX_HASH
    })
    render(<SendConfirmation />)

    await waitFor(() => expect(screen.getByText('Confirm')).not.toHaveProperty('disabled', true))
    fireEvent.click(screen.getByText('Confirm'))
    await waitFor(() => expect(h.providerRequest).toHaveBeenCalledWith({ method: 'eth_accounts' }))
    invalidateEmbeddedSignerOperations(h.client as never)
    resolveAccounts([FROM_ADDRESS])

    expect(await screen.findByText('Wallet not connected')).toBeTruthy()
    expect(sendRequests()).toHaveLength(0)
  })
})
