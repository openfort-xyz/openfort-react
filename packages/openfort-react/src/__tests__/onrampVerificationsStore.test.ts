import { afterEach, describe, expect, it } from 'vitest'
import { storedOnrampVerification, storeOnrampVerification } from '../hooks/openfort/onrampVerificationsApi'

describe('onramp verification store', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('returns a stored id for the same channel + destination', () => {
    storeOnrampVerification('sms', '+14155550123', {
      verificationId: 'onramp_verification_a',
      verificationExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(storedOnrampVerification('sms', '+14155550123')).toBe('onramp_verification_a')
  })

  it('misses on a different destination or channel', () => {
    storeOnrampVerification('sms', '+14155550123', { verificationId: 'onramp_verification_a' })
    expect(storedOnrampVerification('sms', '+14155550199')).toBeNull()
    expect(storedOnrampVerification('email', '+14155550123')).toBeNull()
  })

  it('expires with the verification window', () => {
    storeOnrampVerification('email', 'a@b.co', {
      verificationId: 'onramp_verification_b',
      verificationExpiresAt: new Date(Date.now() - 1_000).toISOString(),
    })
    expect(storedOnrampVerification('email', 'a@b.co')).toBeNull()
  })

  it('keeps an id with no expiry (server omitted it)', () => {
    storeOnrampVerification('email', 'a@b.co', { verificationId: 'onramp_verification_c' })
    expect(storedOnrampVerification('email', 'a@b.co')).toBe('onramp_verification_c')
  })
})
