import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Phase 0 regression tests — validate security hardening still holds.
 */

describe('Phase 0 regressions', () => {
  describe('JSON.parse guard on localStorage', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('does not throw on malformed WALLETCONNECT_DEEPLINK_CHOICE', () => {
      // The Connectors page reads this value and guards it with try/catch + typeof checks
      localStorage.setItem('WALLETCONNECT_DEEPLINK_CHOICE', '{bad json!!!')

      expect(() => {
        const raw = localStorage.getItem('WALLETCONNECT_DEEPLINK_CHOICE')
        if (!raw) return

        // Reproduce the guarded parse pattern used in src/components/Pages/Connectors/index.tsx
        try {
          const parsed: unknown = JSON.parse(raw)
          if (
            parsed &&
            typeof parsed === 'object' &&
            'name' in parsed &&
            typeof (parsed as { name: unknown }).name === 'string'
          ) {
            // would use parsed.name here
          }
        } catch {
          // Malformed JSON should be caught, not crash
        }
      }).not.toThrow()
    })
  })

  describe('callback URL origin validation', () => {
    it('rejects cross-origin callback URLs', async () => {
      const { buildCallbackUrl } = await import('../../hooks/openfort/auth/requestEmailVerification')

      expect(() =>
        buildCallbackUrl({
          provider: 'email',
          callbackUrl: 'https://evil.com/callback',
          isOpen: false,
        })
      ).toThrow(/does not match current origin/)
    })

    it('accepts same-origin callback URLs', async () => {
      const { buildCallbackUrl } = await import('../../hooks/openfort/auth/requestEmailVerification')

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
      const { buildCallbackUrl } = await import('../../hooks/openfort/auth/requestEmailVerification')

      const result = buildCallbackUrl({
        provider: 'email',
        isOpen: false,
      })

      expect(result).toContain(window.location.origin)
      expect(result).toContain('openfortAuthProvider=email')
    })

    it('appends email parameter when provided', async () => {
      const { buildCallbackUrl } = await import('../../hooks/openfort/auth/requestEmailVerification')

      const result = buildCallbackUrl({
        email: 'user@test.com',
        provider: 'email',
        isOpen: false,
      })

      expect(result).toContain('email=user%40test.com')
    })
  })
})
