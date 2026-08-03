// Loader for Stripe's v2 crypto-onramp coordinator (embedded components).
// Injected the same way StripeOnrampEmbed loads the legacy widget script —
// Stripe requires loading from its own origin (no npm bundle), and the script
// puts `loadCryptoOnrampAndInitialize` on window.
const SCRIPT_SRC = 'https://js.stripe.com/crypto-onramp/v1/crypto-onramp.js'

/** The buyer's Link authentication outcome. */
export type StripeAuthenticationResult = {
  crypto_customer_id?: string
  result: 'success' | 'abandoned' | 'declined'
}

/** collectPaymentMethod's completion payload — the token the commit needs. */
export type StripeCollectPaymentMethodResult = {
  cryptoPaymentToken: string
  paymentMethodDetails: { type: string } | null
}

export type StripeKycInfo = {
  given_name?: string
  surname?: string
  address?: {
    country: string
    city?: string
    line1?: string
    line2?: string
    postal_code?: string
    state?: string
  }
  id_number?: { type: 'us_ssn'; value: string }
  date_of_birth?: { day: number; month: number; year: number }
}

/**
 * The subset of Stripe's OnrampCoordinator the widget uses. `authenticate` and
 * `collectPaymentMethod` resolve with elements the caller mounts; the rest are
 * plain calls.
 */
export type StripeOnrampCoordinator = {
  registerLinkUser: (email: string, phone: string, country: string, fullName?: string) => Promise<{ created: boolean }>
  authenticate: (
    linkAuthIntentId: string,
    onCompletion: (result: StripeAuthenticationResult) => void
  ) => Promise<HTMLElement | null>
  submitKycInfo: (params: StripeKycInfo) => Promise<void>
  registerWalletAddress: (walletAddress: string, network: string) => Promise<{ id: string }>
  collectPaymentMethod: (
    options: {
      payment_method_types: string[]
      wallets: { applePay: 'auto' | 'never'; googlePay: 'auto' | 'never' }
    },
    onCompletion: (result: StripeCollectPaymentMethodResult) => void
  ) => Promise<HTMLElement>
  performCheckout: (
    onrampSessionId: string,
    checkout: (onrampSessionId: string) => Promise<string>
  ) => Promise<{ successful: boolean }>
  destroy: () => void
}

type CoordinatorConstructor = (
  publishableKey: string,
  options?: { theme?: 'stripe' | 'night' | 'flat' }
) => StripeOnrampCoordinator

declare global {
  interface Window {
    loadCryptoOnrampAndInitialize?: CoordinatorConstructor
  }
}

let scriptPromise: Promise<CoordinatorConstructor> | null = null

function loadScript(): Promise<CoordinatorConstructor> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Stripe onramp needs a browser'))
  if (window.loadCryptoOnrampAndInitialize) return Promise.resolve(window.loadCryptoOnrampAndInitialize)
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    // Stripe ships this as an ES module (relative imports) — a classic script
    // parse-fails silently, so the type matters.
    script.type = 'module'
    script.onload = () => {
      // The module graph may finish setting the global a tick after onload.
      const deadline = Date.now() + 5_000
      const check = () => {
        if (window.loadCryptoOnrampAndInitialize) resolve(window.loadCryptoOnrampAndInitialize)
        else if (Date.now() > deadline) reject(new Error('Stripe crypto-onramp missing after script load'))
        else setTimeout(check, 100)
      }
      check()
    }
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Failed to load the Stripe crypto-onramp script'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/** Load Stripe's script (once) and initialize a coordinator for the key. */
export async function createStripeOnrampCoordinator(
  publishableKey: string,
  options?: { theme?: 'stripe' | 'night' | 'flat' }
): Promise<StripeOnrampCoordinator> {
  const initialize = await loadScript()
  const coordinator = await initialize(publishableKey, options)
  if (!coordinator) throw new Error('Stripe crypto-onramp failed to initialize')
  return coordinator
}

/** Stripe's network names, from the session target's CAIP-2 chain id. */
export function stripeNetworkForChain(chain: string): string | null {
  if (chain.startsWith('solana')) return 'solana'
  const byEvmId: Record<string, string> = {
    '1': 'ethereum',
    '10': 'optimism',
    '137': 'polygon',
    '8453': 'base',
    '42161': 'arbitrum',
    '43114': 'avalanche',
  }
  const evmId = chain.startsWith('eip155:') ? chain.slice('eip155:'.length) : null
  return evmId ? (byEvmId[evmId] ?? null) : null
}
