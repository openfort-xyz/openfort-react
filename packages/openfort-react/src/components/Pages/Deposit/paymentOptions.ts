import { FundingMethod } from '../../Openfort/types'

/**
 * What a row routes into:
 * - `buy`: the fiat onramp flow. The PROVIDER is resolved by Openfort (region +
 *   destination asset) — it is never shown to or chosen by the end user.
 * - `crypto` / `wallet` / `cex`: the funding-session Pages.
 */
export type DepositMethodTarget =
  | { kind: 'buy'; method: FundingMethod }
  | { kind: 'crypto' }
  | { kind: 'wallet' }
  | { kind: 'cex' }

type DepositMethod = {
  id: FundingMethod
  title: string
  /** Speed/fee hint, e.g. "instant, ~4% fee". */
  subtitle: string
  target: DepositMethodTarget
  /** Wallet-pay rows that require a device/browser capability check. */
  device?: 'apple' | 'google'
}

/** Context used to order/filter the rows for the current device. */
type PaymentOptionsContext = {
  isMobile: boolean
  /** When the funding backend is unavailable, crypto/CEX rows are disabled. */
  fundingAvailable: boolean
  /** Apple Pay is offered only where the browser/device can present it. */
  canApplePay?: boolean
  /** Google Pay is offered only where the browser/device can present it. */
  canGooglePay?: boolean
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

// Fiat subtitles carry only the speed of the rail. Fees and limits vary by
// provider, region, and amount — the real numbers come from the live quote on
// the amount screen, never hardcoded copy here.
const ALL_METHODS: DepositMethod[] = [
  {
    id: FundingMethod.APPLE_PAY,
    title: 'Apple Pay',
    subtitle: 'Instant',
    target: { kind: 'buy', method: FundingMethod.APPLE_PAY },
    device: 'apple',
  },
  {
    id: FundingMethod.GOOGLE_PAY,
    title: 'Google Pay',
    subtitle: 'Instant',
    target: { kind: 'buy', method: FundingMethod.GOOGLE_PAY },
    device: 'google',
  },
  {
    id: FundingMethod.CARD,
    title: 'Card',
    subtitle: 'Instant',
    target: { kind: 'buy', method: FundingMethod.CARD },
  },
  {
    id: FundingMethod.BANK_TRANSFER,
    title: 'Bank transfer',
    subtitle: '1–3 business days',
    target: { kind: 'buy', method: FundingMethod.BANK_TRANSFER },
  },
  {
    id: FundingMethod.WALLET,
    title: 'Transfer from wallet',
    subtitle: 'Min $1 · Bridge fee · 10 sec',
    target: { kind: 'wallet' },
  },
  {
    id: FundingMethod.ADDRESS,
    title: 'Transfer from address',
    subtitle: 'Min $1 · Bridge fee · 10 sec',
    target: { kind: 'crypto' },
  },
  {
    id: FundingMethod.EXCHANGE,
    title: 'Transfer from Exchange',
    subtitle: 'Min $5 · Network fee · 2 min',
    target: { kind: 'cex' },
  },
]

/**
 * Whether this browser can present the Apple Pay sheet — Safari on macOS and
 * iOS, so desktop Safari counts too. ApplePaySession throws in insecure
 * contexts; treat any failure as "can't".
 */
export function canPresentApplePay(): boolean {
  try {
    const session = (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession
    return Boolean(session?.canMakePayments?.())
  } catch {
    return false
  }
}

/**
 * A wallet-pay row is shown wherever the device/browser can actually present
 * that wallet — a capability check, not a mobile check (desktop Safari presents
 * Apple Pay).
 */
function deviceAllowed(method: DepositMethod, ctx: PaymentOptionsContext): boolean {
  if (method.device === 'apple') return ctx.canApplePay ?? false
  if (method.device === 'google') return ctx.canGooglePay ?? false
  return true
}

/**
 * Resolve the deposit rows for the current context: pick the integrator's
 * `methods` (or all) in order, filter device-incompatible wallet pay, float
 * wallet pay first on mobile when the order isn't explicit, and mark unavailable
 * rows disabled with a reason.
 */
export function getPaymentOptions(ctx: PaymentOptionsContext): ResolvedDepositOption[] {
  const explicitMethods = ctx.methods && ctx.methods.length > 0 ? ctx.methods : null
  const byId = new Map(ALL_METHODS.map((m) => [m.id, m]))
  const base = explicitMethods
    ? explicitMethods.map((id) => byId.get(id)).filter((m): m is DepositMethod => m !== undefined)
    : ALL_METHODS

  const visible = base.filter((m) => deviceAllowed(m, ctx))

  // Honor the integrator's explicit order; otherwise float wallet pay first on mobile.
  const ordered =
    !explicitMethods && ctx.isMobile
      ? [...visible].sort((a, b) => Number(Boolean(b.device)) - Number(Boolean(a.device)))
      : visible

  return ordered.map((method) => {
    const kind = method.target.kind
    // Fiat (card/Apple Pay) and exchange rails stay visible on testnet so the demo
    // shows the full feature set; the final pay action is blocked downstream
    // (BuyProcessing / DepositCex) with a testnet notice, since they settle on mainnet.
    const fundingRail = kind === 'crypto' || kind === 'wallet' || kind === 'cex'
    if (fundingRail && !ctx.fundingAvailable) {
      return { ...method, disabled: true, disabledReason: 'Coming soon' }
    }
    return { ...method, disabled: false }
  })
}
