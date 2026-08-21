import { afterEach, describe, expect, it } from 'vitest'
import { storedOnrampVerification, storeOnrampVerification } from '../hooks/openfort/onrampVerificationsApi.js'

const STORE_KEY = 'openfort-onramp-verifications'

describe('onramp verification store', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('returns a stored id for the same channel + destination', async () => {
    await storeOnrampVerification('sms', '+14155550123', {
      verificationId: 'onramp_verification_a',
      verificationExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(await storedOnrampVerification('sms', '+14155550123')).toBe('onramp_verification_a')
  })

  it('misses on a different destination or channel', async () => {
    await storeOnrampVerification('sms', '+14155550123', { verificationId: 'onramp_verification_a' })
    expect(await storedOnrampVerification('sms', '+14155550199')).toBeNull()
    expect(await storedOnrampVerification('email', '+14155550123')).toBeNull()
  })

  it('expires with the verification window', async () => {
    await storeOnrampVerification('email', 'a@b.co', {
      verificationId: 'onramp_verification_b',
      verificationExpiresAt: new Date(Date.now() - 1_000).toISOString(),
    })
    expect(await storedOnrampVerification('email', 'a@b.co')).toBeNull()
  })

  it('keeps an id with no expiry (server omitted it)', async () => {
    await storeOnrampVerification('email', 'a@b.co', { verificationId: 'onramp_verification_c' })
    expect(await storedOnrampVerification('email', 'a@b.co')).toBe('onramp_verification_c')
  })

  it('never writes the destination itself to storage', async () => {
    await storeOnrampVerification('sms', '+14155550123', { verificationId: 'onramp_verification_d' })
    await storeOnrampVerification('email', 'buyer@example.com', { verificationId: 'onramp_verification_e' })
    const raw = window.localStorage.getItem(STORE_KEY) ?? ''
    expect(raw).not.toContain('+14155550123')
    expect(raw).not.toContain('4155550123')
    expect(raw).not.toContain('buyer@example.com')
    expect(raw).toContain('onramp_verification_d')
  })
})
