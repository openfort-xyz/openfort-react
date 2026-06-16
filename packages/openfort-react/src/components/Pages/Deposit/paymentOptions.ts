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

/** Context used to order/filter the rows for the current device + region. */
type PaymentOptionsContext = {
  isMobile: boolean
  /** When the funding backend is unavailable, crypto/CEX rows are disabled. */
  fundingAvailable: boolean
  /**
   * Integrator-selected methods, in display order. When set, only these show
   * (still subject to device/availability gating). Omit to show all.
   */
  methods?: FundingMethod[]
  /**
   * ISO-3166 region of the user, when known. Used to disable region-blocked
   * rails with a reason.
   * TODO(openfort-funding-backend): source this from the platform/geo config.
   */
  region?: string | null
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
    subtitle: 'instant',
    target: { kind: 'buy', providerId: 'stripe' },
    mobileOnly: true,
  },
  {
    id: FundingMethod.CARD,
    title: 'Card',
    subtitle: 'instant, ~4% fee',
    target: { kind: 'buy', providerId: 'stripe' },
  },
  {
    id: FundingMethod.WALLET,
    title: 'Transfer from wallet',
    subtitle: 'MetaMask, Phantom, …',
    target: { kind: 'wallet' },
  },
  {
    id: FundingMethod.ADDRESS,
    title: 'Transfer from address',
    subtitle: 'from any chain',
    target: { kind: 'crypto' },
  },
  {
    id: FundingMethod.EXCHANGE,
    title: 'Transfer from Exchange',
    subtitle: 'Binance, Coinbase',
    target: { kind: 'cex' },
  },
]

// TODO(openfort-funding-backend): drive region blocks from a server-provided
// availability map instead of this placeholder (no rails are blocked yet).
const REGION_BLOCKED: Partial<Record<FundingMethod, string[]>> = {}

function isRegionBlocked(method: DepositMethod, region?: string | null): boolean {
  if (!region) return false
  return REGION_BLOCKED[method.id]?.includes(region) ?? false
}

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
    if (isRegionBlocked(method, ctx.region)) {
      return { ...method, disabled: true, disabledReason: 'Not available in your region' }
    }
    const fundingRail =
      method.target.kind === 'crypto' || method.target.kind === 'wallet' || method.target.kind === 'cex'
    if (fundingRail && !ctx.fundingAvailable) {
      return { ...method, disabled: true, disabledReason: 'Coming soon' }
    }
    return { ...method, disabled: false }
  })
}
