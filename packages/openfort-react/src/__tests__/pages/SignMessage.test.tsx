import { ChainTypeEnum } from '@openfort/openfort-js'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  invalidateEmbeddedSignerOperations,
  runEmbeddedSignerOperation,
} from '../../shared/utils/embeddedSignerOperationQueue.js'

const ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222' as const
const SIGNATURE = `0x${'ab'.repeat(65)}`

const h = vi.hoisted(() => ({
  status: 'disconnected' as 'disconnected' | 'connected',
  signMessage: vi.fn<() => Promise<string>>(),
  signTypedData: vi.fn<() => Promise<string>>(),
  providerRequest: vi.fn<() => Promise<unknown>>(),
  solanaSignMessage: vi.fn<() => Promise<string>>(),
  settle: vi.fn(),
  setSignRequest: vi.fn(),
  chainType: undefined as unknown as ChainTypeEnum,
  solanaStatus: 'disconnected' as 'disconnected' | 'connected',
  address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
  signRequest: {
    kind: 'message' as 'message' | 'typedData',
    message: 'hello',
    typedData: undefined as
      | undefined
      | {
          domain: { name: string }
          types: { Mail: { name: string; type: string }[] }
          primaryType: string
          message: { contents: string }
        },
    settle: vi.fn(),
  },
  client: undefined as unknown as {
    embeddedWallet: {
      getEthereumProvider: () => Promise<{ request: typeof h.providerRequest }>
      signMessage: () => Promise<string>
      signTypedData: () => Promise<string>
    }
  },
}))

h.client = {
  embeddedWallet: {
    getEthereumProvider: async () => ({ request: h.providerRequest }),
    signMessage: h.signMessage,
    signTypedData: h.signTypedData,
  },
}

vi.mock('../../components/Openfort/useOpenfort.js', () => ({
  useOpenfort: () => ({
    signRequest: h.signRequest,
    setSignRequest: h.setSignRequest,
    setOpen: vi.fn(),
    setOnBack: vi.fn(),
    setPreviousRoute: vi.fn(),
    setRoute: vi.fn(),
    setRouteHistory: vi.fn(),
    uiConfig: {},
    triggerResize: vi.fn(),
  }),
}))
vi.mock('../../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: { chainType: ChainTypeEnum; client: typeof h.client }) => unknown) =>
    selector({
      chainType: h.chainType,
      client: h.client,
    }),
}))
vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet.js', () => ({
  useEthereumEmbeddedWallet: () => ({
    status: h.status,
    address: h.address,
    provider: { request: h.providerRequest },
    activeWallet: {},
  }),
}))
vi.mock('../../solana/hooks/useSolanaEmbeddedWallet.js', () => ({
  useSolanaEmbeddedWallet: () => ({
    status: h.solanaStatus,
    provider: { signMessage: h.solanaSignMessage },
  }),
}))

const { default: SignMessage } = await import('../../components/Pages/SignMessage/index.js')

describe('SignMessage', () => {
  beforeEach(() => {
    h.status = 'disconnected'
    h.signMessage.mockReset()
    h.signTypedData.mockReset()
    h.providerRequest.mockReset()
    h.solanaSignMessage.mockReset()
    h.settle.mockReset()
    h.setSignRequest.mockReset()
    h.chainType = ChainTypeEnum.EVM
    h.solanaStatus = 'disconnected'
    h.address = ADDRESS
    h.signRequest = {
      kind: 'message',
      message: 'hello',
      typedData: undefined,
      settle: h.settle,
    }
    h.signMessage.mockResolvedValue(SIGNATURE)
    h.signTypedData.mockResolvedValue(SIGNATURE)
    h.solanaSignMessage.mockResolvedValue(SIGNATURE)
    h.providerRequest.mockResolvedValue([`0x${ADDRESS.slice(2).toUpperCase()}`])
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

    await waitFor(() => expect(h.settle).toHaveBeenCalledWith({ signature: SIGNATURE }))
    expect(h.signMessage).toHaveBeenCalledWith('hello')
    expect(await screen.findByText('Message signed')).toBeTruthy()
  })

  test.each([
    ['message', 'signMessage'],
    ['typedData', 'signTypedData'],
  ] as const)('serializes an EVM %s signature behind an earlier signer operation', async (kind, method) => {
    h.status = 'connected'
    if (kind === 'typedData') {
      h.signRequest = {
        kind,
        message: 'hello',
        typedData: {
          domain: { name: 'Mail' },
          types: { Mail: [{ name: 'contents', type: 'string' }] },
          primaryType: 'Mail',
          message: { contents: 'hello' },
        },
        settle: h.settle,
      }
    }
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocker = runEmbeddedSignerOperation(h.client as never, () => gate)
    render(<SignMessage />)

    fireEvent.click(screen.getByText('Sign and continue'))
    expect(h[method]).not.toHaveBeenCalled()

    release()
    await blocker
    await waitFor(() => expect(h[method]).toHaveBeenCalledOnce())
    await waitFor(() => expect(h.settle).toHaveBeenCalledWith({ signature: SIGNATURE }))
  })

  test('settles a queued signature with a typed error when the provider account changes', async () => {
    h.status = 'connected'
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocker = runEmbeddedSignerOperation(h.client as never, () => gate)
    render(<SignMessage />)

    fireEvent.click(screen.getByText('Sign and continue'))
    h.providerRequest.mockResolvedValue([OTHER_ADDRESS])
    release()
    await blocker

    await waitFor(() =>
      expect(h.settle).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ name: 'WalletNotConnectedError' }) })
      )
    )
    expect(h.providerRequest).toHaveBeenCalledWith({ method: 'eth_accounts' })
    expect(h.signMessage).not.toHaveBeenCalled()
    expect(h.setSignRequest).toHaveBeenCalled()
  })

  test('does not sign when provider verification crosses an auth boundary', async () => {
    h.status = 'connected'
    let resolveAccounts!: (accounts: string[]) => void
    h.providerRequest.mockReturnValueOnce(
      new Promise<string[]>((resolve) => {
        resolveAccounts = resolve
      })
    )
    render(<SignMessage />)

    fireEvent.click(screen.getByText('Sign and continue'))
    await waitFor(() => expect(h.providerRequest).toHaveBeenCalledWith({ method: 'eth_accounts' }))
    invalidateEmbeddedSignerOperations(h.client as never)
    resolveAccounts([ADDRESS])

    await waitFor(() =>
      expect(h.settle).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ name: 'WalletNotConnectedError' }) })
      )
    )
    expect(h.signMessage).not.toHaveBeenCalled()
  })

  test('lets the serialized Solana provider complete without reacquiring its client queue', async () => {
    h.chainType = ChainTypeEnum.SVM
    h.solanaStatus = 'connected'
    h.solanaSignMessage.mockImplementation(() => runEmbeddedSignerOperation(h.client as never, async () => SIGNATURE))
    render(<SignMessage />)

    fireEvent.click(screen.getByText('Sign and continue'))

    await waitFor(() => expect(h.settle).toHaveBeenCalledWith({ signature: SIGNATURE }))
    expect(await screen.findByText('Message signed')).toBeTruthy()
  })

  test('settles one pending request after a StrictMode-safe unmount', async () => {
    const view = render(
      <StrictMode>
        <SignMessage />
      </StrictMode>
    )

    await Promise.resolve()
    expect(h.settle).not.toHaveBeenCalled()

    view.unmount()

    await waitFor(() =>
      expect(h.settle).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ name: 'WalletError' }) })
      )
    )
    expect(h.settle).toHaveBeenCalledOnce()
  })

  test('settles only the request that is replaced while the screen stays mounted', async () => {
    const firstRequest = h.signRequest
    const view = render(<SignMessage />)
    const nextSettle = vi.fn()
    h.signRequest = { ...h.signRequest, message: 'next', settle: nextSettle }

    view.rerender(<SignMessage />)

    await waitFor(() =>
      expect(firstRequest.settle).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ name: 'WalletError' }) })
      )
    )
    expect(nextSettle).not.toHaveBeenCalled()
  })

  test('does not settle a successful request again when the success screen unmounts', async () => {
    h.status = 'connected'
    const view = render(<SignMessage />)

    fireEvent.click(screen.getByText('Sign and continue'))
    await waitFor(() => expect(h.settle).toHaveBeenCalledWith({ signature: SIGNATURE }))
    view.unmount()
    await Promise.resolve()

    expect(h.settle).toHaveBeenCalledOnce()
  })

  test('shows a newer request after an earlier request succeeds', async () => {
    h.status = 'connected'
    const view = render(<SignMessage />)

    fireEvent.click(screen.getByText('Sign and continue'))
    await waitFor(() => expect(screen.getByText('Message signed')).toBeTruthy())

    h.signRequest = {
      kind: 'message',
      message: 'review the newer request',
      typedData: undefined,
      settle: vi.fn(),
    }
    view.rerender(<SignMessage />)

    await waitFor(() => expect(screen.getByText('review the newer request')).toBeTruthy())
    expect(screen.queryByText('Message signed')).toBeNull()
  })
})
