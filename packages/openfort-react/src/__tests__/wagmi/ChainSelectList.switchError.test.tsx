import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A failed chain switch must explain itself in words. It used to render
 * "[object Object] [object Object]": the copy was built with a template literal,
 * and `useLocales` returns markdown-parsed React nodes rather than strings.
 *
 * The branch mattered too — wagmi wraps every failed switch in viem's
 * SwitchChainError (code 4902), so keying "wallet cannot switch" off that code
 * told people with a dead RPC to go switch networks in their wallet.
 */

type SwitchChainResult = {
  chains: { id: number; name: string }[]
  isPending: boolean
  switchChain: (args: { chainId: number }) => void
  error: Error | null
}

let switchChainResult: SwitchChainResult

vi.mock('../../components/Openfort/useOpenfort', () => {
  const hook = () => ({ uiConfig: {}, triggerResize: vi.fn() })
  return { useOpenfort: hook, useOpenfortConfig: hook }
})
vi.mock('wagmi', () => ({
  useAccount: () => ({ connector: { id: 'injected' } }),
  useChainId: () => 80002,
}))
vi.mock('../../wagmi/useSwitchChainFiltered', () => ({
  useSwitchChainFiltered: () => switchChainResult,
}))

const { default: ChainSelectList } = await import('../../wagmi/components/ChainSelectList/index.js')

/** A viem error carries its RPC code on `code`; wagmi's connector errors carry only a name. */
function makeError(name: string, code?: number): Error {
  const error = new Error(`${name} raised in a test`)
  error.name = name
  if (code !== undefined) Object.assign(error, { code })
  return error
}

describe('ChainSelectList — failed switch', () => {
  beforeEach(() => {
    switchChainResult = {
      chains: [
        { id: 80002, name: 'Polygon Amoy' },
        { id: 84532, name: 'Base Sepolia' },
      ],
      isPending: false,
      switchChain: vi.fn(),
      error: null,
    }
  })

  it('reports a generic failure in words, not stringified React nodes', () => {
    switchChainResult.error = makeError('SwitchChainError', 4902)

    const { container } = render(<ChainSelectList />)

    expect(container.textContent).toContain('Could not switch networks. Please try again.')
    expect(container.textContent).not.toContain('[object Object]')
  })

  it('tells the user to switch in their wallet only when the connector cannot switch at all', () => {
    switchChainResult.error = makeError('SwitchChainNotSupportedError')

    const { container } = render(<ChainSelectList />)

    expect(container.textContent).toContain('Your wallet does not support switching networks from this app.')
    expect(container.textContent).toContain('Try switching networks from within your wallet instead.')
    expect(container.textContent).not.toContain('[object Object]')
  })

  it('stays quiet when the user declines the wallet prompt', () => {
    switchChainResult.error = makeError('UserRejectedRequestError', 4001)

    const { container } = render(<ChainSelectList />)

    expect(container.textContent).not.toContain('Could not switch networks')
    expect(container.textContent).not.toContain('does not support switching networks')
  })
})
