import { describe, expect, it } from 'vitest'
import { forkUpstreamOrigin, redactForkDiagnostics, resolveForkUpstreamUrl } from './fork.js'

describe('resolveForkUpstreamUrl', () => {
  it.each([undefined, '', '   '])('uses the public endpoint when the configured URL is %j', (configuredUrl) => {
    expect(resolveForkUpstreamUrl(configuredUrl)).toBe('https://sepolia.base.org')
  })

  it('trims a configured URL', () => {
    expect(resolveForkUpstreamUrl('  https://rpc.example.test/base-sepolia  ')).toBe(
      'https://rpc.example.test/base-sepolia'
    )
  })

  it('keeps credential-bearing fork URL paths and queries out of diagnostics', () => {
    const upstream = 'https://rpc.example.test/v3/fake-provider-key?token=fake-query-token'

    expect(forkUpstreamOrigin(upstream)).toBe('https://rpc.example.test')
    expect(redactForkDiagnostics(`anvil failed to fetch ${upstream}`)).toBe(
      'anvil failed to fetch https://rpc.example.test'
    )
  })
})
