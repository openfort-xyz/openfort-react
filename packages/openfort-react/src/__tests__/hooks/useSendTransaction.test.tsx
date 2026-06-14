import { ChainTypeEnum } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { createElement, type PropsWithChildren } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { StoreContext } from '../../openfort/context'
import { createOpenfortStore } from '../../openfort/store'
import { createMockOpenfortClient } from '../mocks/openfortClient'
import { buildContextValue } from '../mocks/TestWrapper'

vi.mock('../../components/Openfort/useOpenfort', () => {
  const hook = () => ({
    walletConfig: { ethereum: { chainId: 80002, ethereumFeeSponsorshipId: 'spon_test' } },
    chainType: ChainTypeEnum.EVM,
  })
  return { useOpenfort: hook, useOpenfortUIContext: hook }
})
vi.mock('../../core/ConnectionStrategyContext', () => ({
  useConnectionStrategy: () => ({ kind: 'embedded', chainType: ChainTypeEnum.EVM, getChainId: () => 80002 }),
  ConnectionStrategyProvider: ({ children }: PropsWithChildren) => children,
}))

const { useSendTransaction } = await import('../../ethereum/hooks/useSendTransaction')

function createWrapper(overrides: Partial<Parameters<typeof buildContextValue>[0]> = {}) {
  const defaults = buildContextValue(overrides)
  const store = createOpenfortStore(defaults.chainType, defaults.client)
  const s = store.getState()
  s.setActiveEmbeddedAddress(defaults.activeEmbeddedAddress)
  store.setState({ client: defaults.client })
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(StoreContext.Provider, { value: store }, children)
  }
}

describe('useSendTransaction', () => {
  it('sends a sponsored transaction through the embedded provider', async () => {
    const request = vi.fn(async (args: { method: string }) => (args.method === 'eth_sendTransaction' ? '0xhash' : []))
    const client = createMockOpenfortClient()
    client.embeddedWallet.getEthereumProvider.mockResolvedValue({ request } as never)

    const wrapper = createWrapper({ client: client as never, activeEmbeddedAddress: '0xFrom' })
    const { result } = renderHook(() => useSendTransaction(), { wrapper })

    expect(result.current.isSponsored).toBe(true)
    expect(result.current.isIdle).toBe(true)

    let hash: string | undefined
    await act(async () => {
      hash = await result.current.sendTransactionAsync({ to: '0xTo', value: 1_000_000_000_000_000n })
    })

    expect(hash).toBe('0xhash')
    expect(client.embeddedWallet.getEthereumProvider).toHaveBeenCalledWith(
      expect.objectContaining({ feeSponsorship: 'spon_test' })
    )
    const sendCall = request.mock.calls.find((c) => (c[0] as { method: string }).method === 'eth_sendTransaction')
    const txParams = (sendCall?.[0] as { params: Record<string, string>[] }).params[0]
    expect(txParams).toMatchObject({ from: '0xFrom', to: '0xTo' })
    expect(txParams.value).toMatch(/^0x[0-9a-f]+$/)
    expect(result.current.isSuccess).toBe(true)
    expect(result.current.data).toBe('0xhash')
  })

  it('surfaces a PROVIDER_NOT_READY error when no wallet is active (non-throwing path)', async () => {
    const wrapper = createWrapper({ activeEmbeddedAddress: undefined })
    const { result } = renderHook(() => useSendTransaction(), { wrapper })

    let res: string | undefined = '0xshould-be-cleared'
    await act(async () => {
      res = await result.current.sendTransaction({ to: '0xTo' })
    })

    expect(res).toBeUndefined()
    expect(result.current.isError).toBe(true)
    expect(result.current.error?.code).toBe('PROVIDER_NOT_READY')
  })
})
