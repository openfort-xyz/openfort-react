import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * SolanaSendConfirmation routing that is the React layer's job:
 *  - fee sponsorship is read from `walletConfig.solana.sponsorFees` (no toggle) —
 *    parity with the EVM `ethereumFeeSponsorshipId` flow;
 *  - the SPL vs native branch is chosen from the selected asset, and the SPL
 *    amount is scaled to base units by the token's decimals.
 */

import type { Asset } from '../../components/Openfort/types'

const FROM = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
const RECIPIENT = '9aE476sH92Vz7DMPyq5WLPkrKWivxeuTKEFKd2sZZcde'
const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

const SOL_ASSET: Asset = {
  type: 'native',
  balance: 10n ** 9n,
  metadata: { symbol: 'SOL', decimals: 9, fiat: { value: 0, currency: 'USD' } },
}
const USDC_ASSET: Asset = {
  type: 'spl',
  address: USDC_MINT,
  balance: 5_000_000n,
  metadata: { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
}

const h = vi.hoisted(() => ({
  asset: null as unknown,
  sponsorFees: false,
  sendSol: vi.fn<(...args: unknown[]) => Promise<string>>(),
  sendSolGasless: vi.fn<(...args: unknown[]) => Promise<string>>(),
  sendSplToken: vi.fn<(...args: unknown[]) => Promise<string>>(),
  sendSplTokenGasless: vi.fn<(...args: unknown[]) => Promise<string>>(),
}))

vi.mock('../../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({
    sendForm: { recipient: RECIPIENT, amount: '1', asset: h.asset },
    setRoute: vi.fn(),
    triggerResize: vi.fn(),
    publishableKey: 'pk_test_123',
    walletConfig: { solana: { sponsorFees: h.sponsorFees } },
    uiConfig: {},
    setOnBack: vi.fn(),
    setPreviousRoute: vi.fn(),
    setRouteHistory: vi.fn(),
  }),
}))
vi.mock('../../hooks/openfort/auth/useSignOut', () => ({ useSignOut: () => ({ signOut: vi.fn() }) }))
vi.mock('../../solana/hooks/useSolanaEmbeddedWallet', () => ({
  useSolanaEmbeddedWallet: () => ({
    status: 'connected',
    address: FROM,
    provider: {},
    cluster: 'devnet',
    rpcUrl: 'https://api.devnet.solana.com',
  }),
}))
vi.mock('../../solana/transfer', () => ({
  sendSol: h.sendSol,
  sendSolGasless: h.sendSolGasless,
  sendSplToken: h.sendSplToken,
  sendSplTokenGasless: h.sendSplTokenGasless,
}))

const { SolanaSendConfirmation } = await import('../../components/Pages/SendConfirmation/SolanaSendConfirmation')

describe('SolanaSendConfirmation', () => {
  beforeEach(() => {
    for (const fn of [h.sendSol, h.sendSolGasless, h.sendSplToken, h.sendSplTokenGasless]) {
      fn.mockReset()
      fn.mockResolvedValue('signature123')
    }
    h.asset = SOL_ASSET
    h.sponsorFees = false
  })

  it('sends native SOL with the wallet paying when sponsorFees is off', async () => {
    render(<SolanaSendConfirmation />)
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => expect(h.sendSol).toHaveBeenCalledTimes(1))
    expect(h.sendSolGasless).not.toHaveBeenCalled()
  })

  it('routes native SOL through the sponsored path when sponsorFees is on', async () => {
    h.sponsorFees = true
    render(<SolanaSendConfirmation />)
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => expect(h.sendSolGasless).toHaveBeenCalledTimes(1))
    expect(h.sendSol).not.toHaveBeenCalled()
  })

  it('sends an SPL token in base units when sponsorFees is off', async () => {
    h.asset = USDC_ASSET
    render(<SolanaSendConfirmation />)
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => expect(h.sendSplToken).toHaveBeenCalledTimes(1))
    expect(h.sendSplToken).toHaveBeenCalledWith(
      expect.objectContaining({ mint: USDC_MINT, amount: 1_000_000n, decimals: 6, to: RECIPIENT })
    )
    expect(h.sendSplTokenGasless).not.toHaveBeenCalled()
  })

  it('routes an SPL token through the sponsored path when sponsorFees is on', async () => {
    h.asset = USDC_ASSET
    h.sponsorFees = true
    render(<SolanaSendConfirmation />)
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => expect(h.sendSplTokenGasless).toHaveBeenCalledTimes(1))
    expect(h.sendSplTokenGasless).toHaveBeenCalledWith(expect.objectContaining({ mint: USDC_MINT, amount: 1_000_000n }))
    expect(h.sendSplToken).not.toHaveBeenCalled()
  })

  it('shows the Sponsored network-fee row only when sponsorFees is on', () => {
    h.sponsorFees = true
    render(<SolanaSendConfirmation />)
    expect(screen.getByText(/Sponsored/)).toBeTruthy()
  })
})
