import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { logger, setDebugLogsEnabled } from '../../utils/logger.js'

// The shared test setup mocks the logger to keep other suites quiet; exercise the real one here.
vi.unmock('../../utils/logger')

const PREFIX = '[Openfort-React]'

describe('logger', () => {
  let log: MockInstance
  let warn: MockInstance
  let error: MockInstance

  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {})
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    error = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    setDebugLogsEnabled(false)
    vi.restoreAllMocks()
  })

  it('emits errors and warnings while debug logs are disabled', () => {
    setDebugLogsEnabled(false)

    logger.error('boom', { code: 1 })
    logger.warn('careful')

    expect(error).toHaveBeenCalledWith(PREFIX, 'boom', { code: 1 })
    expect(warn).toHaveBeenCalledWith(PREFIX, 'careful')
  })

  it('recursively redacts sensitive fields and bearer credentials', () => {
    logger.error('request failed', {
      request: {
        headers: { Authorization: 'Bearer fake-access-token' },
        auth: { access_token: 'fake-access-token', refreshToken: 'fake-refresh-token' },
      },
      message: 'upstream returned Bearer fake-header-token',
      safe: { code: 401 },
    })

    expect(error).toHaveBeenCalledWith(PREFIX, 'request failed', {
      request: {
        headers: { Authorization: '[REDACTED]' },
        auth: { access_token: '[REDACTED]', refreshToken: '[REDACTED]' },
      },
      message: 'upstream returned Bearer [REDACTED]',
      safe: { code: 401 },
    })
  })

  it('redacts serialized authentication headers and cookies', () => {
    logger.error(`request failed:
Cookie=session=fake-session; secondary=fake-secondary
Set-Cookie=refresh=fake-refresh; HttpOnly
Proxy-Authorization=Basic fake-proxy`)

    const emitted = JSON.stringify(error.mock.calls)
    expect(emitted).not.toContain('fake-session')
    expect(emitted).not.toContain('fake-secondary')
    expect(emitted).not.toContain('fake-refresh')
    expect(emitted).not.toContain('fake-proxy')
  })

  it('redacts URL paths and credentials while retaining diagnostic origins', () => {
    logger.error(
      'request failed for https://rpc-user:rpc-password@rpc.example/v1?key=query-secret&network=base; docs: https://docs.example/path@release?network=base; prose key=public'
    )

    expect(error).toHaveBeenCalledWith(
      PREFIX,
      'request failed for https://rpc.example/[REDACTED]; docs: https://docs.example/[REDACTED]; prose key=public'
    )
  })

  it('redacts credential-bearing RPC path segments in strings and errors', () => {
    const source = Object.assign(new Error('request failed for https://mainnet.infura.io/v3/fake-infura-id'), {
      url: 'https://base-mainnet.g.alchemy.com/v2/fake-alchemy-key',
    })

    logger.error(source)

    const sanitized = error.mock.calls[0]?.[1] as Error & { url: string }
    const emitted = `${sanitized.message} ${sanitized.url}`
    expect(emitted).not.toContain('fake-infura-id')
    expect(emitted).not.toContain('fake-alchemy-key')
    expect(emitted).toContain('https://mainnet.infura.io/[REDACTED]')
    expect(emitted).toContain('https://base-mainnet.g.alchemy.com/[REDACTED]')
  })

  it('redacts credentials in arbitrary custom RPC paths', () => {
    const source = Object.assign(
      new Error('request failed for https://compatible-purple-brook.quiknode.pro/fake-quicknode-token/'),
      {
        url: 'https://rpc.example/custom/path/fake-rpc-token',
        websocket: 'wss://rpc.example/socket/fake-websocket-token',
      }
    )

    logger.error(source)

    const sanitized = error.mock.calls[0]?.[1] as Error & { url: string; websocket: string }
    const emitted = `${sanitized.message} ${sanitized.url} ${sanitized.websocket}`
    expect(emitted).not.toContain('fake-quicknode-token')
    expect(emitted).not.toContain('fake-rpc-token')
    expect(emitted).not.toContain('fake-websocket-token')
    expect(emitted).toContain('https://compatible-purple-brook.quiknode.pro/[REDACTED]')
    expect(emitted).toContain('https://rpc.example/[REDACTED]')
    expect(emitted).toContain('wss://rpc.example/[REDACTED]')
  })

  it('redacts credential-bearing paths from IPv6 RPC URLs', () => {
    logger.error('request failed for http://[::1]:8545/rpc/fake-ipv6-secret?network=local')

    const emitted = JSON.stringify(error.mock.calls)
    expect(emitted).not.toContain('fake-ipv6-secret')
    expect(emitted).toContain('http://[::1]:8545/[REDACTED]')
  })

  it('redacts values associated with sensitive Map keys', () => {
    logger.error(
      new Map([
        ['clientSecret', 'fake-map-client-secret'],
        ['safe', 'diagnostic-value'],
      ])
    )

    const sanitized = error.mock.calls[0]?.[1] as Map<string, string>
    expect(sanitized.get('clientSecret')).toBe('[REDACTED]')
    expect(sanitized.get('safe')).toBe('diagnostic-value')
    expect([...sanitized.values()]).not.toContain('fake-map-client-secret')
  })

  it('does not treat an arbitrary object field named key as a credential', () => {
    logger.warn({ key: 'public-cache-key', apiKey: 'private-api-key' })

    expect(warn).toHaveBeenCalledWith(PREFIX, { key: 'public-cache-key', apiKey: '[REDACTED]' })
  })

  it('redacts wallet-recovery credentials from objects and serialized diagnostics', () => {
    const credentials = {
      encryptionSession: 'fake-encryption-session',
      recoveryShare: 'fake-recovery-share',
      shieldEncryptionKey: 'fake-shield-key',
      passkeyKey: 'fake-passkey-key',
      passkeyDerivedKey: 'fake-passkey-derived-key',
      password: 'fake-password',
      recoveryPassword: 'fake-recovery-password',
      encryptionKey: 'fake-encryption-key',
      secretKey: 'fake-secret-key',
    }
    const publicValues = {
      publicKey: 'fake-public-key',
      publishableKey: 'fake-publishable-key',
    }

    logger.warn({ ...credentials, ...publicValues })
    logger.error(`wallet recovery failed: ${JSON.stringify({ ...credentials, ...publicValues })}`)

    const emitted = JSON.stringify([...warn.mock.calls, ...error.mock.calls])
    for (const credential of Object.values(credentials)) {
      expect(emitted).not.toContain(credential)
    }
    expect(emitted).toContain(publicValues.publicKey)
    expect(emitted).toContain(publicValues.publishableKey)
  })

  it('sanitizes Error details without mutating the source error', () => {
    const source = Object.assign(new Error('request used Bearer fake-error-token'), {
      cause: { privateKey: 'fake-private-key' },
    })

    logger.warn(source)

    const sanitized = warn.mock.calls[0]?.[1]
    expect(sanitized).toBeInstanceOf(Error)
    expect(sanitized).not.toBe(source)
    expect(sanitized).toMatchObject({
      message: 'request used Bearer [REDACTED]',
      cause: { privateKey: '[REDACTED]' },
    })
    expect(source.message).toContain('fake-error-token')
    expect(source.cause.privateKey).toBe('fake-private-key')
  })

  it('handles circular diagnostic objects', () => {
    const diagnostic: { token: string; self?: unknown } = { token: 'fake-token' }
    diagnostic.self = diagnostic

    logger.error(diagnostic)

    const sanitized = error.mock.calls[0]?.[1] as { token: string; self: unknown }
    expect(sanitized.token).toBe('[REDACTED]')
    expect(sanitized.self).toBe(sanitized)
  })

  it('does not invoke accessors while sanitizing diagnostics', () => {
    const getter = vi.fn(() => {
      throw new Error('getter must not run')
    })
    const diagnostic = {}
    Object.defineProperty(diagnostic, 'detail', { enumerable: true, get: getter })

    expect(() => logger.error(diagnostic)).not.toThrow()
    expect(getter).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(PREFIX, { detail: '[ACCESSOR]' })
  })

  it('fails closed without throwing when a proxy refuses inspection', () => {
    const diagnostic = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('inspection denied')
        },
      }
    )

    expect(() => logger.error('request failed', diagnostic)).not.toThrow()
    expect(error).toHaveBeenCalledWith(PREFIX, '[UNSERIALIZABLE]')
  })

  it('does not hand callable proxies to the host console', () => {
    const callable = new Proxy(() => 'unsafe', {
      get: () => {
        throw new Error('inspection denied')
      },
    })

    expect(() => logger.error(callable)).not.toThrow()
    expect(error).toHaveBeenCalledWith(PREFIX, '[FUNCTION]')
  })

  it('does not throw when a host console implementation throws', () => {
    error.mockImplementation(() => {
      throw new Error('console unavailable')
    })

    expect(() => logger.error('operation failed', { token: 'fake-token' })).not.toThrow()
  })

  it('keeps callback failure reporting isolated from hostile values and consoles', () => {
    const { proxy, revoke } = Proxy.revocable({}, {})
    revoke()
    error.mockImplementation(() => {
      throw new Error('console unavailable')
    })

    const reportCallbackFailure = () => {
      try {
        throw proxy
      } catch (cause) {
        logger.error('consumer callback threw', cause)
      }
    }

    expect(reportCallbackFailure).not.toThrow()
  })

  it('suppresses log while debug logs are disabled', () => {
    setDebugLogsEnabled(false)

    logger.log('chatty')

    expect(log).not.toHaveBeenCalled()
  })

  it('emits log once debug logs are enabled', () => {
    setDebugLogsEnabled(true)

    logger.log('chatty', 42)

    expect(log).toHaveBeenCalledWith(PREFIX, 'chatty', 42)
  })

  it('stops emitting log after debug logs are turned back off', () => {
    setDebugLogsEnabled(true)
    logger.log('first')
    setDebugLogsEnabled(false)
    logger.log('second')

    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(PREFIX, 'first')
  })
})
