import type { BuyProviderId } from '../../Openfort/types'

/** The deposit methods surfaced in the hub. */
type DepositMethodId = 'applePay' | 'card' | 'crypto' | 'wallet' | 'cex'

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
  id: DepositMethodId
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
    id: 'applePay',
    title: 'Apple Pay',
    subtitle: 'instant',
    target: { kind: 'buy', providerId: 'stripe' },
    mobileOnly: true,
  },
  {
    id: 'card',
    title: 'Card',
    subtitle: 'instant, ~4% fee',
    target: { kind: 'buy', providerId: 'stripe' },
  },
  {
    id: 'wallet',
    title: 'Transfer from wallet',
    subtitle: 'MetaMask, Phantom, …',
    target: { kind: 'wallet' },
  },
  {
    id: 'crypto',
    title: 'Transfer from address',
    subtitle: 'from any chain',
    target: { kind: 'crypto' },
  },
  {
    id: 'cex',
    title: 'Transfer from Exchange',
    subtitle: 'Binance, Coinbase',
    target: { kind: 'cex' },
  },
]

// TODO(openfort-funding-backend): drive region blocks from a server-provided
// availability map instead of this placeholder (no rails are blocked yet).
const REGION_BLOCKED: Partial<Record<DepositMethodId, string[]>> = {}

function isRegionBlocked(method: DepositMethod, region?: string | null): boolean {
  if (!region) return false
  return REGION_BLOCKED[method.id]?.includes(region) ?? false
}

/**
 * Resolve the deposit rows for the current context: filter device-incompatible
 * rails, order them (Apple Pay first on mobile), and mark disabled rows with a
 * reason.
 */
export function getPaymentOptions(ctx: PaymentOptionsContext): ResolvedDepositOption[] {
  const visible = ALL_METHODS.filter((m) => (m.mobileOnly ? ctx.isMobile : true))

  const ordered = ctx.isMobile
    ? [...visible].sort((a, b) => Number(b.id === 'applePay') - Number(a.id === 'applePay'))
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
