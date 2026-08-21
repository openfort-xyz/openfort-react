import { describe, expect, it } from 'vitest'
import { FundingMethod } from '../components/Openfort/types.js'
import { getPaymentOptions } from '../components/Pages/Deposit/paymentOptions.js'

type Ctx = Parameters<typeof getPaymentOptions>[0]

// Capability flags default to true so cases that don't exercise device gating
// still surface the wallet-pay rows; the Deposit hub passes the real UA-derived
// values (Apple Pay on Apple/Safari, Google Pay on Android/Chrome).
const ctx = (over: Partial<Ctx> = {}): Ctx => ({
  isMobile: false,
  fundingAvailable: true,
  canApplePay: true,
  canGooglePay: true,
  ...over,
})

const ids = (over?: Partial<Ctx>) => getPaymentOptions(ctx(over)).map((o) => o.id)

describe('getPaymentOptions', () => {
  it('shows wallet pay wherever the device can present it — desktop Safari included', () => {
    expect(ids()).toEqual([
      FundingMethod.APPLE_PAY,
      FundingMethod.GOOGLE_PAY,
      FundingMethod.CARD,
      FundingMethod.BANK_TRANSFER,
      FundingMethod.WALLET,
      FundingMethod.ADDRESS,
      FundingMethod.EXCHANGE,
    ])
  })

  it('gates each wallet-pay row on its device capability', () => {
    const apple = ids({ canApplePay: true, canGooglePay: false })
    expect(apple).toContain(FundingMethod.APPLE_PAY)
    expect(apple).not.toContain(FundingMethod.GOOGLE_PAY)

    const google = ids({ canApplePay: false, canGooglePay: true })
    expect(google).toContain(FundingMethod.GOOGLE_PAY)
    expect(google).not.toContain(FundingMethod.APPLE_PAY)
  })

  it('hides both wallet-pay rows when neither capability is present', () => {
    const none = ids({ canApplePay: false, canGooglePay: false })
    expect(none).not.toContain(FundingMethod.APPLE_PAY)
    expect(none).not.toContain(FundingMethod.GOOGLE_PAY)
    expect(none).toContain(FundingMethod.CARD)
    expect(none).toContain(FundingMethod.BANK_TRANSFER)
  })

  it('floats wallet pay first on mobile when the order is not explicit', () => {
    const first = ids({ isMobile: true })[0]
    expect([FundingMethod.APPLE_PAY, FundingMethod.GOOGLE_PAY]).toContain(first)
  })

  it('shows only the integrator-selected methods, in the given order', () => {
    const order = [FundingMethod.EXCHANGE, FundingMethod.WALLET]
    expect(ids({ methods: order })).toEqual(order)
  })

  it('preserves an explicit order on mobile (no wallet-pay reorder)', () => {
    const order = [FundingMethod.WALLET, FundingMethod.APPLE_PAY]
    expect(ids({ isMobile: true, methods: order })).toEqual(order)
  })

  it('still applies the capability gate to explicit methods', () => {
    expect(ids({ canApplePay: false, methods: [FundingMethod.APPLE_PAY, FundingMethod.ADDRESS] })).toEqual([
      FundingMethod.ADDRESS,
    ])
  })

  it('keeps fiat targets provider-agnostic (no providerId on the row)', () => {
    const card = getPaymentOptions(ctx()).find((o) => o.id === FundingMethod.CARD)
    expect(card?.target).toEqual({ kind: 'buy', method: FundingMethod.CARD })
    expect(card?.target).not.toHaveProperty('providerId')
  })

  it('disables the Relay-backed rails with a reason when funding is unavailable', () => {
    const opts = getPaymentOptions(ctx({ fundingAvailable: false }))
    const wallet = opts.find((o) => o.id === FundingMethod.WALLET)
    expect(wallet?.disabled).toBe(true)
    expect(wallet?.disabledReason).toBe('Coming soon')
    // Card (fiat onramp) stays enabled — it doesn't need the funding backend.
    expect(opts.find((o) => o.id === FundingMethod.CARD)?.disabled).toBe(false)
  })

  it('ignores unknown method ids', () => {
    expect(ids({ methods: ['nope' as FundingMethod, FundingMethod.CARD] })).toEqual([FundingMethod.CARD])
  })
})
