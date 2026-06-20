import { type BuyProviderId, FundingMethod } from '../../Openfort/types'

/**
 * What a row routes into:
 * - `buy`: the existing fiat onramp flow, with a rail (provider) preselected.
 * - `crypto` / `wallet` / `cex`: the new funding-session Pages.
 */
export type DepositMethodTarget =
  | { kind: 'buy'; providerId: BuyProviderId }
  | { kind: 'crypto' }
  | { kind: 'wallet' }
  | { kind: 'cex' }

type DepositMethod = {
  id: FundingMethod
  title: string
  /** Speed/fee hint, e.g. "instant, ~4% fee". */
  subtitle: string
  target: DepositMethodTarget
  /** Only show on mobile devices (e.g. Apple Pay). */
  mobileOnly?: boolean
}

/** Context used to order/filter the rows for the current device. */
type PaymentOptionsContext = {
  isMobile: boolean
  /** When the funding backend is unavailable, crypto/CEX rows are disabled. */
  fundingAvailable: boolean
  /**
   * Integrator-selected methods, in display order. When set, only these show
   * (still subject to device/availability gating). Omit to show all.
   */
  methods?: FundingMethod[]
}

/** A row ready to render: resolved order, plus disabled state + reason. */
type ResolvedDepositOption = DepositMethod & {
  disabled: boolean
  disabledReason?: string
}

const ALL_METHODS: DepositMethod[] = [
  {
    id: FundingMethod.APPLE_PAY,
    title: 'Apple Pay',
    subtitle: 'No min · ~3.5% fee · Instant',
    target: { kind: 'buy', providerId: 'stripe' },
    mobileOnly: true,
  },
  {
    id: FundingMethod.CARD,
    title: 'Card',
    subtitle: 'Min $10 · ~4% fee · Instant',
    target: { kind: 'buy', providerId: 'stripe' },
  },
  {
    id: FundingMethod.WALLET,
    title: 'Transfer from wallet',
    subtitle: 'Min $1 · No fee · 10 sec',
    target: { kind: 'wallet' },
  },
  {
    id: FundingMethod.ADDRESS,
    title: 'Transfer from address',
    subtitle: 'Min $1 · No fee · 10 sec',
    target: { kind: 'crypto' },
  },
  {
    id: FundingMethod.EXCHANGE,
    title: 'Transfer from Exchange',
    subtitle: 'Min $1 · Network fee · 2 min',
    target: { kind: 'cex' },
  },
]

/**
 * Resolve the deposit rows for the current context: pick the integrator's
 * `methods` (or all) in order, filter device-incompatible rails, default-order
 * Apple Pay first on mobile when the order isn't explicit, and mark disabled
 * rows with a reason.
 */
export function getPaymentOptions(ctx: PaymentOptionsContext): ResolvedDepositOption[] {
  const explicitMethods = ctx.methods && ctx.methods.length > 0 ? ctx.methods : null
  const byId = new Map(ALL_METHODS.map((m) => [m.id, m]))
  const base = explicitMethods
    ? explicitMethods.map((id) => byId.get(id)).filter((m): m is DepositMethod => m !== undefined)
    : ALL_METHODS

  const visible = base.filter((m) => (m.mobileOnly ? ctx.isMobile : true))

  // Honor the integrator's explicit order; otherwise float Apple Pay first on mobile.
  const ordered =
    !explicitMethods && ctx.isMobile
      ? [...visible].sort((a, b) => Number(b.id === FundingMethod.APPLE_PAY) - Number(a.id === FundingMethod.APPLE_PAY))
      : visible

  return ordered.map((method) => {
    const fundingRail =
      method.target.kind === 'crypto' || method.target.kind === 'wallet' || method.target.kind === 'cex'
    if (fundingRail && !ctx.fundingAvailable) {
      return { ...method, disabled: true, disabledReason: 'Coming soon' }
    }
    return { ...method, disabled: false }
  })
}
