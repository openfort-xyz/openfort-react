import { ChainTypeEnum } from '@openfort/openfort-js'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const SIGNATURE = `0x${'ab'.repeat(65)}`

const h = vi.hoisted(() => ({
  status: 'disconnected' as 'disconnected' | 'connected',
  signMessage: vi.fn<() => Promise<string>>(),
  signTypedData: vi.fn<() => Promise<string>>(),
  resolve: vi.fn(),
}))

vi.mock('../../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({
    signRequest: { kind: 'message', message: 'hello', resolve: h.resolve, reject: vi.fn() },
    setSignRequest: vi.fn(),
    setOpen: vi.fn(),
    setOnBack: vi.fn(),
    setPreviousRoute: vi.fn(),
    setRoute: vi.fn(),
    setRouteHistory: vi.fn(),
    uiConfig: {},
    triggerResize: vi.fn(),
  }),
}))
vi.mock('../../openfort/useOpenfort', () => ({
  useOpenfortCore: (
    selector: (state: {
      chainType: ChainTypeEnum
      client: { embeddedWallet: { signMessage: typeof h.signMessage; signTypedData: typeof h.signTypedData } }
    }) => unknown
  ) =>
    selector({
      chainType: ChainTypeEnum.EVM,
      client: { embeddedWallet: { signMessage: h.signMessage, signTypedData: h.signTypedData } },
    }),
}))
vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet', () => ({
  useEthereumEmbeddedWallet: () => ({
    status: h.status,
    address: ADDRESS,
    activeWallet: {},
  }),
}))
vi.mock('../../solana/hooks/useSolanaEmbeddedWallet', () => ({
  useSolanaEmbeddedWallet: () => ({ status: 'disconnected' }),
}))

const { default: SignMessage } = await import('../../components/Pages/SignMessage/index.js')

describe('SignMessage', () => {
  beforeEach(() => {
    h.status = 'disconnected'
    h.signMessage.mockReset()
    h.signTypedData.mockReset()
    h.resolve.mockReset()
    h.signMessage.mockResolvedValue(SIGNATURE)
  })

  test('waits for the embedded wallet before allowing a signature', async () => {
    const view = render(<SignMessage />)
    const button = screen.getByText('Sign and continue').closest('button')

    expect(button?.hasAttribute('disabled')).toBe(true)
    fireEvent.click(button!)
    expect(h.signMessage).not.toHaveBeenCalled()

    h.status = 'connected'
    view.rerender(<SignMessage />)
    expect(button?.hasAttribute('disabled')).toBe(false)
    fireEvent.click(button!)

    await waitFor(() => expect(h.resolve).toHaveBeenCalledWith(SIGNATURE))
    expect(h.signMessage).toHaveBeenCalledWith('hello')
    expect(await screen.findByText('Message signed')).toBeTruthy()
  })
})
