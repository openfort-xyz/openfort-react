import { beforeEach, describe, expect, it } from 'vitest'
import { ValidationError } from '../errors/validation.js'
import { assertCredentialedEndpoint, assertNavigableRedirect, suppressReferrer } from './urlSecurity.js'

describe('suppressReferrer', () => {
  beforeEach(() => {
    document.head.querySelectorAll('meta[name="referrer"]').forEach((meta) => {
      meta.remove()
    })
  })

  it('keeps suppression active until every caller restores it', () => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'strict-origin'
    document.head.appendChild(meta)

    const restoreFirst = suppressReferrer()
    const restoreSecond = suppressReferrer()
    restoreFirst()

    expect(meta.content).toBe('no-referrer')

    restoreSecond()

    expect(meta.content).toBe('strict-origin')
  })

  it('does not overwrite a policy changed by the host while suppression is active', () => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'strict-origin'
    document.head.appendChild(meta)
    const restore = suppressReferrer()

    meta.content = 'same-origin'
    restore()

    expect(meta.content).toBe('same-origin')
  })
})

describe('assertNavigableRedirect', () => {
  it('accepts an https redirect', () => {
    expect(assertNavigableRedirect('https://auth.openfort.io/oauth?state=abc')).toBe(
      'https://auth.openfort.io/oauth?state=abc'
    )
  })

  it.each([
    'javascript:fetch("//evil.example")',
    'data:text/html,<script>1</script>',
    'http://auth.openfort.io/oauth',
    '//evil.example/oauth',
    'not a url',
  ])('refuses to navigate to %s', (value) => {
    expect(() => assertNavigableRedirect(value)).toThrow(ValidationError)
  })
})

describe('assertCredentialedEndpoint', () => {
  it.each([
    'https://api.example.com/protected-create-encryption-session',
    'http://localhost:3110/api/protected-create-encryption-session',
    'http://127.0.0.1:3110/session',
    'http://[::1]:3110/session',
  ])('accepts %s', (value) => {
    expect(assertCredentialedEndpoint(value)).toBe(value)
  })

  it('resolves a relative path against the page origin (firebase template proxy)', () => {
    expect(assertCredentialedEndpoint('/api/protected-create-encryption-session')).toBe(
      new URL('/api/protected-create-encryption-session', window.location.href).href
    )
  })

  it.each([
    'http://api.example.com/session',
    'http://192.168.1.10:3110/session',
    'ws://localhost/session',
    // Protocol-relative: inherits the page's http scheme but leaves its host.
    '//evil.example/session',
  ])('refuses to send a bearer token to %s', (value) => {
    expect(() => assertCredentialedEndpoint(value)).toThrow(ValidationError)
  })
})
