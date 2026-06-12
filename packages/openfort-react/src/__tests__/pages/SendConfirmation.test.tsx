import { ChainTypeEnum } from '@openfort/openfort-js'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * SendConfirmation guards that are genuinely the React layer's job:
 *  - a provider error must reach the error UI, not be swallowed;
 *  - once a tx is in flight, the page must never fire a second
 *    `eth_sendTransaction` (the duplicate the customer hit).
 *
 * The signing-hang timeout belongs in the SDK (openfort-js#294) and
 * cross-reload idempotency belongs in the API, so neither is tested here.
 */

const FROM_ADDRESS = '0x1111111111111111111111111111111111111111'
const RECIPIENT = '0x2222222222222222222222222222222222222222'
const TX_HASH = `0x${'ab'.repeat(32)}` as const
const CHAIN_ID = 84532

const nativeAsset = {
  type: 'native' as const,
  balance: 10n ** 18n,
  metadata: { symbol: 'ETH', decimals: 18, fiat: { value: 0, currency: 'USD' } },
}

const h = vi.hoisted(() => ({
  providerRequest: vi.fn<(args: { method: string; params?: unknown[] }) => Promise<unknown>>(),
}))

vi.mock('../../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({
    sendForm: { recipient: RECIPIENT, amount: '0.1', asset: nativeAsset },
    setRoute: vi.fn(),
    triggerResize: vi.fn(),
    walletConfig: undefined,
    uiConfig: {},
    setOnBack: vi.fn(),
    setPreviousRoute: vi.fn(),
    setRouteHistory: vi.fn(),
  }),
}))
vi.mock('../../openfort/useOpenfort', () => ({
  useOpenfortCore: () => ({ chainType: ChainTypeEnum.EVM }),
}))
vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet', () => ({
  useEthereumEmbeddedWallet: () => ({
    status: 'connected',
    address: FROM_ADDRESS,
    chainId: CHAIN_ID,
    activeWallet: { address: FROM_ADDRESS, getProvider: () => Promise.resolve({ request: h.providerRequest }) },
  }),
}))
vi.mock('../../ethereum/hooks/useEthereumWalletAssets', () => ({
  useEthereumWalletAssets: () => ({ data: [nativeAsset] }),
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
      readContract: () => Promise.resolve(0n),
    }),
  }
})

const { default: SendConfirmation } = await import('../../components/Pages/SendConfirmation')

describe('SendConfirmation', () => {
  beforeEach(() => {
    h.providerRequest.mockReset()
  })

  it('surfaces a provider error in the error UI instead of swallowing it', async () => {
    h.providerRequest.mockRejectedValue(new Error('User rejected the request.'))

    render(<SendConfirmation />)
    fireEvent.click(screen.getByText('Confirm'))

    expect(await screen.findByText('Transaction cancelled')).toBeTruthy()
  })

  it('never fires a second eth_sendTransaction while a tx is in flight', async () => {
    h.providerRequest.mockResolvedValue(TX_HASH)

    render(<SendConfirmation />)
    fireEvent.click(screen.getByText('Confirm'))

    // Tx submitted, receipt still pending → in-flight, button shows the spinner.
    await waitFor(() => expect(h.providerRequest).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Confirming...')).toBeTruthy()

    // Clicking again must not submit a second transaction.
    fireEvent.click(screen.getByText('Confirming...'))
    await act(async () => {})
    expect(h.providerRequest).toHaveBeenCalledTimes(1)
  })
})
