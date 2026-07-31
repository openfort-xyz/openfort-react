import { describe, expect, it } from 'vitest'

/**
 * Phase 0 regression tests — validate security hardening still holds.
 */

describe('Phase 0 regressions', () => {
  describe('callback URL origin validation', () => {
    it('rejects cross-origin callback URLs', async () => {
      const { buildCallbackUrl } = await import('../../hooks/openfort/auth/requestEmailVerification.js')

      expect(() =>
        buildCallbackUrl({
          provider: 'email',
          callbackUrl: 'https://evil.com/callback',
          isOpen: false,
        })
      ).toThrow(/does not match the current origin/)
    })

    it('accepts same-origin callback URLs', async () => {
      const { buildCallbackUrl } = await import('../../hooks/openfort/auth/requestEmailVerification.js')

      // happy-dom sets window.location.origin to 'http://localhost'
      const result = buildCallbackUrl({
        provider: 'google',
        callbackUrl: '/auth/callback',
        isOpen: true,
      })

      expect(result).toContain(window.location.origin)
      expect(result).toContain('openfortAuthProvider=google')
      expect(result).toContain('openfortEmailVerificationUI=true')
    })

    it('defaults to current origin when no callbackUrl', async () => {
      const { buildCallbackUrl } = await import('../../hooks/openfort/auth/requestEmailVerification.js')

      const result = buildCallbackUrl({
        provider: 'email',
        isOpen: false,
      })

      expect(result).toContain(window.location.origin)
      expect(result).toContain('openfortAuthProvider=email')
    })

    it('appends email parameter when provided', async () => {
      const { buildCallbackUrl } = await import('../../hooks/openfort/auth/requestEmailVerification.js')

      const result = buildCallbackUrl({
        email: 'user@test.com',
        provider: 'email',
        isOpen: false,
      })

      expect(result).toContain('email=user%40test.com')
    })
  })
})
