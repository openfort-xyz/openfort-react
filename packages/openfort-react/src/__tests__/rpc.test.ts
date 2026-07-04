import { base, baseSepolia, bsc, mainnet } from 'viem/chains'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../utils/logger'
import { buildChainFromConfig, getDefaultEthereumRpcUrl, isTestnetChainId } from '../utils/rpc'

describe('buildChainFromConfig', () => {
  const warn = vi.spyOn(logger, 'warn')

  beforeEach(() => {
    warn.mockClear()
  })

  it('returns the bundled viem chain for testnets without warning', () => {
    expect(buildChainFromConfig(baseSepolia.id)).toBe(baseSepolia)
    expect(warn).not.toHaveBeenCalled()
  })

  it('falls back to the public RPC for known mainnets and warns once', () => {
    expect(buildChainFromConfig(base.id)).toBe(base)
    buildChainFromConfig(base.id)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain(`rpcUrls[${base.id}]`)
  })

  it('uses the custom RPC without warning when provided', () => {
    const chain = buildChainFromConfig(mainnet.id, { [mainnet.id]: 'https://rpc.example.com' })
    expect(chain.rpcUrls.default.http[0]).toBe('https://rpc.example.com')
    expect(chain.name).toBe(mainnet.name)
    expect(warn).not.toHaveBeenCalled()
  })

  it('still throws for chains without any known RPC', () => {
    expect(() => buildChainFromConfig(999999)).toThrow('No RPC URL configured for chain 999999')
  })
})

describe('isTestnetChainId', () => {
  it('stays correct with mainnets bundled', () => {
    expect(isTestnetChainId(baseSepolia.id)).toBe(true)
    expect(isTestnetChainId(base.id)).toBe(false)
    expect(isTestnetChainId(bsc.id)).toBe(false)
  })
})

describe('getDefaultEthereumRpcUrl', () => {
  it('returns the mainnet default RPC instead of falling back to sepolia', () => {
    expect(getDefaultEthereumRpcUrl(base.id)).toBe(base.rpcUrls.default.http[0])
  })
})
