import { ApiRequestError } from '../../errors/operation.js'
import { logger } from '../../utils/logger.js'

/**
 * Where funds should land, identified by CAIP-2 chain, asset, and wallet.
 *
 * @example
 * ```ts
 * import type { FundingTarget } from '@openfort/react'
 *
 * const target: FundingTarget = {
 *   chain: 'eip155:8453',
 *   currency: '0x0000000000000000000000000000000000000000',
 *   address: '0x1111111111111111111111111111111111111111',
 * }
 * ```
 */
export type FundingTarget = {
  /** CAIP-2 chain id, e.g. "eip155:8453" for Base. */
  chain: string
  /** Token contract address, or the zero address for the chain's native asset. */
  currency: string
  /** Destination wallet that receives the bridged funds. */
  address: string
}

/** The route the user commits to sending from. */
export type FundingSource = {
  /** CAIP-2 chain id the user sends from, e.g. "eip155:137". */
  chain: string
  /** Token contract the user sends, or the zero address for native. */
  currency: string
  /** Amount in the source token's smallest unit (wei, lamports, base units). */
  amount: string
}

/** Session lifecycle. */
export type SessionStatus =
  | 'requires_payment_method'
  | 'waiting_payment'
  | 'processing'
  | 'succeeded'
  | 'bounced'
  | 'expired'

export type FundingFee = {
  kind: 'gas' | 'relayerGas' | 'relayerService' | 'app'
  amount: string
  currency: string
}

/**
 * Fiat web2 funding methods — the rail the user sees, never the provider.
 *
 * @example
 * ```ts
 * import type { OnrampMethodId } from '@openfort/react'
 *
 * const method: OnrampMethodId = 'card'
 * ```
 */
export type OnrampMethodId = 'apple_pay' | 'google_pay' | 'card' | 'bank_transfer'

/**
 * How a resolved onramp executes: open a hosted `url`, an in-page provider SDK,
 * or Stripe's Link element flow.
 *
 * @example
 * ```ts
 * import type { OnrampAngle } from '@openfort/react'
 *
 * const angle: OnrampAngle = 'popup'
 * ```
 */
export type OnrampAngle = 'popup' | 'native' | 'embedded'

/**
 * The source and rail selected for a funding session.
 * `evm` and `solana` routes are self-custody wallet sends (they get wallet
 * deeplinks); `cex` is an exchange withdrawal (no deeplink — exchanges can't be
 * deeplinked into); `onramp` is a fiat purchase — the server resolves the
 * provider (buyer region + destination + project config) and the session
 * advances through the same lifecycle, driven by provider settlement webhooks
 * and server-side polls.
 *
 * @example
 * ```ts
 * import type { PaymentMethodInput } from '@openfort/react'
 *
 * const paymentMethod: PaymentMethodInput = {
 *   type: 'evm',
 *   source: { chain: 'eip155:1', currency: 'native', amount: '1000000000000000' },
 * }
 * ```
 */
export type PaymentMethodInput =
  | { type: 'evm'; source: FundingSource }
  | { type: 'solana'; source: FundingSource }
  | { type: 'cex'; cex: string; source: FundingSource }
  | {
      type: 'onramp'
      /** The fiat method the user picked (from `useFundingMethods`). */
      method: OnrampMethodId
      /** Fiat amount to prefill in the checkout, human units (e.g. "100.00"). */
      sourceAmount?: string
      /** ISO-4217 fiat currency for `sourceAmount`. */
      sourceCurrency?: string
      /** Buyer-country override (ISO-3166 alpha-2); defaults to the request IP. */
      country?: string
      /**
       * Integration angles this client can execute; omit for no restriction.
       * A client that can't run a flow (React Native has no DOM for `embedded`
       * elements) sends `['popup']` — routing then skips providers whose flow
       * resolves to an excluded angle, falling back to the hosted popup.
       */
      angles?: OnrampAngle[]
      /** URL the provider redirects back to after checkout. */
      redirectUrl?: string
      /** OTP-verified buyer email — wallet pay (`apple_pay`/`google_pay`) only. */
      email?: string
      /** OTP-verified US mobile in E.164 — wallet pay only. */
      phoneNumber?: string
      /** ISO-8601 time the phone OTP was verified — wallet pay only. */
      phoneNumberVerifiedAt?: string
      /** ISO-8601 time the buyer accepted the checkout terms — wallet pay only. */
      agreementAcceptedAt?: string
      /** Verification record ids from the OTP endpoints — wallet pay only. */
      smsVerificationId?: string
      emailVerificationId?: string
      /**
       * Embedded (headless) element flow: present after the client
       * authenticated the buyer with the provider's embedded auth element and
       * collected a payment method. The commit then creates a HEADLESS
       * provider session; redeem its secret via `sessions.onrampCheckout` for
       * performCheckout.
       */
      embedded?: {
        authIntentId: string
        customerRef: string
        paymentToken: string
      }
    }

/** A prefilled deeplink into a source wallet app (e.g. Trust Wallet). */
export type WalletDeeplink = { app: string; label: string; url: string }

/** Per-exchange guidance for the guided CEX flow. */
export type CexGuidance = {
  exchange: string
  network: string
  minWithdrawal: string | null
  requiresMemo: boolean
}

/**
 * A resolved crypto funding route with receiver details, fees, and wallet links.
 *
 * @example
 * ```ts
 * import type { CryptoPaymentMethod } from '@openfort/react'
 *
 * function receiverFor(method: CryptoPaymentMethod) {
 *   return method.receiverAddress
 * }
 * ```
 */
export type CryptoPaymentMethod = {
  type: 'evm' | 'solana' | 'cex'
  source: FundingSource
  /** Address the user (or their CEX/wallet) sends to. */
  receiverAddress: string
  /** Provider-side id used to track settlement. */
  providerRequestId: string
  /** BIP-21 / EIP-681 URI for QR. Scanner support for amount/token varies. */
  addressUri: string
  /** Prefilled deeplinks for source wallet apps, when available. */
  deeplinks: WalletDeeplink[]
  /** Guidance for the "cex" type; null otherwise. */
  cex: CexGuidance | null
  fees: FundingFee[]
  /** Minimum to send for this route (source base units), or null. */
  minAmount: string | null
}

/**
 * A committed fiat onramp. The executing provider was resolved server-side and
 * is never part of the response — render per `angle` and watch the session
 * status; the server advances it from settlement webhooks and provider polls.
 *
 * @example
 * ```ts
 * import type { OnrampPaymentMethod } from '@openfort/react'
 *
 * function checkoutUrl(method: OnrampPaymentMethod) {
 *   return method.angle === 'popup' ? method.url : null
 * }
 * ```
 */
export type OnrampPaymentMethod = {
  type: 'onramp'
  method: OnrampMethodId
  angle: OnrampAngle
  /** Hosted checkout URL to open, or null. */
  url: string | null
  /**
   * The provider's own session id for this commit — the Stripe Link (v2) flow
   * passes it to the coordinator's `performCheckout`.
   */
  providerSessionId?: string | null
  fees: FundingFee[]
  minAmount: string | null
}

/**
 * The payment method set on a funding session: a crypto route or a fiat onramp.
 *
 * @example
 * ```ts
 * import type { PaymentMethod } from '@openfort/react'
 *
 * function isFiat(method: PaymentMethod) {
 *   return method.type === 'onramp'
 * }
 * ```
 */
export type PaymentMethod = CryptoPaymentMethod | OnrampPaymentMethod

/**
 * The crypto payment method of a session, or null (none set, or fiat).
 *
 * @example
 * ```ts
 * import { cryptoPaymentMethod } from '@openfort/react'
 *
 * const receiver = cryptoPaymentMethod(session.paymentMethod)?.receiverAddress
 * ```
 */
export function cryptoPaymentMethod(pm: PaymentMethod | null | undefined): CryptoPaymentMethod | null {
  return pm && pm.type !== 'onramp' ? pm : null
}

/**
 * One fiat method row to render, resolved by the server for the session's
 * destination and the buyer's region. `provider` is telemetry — never shown.
 *
 * @example
 * ```ts
 * import type { ResolvedFundingMethod } from '@openfort/react'
 *
 * function rowLabel(row: ResolvedFundingMethod) {
 *   return row.label
 * }
 * ```
 */
export type ResolvedFundingMethod = {
  method: OnrampMethodId
  provider: string
  angle: OnrampAngle
  /** Server-resolved display label; bank_transfer shows the regional rail. */
  label: string
  /** The regional bank rail behind `label`, for bank_transfer. */
  rail?: 'ach' | 'sepa' | 'interac'
  /** Gate the row on device capability client-side (e.g. Apple Pay on Safari). */
  requiresDeviceCheck?: boolean
  /**
   * Provider PUBLISHABLE key for `embedded` rows — the pre-commit elements
   * (Stripe's Link auth) initialize with it. Public by design.
   */
  providerPublishableKey?: string
}

/**
 * The fiat methods resolved for a session + region.
 *
 * @example
 * ```ts
 * import type { ResolvedFundingMethods } from '@openfort/react'
 *
 * function hasFiat(resolved: ResolvedFundingMethods) {
 *   return resolved.methods.length > 0
 * }
 * ```
 */
export type ResolvedFundingMethods = {
  /** Resolved ISO-3166 alpha-2 country, or null for rest-of-world. */
  country: string | null
  methods: ResolvedFundingMethod[]
}

/**
 * A priced onramp route: what the entered fiat buys after fees.
 *
 * @example
 * ```ts
 * import type { OnrampQuote } from '@openfort/react'
 *
 * function receives(quote: OnrampQuote) {
 *   return `${quote.destinationAmount} ${quote.destinationCurrency}`
 * }
 * ```
 */
export type OnrampQuote = {
  provider: string
  sourceAmount: string
  sourceCurrency: string
  destinationAmount: string
  destinationCurrency: string
  destinationNetwork: string
  fees: Array<{ type: string; amount: string; currency: string }>
  exchangeRate: string
}

/**
 * Where a buyer stands with the onramp provider's identity checks.
 * `providedFields` names the requirements already satisfied (e.g.
 * `identifiers`, `attestation`), so the widget asks only for what's left.
 */
export type OnrampIdentity = {
  region: 'us' | 'eu' | null
  level: 'L0' | 'L1' | 'L2' | 'PENDING' | 'REJECTED' | 'REQUIRES_KYC'
  providedFields: string[]
}

/** Where a buyer stands on raising their spending limit. */
export type OnrampLimitUpgrade = {
  status: 'unrequested' | 'resubmit' | 'pending' | 'active' | 'inactive'
  /** False once the provider has stopped offering the upgrade at all. */
  available: boolean
}

/**
 * Spending limits for the buyer. `limits` keeps the provider's own shape and is
 * deliberately not narrowed — the field names have never been seen against live
 * data, and declaring a shape we haven't observed is how the payment element
 * ended up being asked for a card form on an Apple Pay purchase.
 *
 * The normalized fields beside it ARE safe to read. MONETARY VALUES ARE IN
 * MINOR UNITS (cents). `remainingTransactions: null` means unlimited, never
 * zero — the provider reports that as MaxInt32.
 */
export type OnrampLimits = {
  limits: Record<string, unknown> | null
  remainingMinor?: number | null
  remainingTransactions?: number | null
  upgrade?: OnrampLimitUpgrade | null
}

/**
 * A single deposit attempt and its current settlement state.
 *
 * @example
 * ```ts
 * import type { FundingSession } from '@openfort/react'
 *
 * function hasSettled(session: FundingSession) {
 *   return session.status === 'succeeded'
 * }
 * ```
 */
export type FundingSession = {
  id: string
  clientSecret: string
  target: FundingTarget
  status: SessionStatus
  amountUnits: string | null
  metadata: Record<string, string> | null
  externalId: string | null
  createdAt: number
  expiresAt: number
  paymentMethod: PaymentMethod | null
}

/** Parameters for a Coinbase pay-link request. The session binds the destination server-side. */
export type PayLinkParams = {
  /** Session the pay-link settles into — pins the destination so it can't be redirected. */
  sessionId: string
  /** Secret returned when the session was created; authorizes this pay-link. */
  clientSecret: string
  /** Amount in the destination asset's units (≈ USD for USDC). Coinbase enforces its own minimum. */
  amount: string
  /** Destination asset ticker. Optional — the backend defaults to USDC. */
  asset?: string
}

/**
 * Client interface used by the funding hooks, mirroring the `openfort.funding.*`
 * namespace in `@openfort/openfort-js`:
 *
 *   openfort.funding.sessions.create({ target })
 *   openfort.funding.sessions.setPaymentMethod(id, { clientSecret, paymentMethod })
 *   openfort.funding.sessions.get(id, { clientSecret? })
 *   openfort.funding.sessions.methods(id, { clientSecret, country? })
 *   openfort.funding.sessions.quote(id, { clientSecret, method, sourceAmount, sourceCurrency })
 *   openfort.funding.payLink(params)
 *
 * The hooks depend only on this interface, allowing callers to supply any
 * transport that implements the session and pay-link operations.
 *
 * @example
 * ```ts
 * import type { FundingClient } from '@openfort/react'
 *
 * async function loadSession(client: FundingClient, id: string, clientSecret: string) {
 *   return client.sessions.get(id, { clientSecret })
 * }
 * ```
 */
export type FundingClient = {
  /**
   * Provider-neutral embedded auth for the onramp's element flow. Both
   * 501/400 until the deployment configures the provider's embedded access.
   */
  authIntents: {
    create(params: { email: string }): Promise<{ id: string }>
    exchangeToken(intentId: string): Promise<{ exchanged: boolean }>
    /**
     * The buyer's verification state with the provider: which region's rules
     * apply, the tier they have reached, and which requirements they have
     * already satisfied. Drives the EU sub-steps — without it the widget has to
     * guess which ones a buyer still owes.
     */
    identity(params: { intentId: string; customerRef: string }): Promise<OnrampIdentity>
    /**
     * What the buyer may spend at their current tier. Amounts are in CENTS.
     * Null limits mean the provider didn't answer — treat as unrestricted
     * rather than blocking the purchase.
     */
    limits(
      params:
        | { intentId: string; walletAddress?: string; network?: string }
        /** The wallet-pay rail identifies the buyer by their verified phone. */
        | { phoneNumber: string; method: 'apple_pay' | 'google_pay' }
    ): Promise<OnrampLimits>
    /**
     * Start the provider-hosted identity form that raises the buyer's limit.
     * Hosted on purpose: the form collects a partial SSN, which must never
     * reach our code. The returned url is single-use and short-lived.
     */
    startLimitUpgrade(params: {
      phoneNumber: string
      method: 'apple_pay' | 'google_pay'
    }): Promise<{ url: string; expiresAt: string }>
  }
  sessions: {
    create(params: { target: FundingTarget }): Promise<FundingSession>
    setPaymentMethod(
      id: string,
      params: { clientSecret: string; paymentMethod: PaymentMethodInput }
    ): Promise<FundingSession>
    get(id: string, params?: { clientSecret?: string }): Promise<FundingSession>
    /** Resolve the fiat methods for this session's destination + buyer region. */
    methods(
      id: string,
      params: { clientSecret: string; country?: string; angles?: OnrampAngle[] }
    ): Promise<ResolvedFundingMethods>
    /**
     * Embedded (headless) checkout: confirm the committed headless onramp
     * with mandate acceptance and get the provider client secret for
     * performCheckout. One-shot; only valid after an `embedded` commit.
     */
    onrampCheckout(id: string, params: { clientSecret: string }): Promise<{ clientSecret: string }>
    /** Price a fiat route with the exact provider a commit would resolve. */
    quote(
      id: string,
      params: {
        clientSecret: string
        method: OnrampMethodId
        /** Fiat amount in human units, e.g. "100.00". */
        sourceAmount: string
        /** ISO-4217 fiat currency, e.g. "USD". */
        sourceCurrency: string
        country?: string
        /** Angles this client can execute — must match the commit's `angles`. */
        angles?: OnrampAngle[]
      }
    ): Promise<OnrampQuote>
  }
  payLink(params: PayLinkParams): Promise<string>
}

/**
 * The `openfort.funding` namespace shape in `@openfort/openfort-js` ≥ 2.2 —
 * structurally typed here because the installed SDK major predates it. Names
 * differ from {@link FundingClient} where the SDK chose its own vocabulary:
 * `sessions.checkout` (vs `onrampCheckout`), `embedded.*` (vs `authIntents`),
 * and `authIntentId` (vs `intentId`).
 */
type SdkFundingNamespace = {
  sessions: {
    create(params: { target: FundingTarget }): Promise<FundingSession>
    setPaymentMethod(
      id: string,
      params: { clientSecret?: string; paymentMethod: PaymentMethodInput }
    ): Promise<FundingSession>
    get(id: string, params?: { clientSecret?: string }): Promise<FundingSession>
    methods(
      id: string,
      params?: { clientSecret?: string; country?: string; angles?: OnrampAngle[] }
    ): Promise<ResolvedFundingMethods>
    quote(
      id: string,
      params: {
        method: OnrampMethodId
        sourceAmount: string
        sourceCurrency: string
        country?: string
        angles?: OnrampAngle[]
        clientSecret?: string
      }
    ): Promise<OnrampQuote>
    checkout(id: string, params?: { clientSecret?: string }): Promise<{ clientSecret: string }>
  }
  embedded: {
    createAuthIntent(params: { email: string }): Promise<{ id: string }>
    exchangeToken(intentId: string): Promise<void>
    identity(params: { authIntentId: string; customerRef: string }): Promise<OnrampIdentity>
  }
  limits(
    params:
      | { authIntentId: string; walletAddress?: string; network?: string }
      | { phoneNumber: string; method: 'apple_pay' | 'google_pay' }
  ): Promise<OnrampLimits>
  startLimitUpgrade(params: {
    phoneNumber: string
    method: 'apple_pay' | 'google_pay'
  }): Promise<{ url: string; expiresAt: string }>
  payLink(params: PayLinkParams): Promise<string>
}

const isFn = (value: unknown): value is (...args: never[]) => unknown => typeof value === 'function'

/**
 * Adopt the SDK's `openfort.funding` namespace as the {@link FundingClient},
 * or return null when the installed SDK predates any part of the surface —
 * partial adoption once shipped a `sessions` object without `onrampCheckout`
 * and broke the embedded checkout, so this is all-or-nothing.
 */
export function adoptSdkFundingClient(candidate: unknown): FundingClient | null {
  const sdk = candidate as SdkFundingNamespace | undefined
  const sessions = sdk?.sessions
  const complete =
    sessions &&
    isFn(sessions.create) &&
    isFn(sessions.setPaymentMethod) &&
    isFn(sessions.get) &&
    isFn(sessions.methods) &&
    isFn(sessions.quote) &&
    isFn(sessions.checkout) &&
    isFn(sdk?.embedded?.createAuthIntent) &&
    isFn(sdk?.embedded?.exchangeToken) &&
    isFn(sdk?.embedded?.identity) &&
    isFn(sdk?.limits) &&
    isFn(sdk?.startLimitUpgrade) &&
    isFn(sdk?.payLink)
  if (!sdk || !complete) return null
  return {
    authIntents: {
      create: (params) => sdk.embedded.createAuthIntent(params),
      exchangeToken: async (intentId) => {
        await sdk.embedded.exchangeToken(intentId)
        return { exchanged: true }
      },
      identity: ({ intentId, customerRef }) => sdk.embedded.identity({ authIntentId: intentId, customerRef }),
      limits: (params) =>
        sdk.limits(
          'phoneNumber' in params
            ? params
            : { authIntentId: params.intentId, walletAddress: params.walletAddress, network: params.network }
        ),
      startLimitUpgrade: (params) => sdk.startLimitUpgrade(params),
    },
    sessions: {
      create: (params) => sdk.sessions.create(params),
      setPaymentMethod: (id, params) => sdk.sessions.setPaymentMethod(id, params),
      get: (id, params) => sdk.sessions.get(id, params),
      methods: (id, params) => sdk.sessions.methods(id, params),
      onrampCheckout: (id, params) => sdk.sessions.checkout(id, params),
      quote: (id, params) => sdk.sessions.quote(id, params),
    },
    payLink: (params) => sdk.payLink(params),
  }
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // Funding endpoints may return either a structured error or a message string.
    // Both shapes are normalized so the provider's explanation remains readable.
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string }
    const message = typeof body.error === 'string' ? body.error : body.error?.message
    logger.error('[funding:client] request failed', { status: res.status, message })
    throw new ApiRequestError({ operation: 'Funding request', status: res.status, body: message })
  }
  return res.json() as Promise<T>
}

/**
 * Creates a fetch-backed funding client for the service at `baseUrl`.
 */
export function createFetchFundingClient(baseUrl: string, publishableKey?: string): FundingClient {
  // A configured publishable key authenticates every funding session request.
  const authHeaders = (): Record<string, string> =>
    publishableKey ? { authorization: `Bearer ${publishableKey}` } : {}
  return {
    authIntents: {
      async create({ email }) {
        const res = await fetch(`${baseUrl}/v2/funding/onramp/auth_intents`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ email }),
        })
        return readJson<{ id: string }>(res)
      },
      async exchangeToken(intentId) {
        const res = await fetch(`${baseUrl}/v2/funding/onramp/auth_intents/${encodeURIComponent(intentId)}/tokens`, {
          method: 'POST',
          headers: authHeaders(),
        })
        return readJson<{ exchanged: boolean }>(res)
      },
      async identity({ intentId, customerRef }) {
        const query = new URLSearchParams({ authIntentId: intentId, customerRef })
        const res = await fetch(`${baseUrl}/v2/funding/onramp/identity?${query}`, { headers: authHeaders() })
        return readJson<OnrampIdentity>(res)
      },
      async limits(params) {
        const query = new URLSearchParams()
        if ('phoneNumber' in params) {
          query.set('phoneNumber', params.phoneNumber)
          query.set('method', params.method)
        } else {
          query.set('authIntentId', params.intentId)
          if (params.walletAddress) query.set('walletAddress', params.walletAddress)
          if (params.network) query.set('network', params.network)
        }
        const res = await fetch(`${baseUrl}/v2/funding/onramp/limits?${query}`, { headers: authHeaders() })
        return readJson<OnrampLimits>(res)
      },
      async startLimitUpgrade(params) {
        const res = await fetch(`${baseUrl}/v2/funding/onramp/limits/upgrade`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify(params),
        })
        return readJson<{ url: string; expiresAt: string }>(res)
      },
    },
    sessions: {
      async create({ target }) {
        const res = await fetch(`${baseUrl}/v2/funding/sessions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ target }),
        })
        return readJson<FundingSession>(res)
      },
      async setPaymentMethod(id, { clientSecret, paymentMethod }) {
        const res = await fetch(`${baseUrl}/v2/funding/sessions/${encodeURIComponent(id)}/payment_methods`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ clientSecret, paymentMethod }),
        })
        return readJson<FundingSession>(res)
      },
      async get(id, params) {
        const query = params?.clientSecret ? `?clientSecret=${encodeURIComponent(params.clientSecret)}` : ''
        return readJson<FundingSession>(
          await fetch(`${baseUrl}/v2/funding/sessions/${encodeURIComponent(id)}${query}`, { headers: authHeaders() })
        )
      },
      async methods(id, { clientSecret, country, angles }) {
        const query = new URLSearchParams({ clientSecret })
        if (country) query.set('country', country)
        if (angles?.length) query.set('angles', angles.join(','))
        return readJson<ResolvedFundingMethods>(
          await fetch(`${baseUrl}/v2/funding/sessions/${encodeURIComponent(id)}/methods?${query.toString()}`, {
            headers: authHeaders(),
          })
        )
      },
      async onrampCheckout(id, { clientSecret }) {
        const res = await fetch(`${baseUrl}/v2/funding/sessions/${encodeURIComponent(id)}/onramp_checkout`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ clientSecret }),
        })
        return readJson<{ clientSecret: string }>(res)
      },
      async quote(id, params) {
        const res = await fetch(`${baseUrl}/v2/funding/sessions/${encodeURIComponent(id)}/quotes`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify(params),
        })
        return readJson<OnrampQuote>(res)
      },
    },
    async payLink(params) {
      const res = await fetch(`${baseUrl}/v2/funding/pay_link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(params),
      })
      const data = await readJson<{ url: string }>(res)
      return data.url
    },
  }
}
