import { ChainTypeEnum } from '@openfort/openfort-js'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WalletError } from '../../errors/wallet.js'
import type { ExportPrivateKeyResult } from '../../shared/types.js'

const EVM_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const
const EVM_OWNER_ADDRESS = '0x2222222222222222222222222222222222222222' as const
const SOLANA_ADDRESS = 'GTt5JxXsq4bR4A9UaYbLtKM3wVfucbGpgcfCsojEz7c3'
const EVM_PRIVATE_KEY = `0x${'11'.repeat(32)}`
// A realistic base58 key here reads as a real secret to the secret scanner, and
// the page only renders whatever the hook returns.
const SOLANA_SECRET_KEY = 'S'.repeat(88)

const h = vi.hoisted(() => ({
  chainType: undefined as unknown as ChainTypeEnum,
  ethereumExport: vi.fn<() => Promise<ExportPrivateKeyResult>>(),
  solanaExport: vi.fn<() => Promise<ExportPrivateKeyResult>>(),
  ethereumActiveWallet: null as { address: string; ownerAddress?: string } | null,
  solanaActiveWallet: null as { address: string } | null,
}))

vi.mock('../../components/Openfort/useOpenfort.js', () => ({
  useOpenfort: () => ({
    setOnBack: vi.fn(),
    setRoute: vi.fn(),
    setPreviousRoute: vi.fn(),
    setRouteHistory: vi.fn(),
    triggerResize: vi.fn(),
  }),
}))
vi.mock('../../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: { chainType: ChainTypeEnum }) => unknown) => selector({ chainType: h.chainType }),
}))
vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet.js', () => ({
  useEthereumEmbeddedWallet: () => ({
    exportPrivateKey: h.ethereumExport,
    activeWallet: h.ethereumActiveWallet,
  }),
}))
vi.mock('../../solana/hooks/useSolanaEmbeddedWallet.js', () => ({
  useSolanaEmbeddedWallet: () => ({
    exportPrivateKey: h.solanaExport,
    activeWallet: h.solanaActiveWallet,
  }),
}))

const { default: ExportKey } = await import('../../components/Pages/ExportKey/index.js')

/** Runs the press-and-hold gate to completion so the page renders its result. */
function completeHold() {
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  vi.stubGlobal('cancelAnimationFrame', () => {})

  const button = screen.getByText('Hold 5s to reveal key').closest('button')
  act(() => {
    fireEvent.pointerDown(button!)
  })
  // The gate reads the timestamp the frame is invoked with; one frame far enough
  // past the start fills it.
  act(() => {
    frames.shift()?.(performance.now() + 10_000)
  })
}

describe('ExportKey', () => {
  beforeEach(() => {
    h.ethereumExport.mockReset()
    h.solanaExport.mockReset()
    h.ethereumExport.mockResolvedValue({ privateKey: EVM_PRIVATE_KEY })
    h.solanaExport.mockResolvedValue({ privateKey: SOLANA_SECRET_KEY })
    h.chainType = ChainTypeEnum.EVM
    h.ethereumActiveWallet = { address: EVM_ADDRESS }
    h.solanaActiveWallet = { address: SOLANA_ADDRESS }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('exports through the Solana wallet on a Solana project', async () => {
    h.chainType = ChainTypeEnum.SVM
    h.ethereumActiveWallet = null

    render(<ExportKey />)

    await waitFor(() => expect(h.solanaExport).toHaveBeenCalledTimes(1))
    expect(h.ethereumExport).not.toHaveBeenCalled()

    completeHold()
    expect(await screen.findByText(SOLANA_SECRET_KEY)).toBeTruthy()
  })

  test('exports through the Ethereum wallet on an Ethereum project', async () => {
    render(<ExportKey />)

    await waitFor(() => expect(h.ethereumExport).toHaveBeenCalledTimes(1))
    expect(h.solanaExport).not.toHaveBeenCalled()

    completeHold()
    expect(await screen.findByText(EVM_PRIVATE_KEY)).toBeTruthy()
  })

  test('explains the owner key only for an Ethereum smart account', () => {
    h.ethereumActiveWallet = { address: EVM_ADDRESS, ownerAddress: EVM_OWNER_ADDRESS }

    const view = render(<ExportKey />)
    expect(screen.queryByText(/owner \(signer\) key/)).toBeTruthy()

    h.chainType = ChainTypeEnum.SVM
    view.rerender(<ExportKey />)
    expect(screen.queryByText(/owner \(signer\) key/)).toBeNull()
  })

  test('reports why the export failed instead of a blanket refusal', async () => {
    h.chainType = ChainTypeEnum.SVM
    h.solanaExport.mockResolvedValue({ error: new WalletError('The wallet is still reconnecting.') })

    render(<ExportKey />)
    await waitFor(() => expect(h.solanaExport).toHaveBeenCalledTimes(1))

    completeHold()
    expect(await screen.findByText('The wallet is still reconnecting.')).toBeTruthy()
    expect(screen.queryByText('You cannot export the private key for this wallet.')).toBeNull()
  })
})
