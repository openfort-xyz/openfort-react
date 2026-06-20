import { describe, expect, it } from 'vitest'
import { FundingMethod } from '../components/Openfort/types'
import { getPaymentOptions } from '../components/Pages/Deposit/paymentOptions'

const ids = (opts: ReturnType<typeof getPaymentOptions>) => opts.map((o) => o.id)

describe('getPaymentOptions', () => {
  it('shows all methods by default on desktop (Apple Pay is mobile-only, hidden)', () => {
    const opts = getPaymentOptions({ isMobile: false, fundingAvailable: true })
    expect(ids(opts)).toEqual([FundingMethod.CARD, FundingMethod.WALLET, FundingMethod.ADDRESS, FundingMethod.EXCHANGE])
  })

  it('floats Apple Pay first on mobile when the order is not explicit', () => {
    const opts = getPaymentOptions({ isMobile: true, fundingAvailable: true })
    expect(ids(opts)[0]).toBe(FundingMethod.APPLE_PAY)
  })

  it('shows only the integrator-selected methods, in the given order', () => {
    const opts = getPaymentOptions({
      isMobile: false,
      fundingAvailable: true,
      methods: [FundingMethod.EXCHANGE, FundingMethod.WALLET],
    })
    expect(ids(opts)).toEqual([FundingMethod.EXCHANGE, FundingMethod.WALLET])
  })

  it('preserves an explicit order on mobile (no Apple-Pay reorder)', () => {
    const opts = getPaymentOptions({
      isMobile: true,
      fundingAvailable: true,
      methods: [FundingMethod.WALLET, FundingMethod.APPLE_PAY],
    })
    expect(ids(opts)).toEqual([FundingMethod.WALLET, FundingMethod.APPLE_PAY])
  })

  it('still applies the mobile-only gate to explicit methods (Apple Pay hidden on desktop)', () => {
    const opts = getPaymentOptions({
      isMobile: false,
      fundingAvailable: true,
      methods: [FundingMethod.APPLE_PAY, FundingMethod.ADDRESS],
    })
    expect(ids(opts)).toEqual([FundingMethod.ADDRESS])
  })

  it('disables the Relay-backed rails with a reason when funding is unavailable', () => {
    const opts = getPaymentOptions({ isMobile: false, fundingAvailable: false })
    const wallet = opts.find((o) => o.id === FundingMethod.WALLET)
    expect(wallet?.disabled).toBe(true)
    expect(wallet?.disabledReason).toBe('Coming soon')
    // Card (fiat onramp) stays enabled — it doesn't need the funding backend.
    expect(opts.find((o) => o.id === FundingMethod.CARD)?.disabled).toBe(false)
  })

  it('ignores unknown method ids', () => {
    const opts = getPaymentOptions({
      isMobile: false,
      fundingAvailable: true,
      methods: ['nope' as FundingMethod, FundingMethod.CARD],
    })
    expect(ids(opts)).toEqual([FundingMethod.CARD])
  })
})
