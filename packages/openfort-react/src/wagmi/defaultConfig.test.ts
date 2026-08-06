import { describe, expect, test } from 'vitest'
import { http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import defaultConfig from './defaultConfig.js'

const requiredConfig = {
  appName: 'Test app',
  chains: [mainnet] as const,
  connectors: [],
  transports: { [mainnet.id]: http() },
}

describe('getDefaultConfig', () => {
  test('hydrates Wagmi after render by default', () => {
    expect(defaultConfig(requiredConfig).ssr).toBe(true)
  })

  test('allows hosts to override SSR hydration', () => {
    expect(defaultConfig({ ...requiredConfig, ssr: false }).ssr).toBe(false)
  })
})
