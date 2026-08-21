import { describe, expect, it } from 'vitest'
import { FundingMethod } from '../components/Openfort/types.js'
import { isCompleteWalletPay, isWalletPayMethod } from '../hooks/openfort/walletPay.js'

describe('isWalletPayMethod', () => {
  it('is true only for Apple/Google Pay (the native-angle methods)', () => {
    expect(isWalletPayMethod(FundingMethod.APPLE_PAY)).toBe(true)
    expect(isWalletPayMethod(FundingMethod.GOOGLE_PAY)).toBe(true)
    expect(isWalletPayMethod(FundingMethod.CARD)).toBe(false)
    expect(isWalletPayMethod(FundingMethod.BANK_TRANSFER)).toBe(false)
  })
})

describe('isCompleteWalletPay', () => {
  const full = {
    email: 'buyer@example.com',
    phoneNumber: '+14155550123',
    phoneNumberVerifiedAt: '2026-07-07T12:00:00.000Z',
    agreementAcceptedAt: '2026-07-07T12:01:00.000Z',
  }

  it('is true only when every field is present and non-empty', () => {
    expect(isCompleteWalletPay(full)).toBe(true)
  })

  it('is false for null / partial / empty-string fields', () => {
    expect(isCompleteWalletPay(null)).toBe(false)
    expect(isCompleteWalletPay(undefined)).toBe(false)
    expect(isCompleteWalletPay({ ...full, phoneNumberVerifiedAt: undefined })).toBe(false)
    expect(isCompleteWalletPay({ ...full, email: '' })).toBe(false)
    expect(isCompleteWalletPay({ email: full.email })).toBe(false)
  })
})
