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
  /** ISO-3166 alpha-2 codes. REQUIRED for buyers with an EU address. */
  nationalities?: string[]
  /** Required by Stripe for buyers with an EU address. */
  birth_city?: string
  birth_country?: string
}

/** How a wallet sheet is offered in the payment element. */
export type StripeWalletPreference = 'auto' | 'never' | 'always'

/** The EU regimes that make Stripe ask for more than basic identity. */
export type StripeRegulationType = 'eu_carf' | 'eu_mica'

/** One national identifier, e.g. `{ type: 'de_stn', value: '…' }`. */
export type StripeIdentifier = { type: string; value: string }

export type StripeIdentifierRequirement = { type: string; regulation: StripeRegulationType }

/**
 * A requirement Stripe will accept in more than one form — e.g. Malta takes an
 * identity card OR a passport. Satisfying any member of the alternative set
 * clears the originals.
 */
export type StripeAlternativeGroup = {
  original_missing_identifiers: string[]
  alternative_missing_identifiers: string[]
}

export type StripeIdentifierRequirements = {
  identifiers: StripeIdentifierRequirement[]
  alternatives: StripeAlternativeGroup[]
  carf_tin_required: boolean
}

/** updateKycInfo's verdict: `completed` ends the loop, anything listed repeats it. */
export type StripeUpdateKycResult = StripeIdentifierRequirements & {
  completed: boolean
  invalid_identifiers: string[]
}

/** The destination wallet as Link holds it; unverified ones need a signature. */
export type StripeConsumerWallet = {
  id: string
  verified_ownership?: boolean
}

/** A message the buyer's wallet must sign to prove ownership (EU travel rule). */
export type StripeWalletOwnershipChallenge = {
  challengeId: string
  message: string
  walletAddress?: string
  network?: string
  expiresAt?: string
}

export type StripeAttestationResult = { result: 'confirmed' | 'abandoned' }

/**
 * The subset of Stripe's OnrampCoordinator the widget uses. `authenticate` and
 * `collectPaymentMethod` resolve with elements the caller mounts; the rest are
 * plain calls.
 *
 * Hand-written against `@stripe/crypto` because the runtime is script-injected
 * rather than bundled. Keep member types identical to the published ones: a
 * narrower copy silently hides capability — this declared the wallet
 * preferences as 'auto' | 'never', which is why nothing caught the payment
 * element being asked for a card form on an Apple Pay purchase.
 */
export type StripeOnrampCoordinator = {
  registerLinkUser: (email: string, phone: string, country: string, fullName?: string) => Promise<{ created: boolean }>
  authenticate: (
    linkAuthIntentId: string,
    onCompletion: (result: StripeAuthenticationResult) => void
  ) => Promise<HTMLElement | null>
  submitKycInfo: (params: StripeKycInfo) => Promise<void>
  registerWalletAddress: (walletAddress: string, network: string) => Promise<StripeConsumerWallet>
  /** Which national identifiers this buyer still owes, per EU regulation. */
  getMissingIdentifiers: () => Promise<StripeIdentifierRequirements>
  /** Submit identifiers; repeat while `completed` is false. */
  updateKycInfo: (identifiers: StripeIdentifier[]) => Promise<StripeUpdateKycResult>
  /** Mounts the CARF/CRS self-declaration element the buyer confirms. */
  promptUserAttestation: (
    regulation: StripeRegulationType,
    onCompletion: (result: StripeAttestationResult) => void
  ) => Promise<HTMLElement>
  /** Mounts the document-capture element for the L2 step-up. */
  verifyDocuments: () => Promise<{ result: 'success' | 'abandoned' }>
  getWalletOwnershipChallenge: (params: {
    walletAddress: string
    network: string
  }) => Promise<StripeWalletOwnershipChallenge>
  submitWalletOwnershipSignature: (params: { challengeId: string; signature: string }) => Promise<void>
  collectPaymentMethod: (
    options: {
      payment_method_types: string[]
      wallets: { applePay: StripeWalletPreference; googlePay: StripeWalletPreference }
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
