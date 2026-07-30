import { ApiRequestError } from '../../errors/operation.js'
import { logger } from '../../utils/logger.js'

/** Where funds should land. CAIP-2 chain + token contract (or native) + wallet. */
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
 * Payment-method-per-source input. `evm` and `solana` are self-custody wallet
 * sends (they get wallet deeplinks); `cex` is an exchange withdrawal (no
 * deeplink — exchanges can't be deeplinked into).
 */
export type PaymentMethodInput =
  | { type: 'evm'; source: FundingSource }
  | { type: 'solana'; source: FundingSource }
  | { type: 'cex'; cex: string; source: FundingSource }

export type PaymentMethodType = PaymentMethodInput['type']

/** A prefilled deeplink into a source wallet app (e.g. Trust Wallet). */
export type WalletDeeplink = { app: string; label: string; url: string }

/** Per-exchange guidance for the guided CEX flow. */
export type CexGuidance = {
  exchange: string
  network: string
  minWithdrawal: string | null
  requiresMemo: boolean
}

/** A resolved payment method — what the UI renders and the agent reads. */
export type PaymentMethod = {
  type: PaymentMethodType
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

/** A single deposit attempt. */
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

/** Parameters for a Coinbase pay-link request. The destination (chain, currency,
 * address) is bound to the session server-side; the client only chooses how much. */
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
 * The funding client surface, mirroring the planned `openfort.funding.*`
 * namespace in `@openfort/openfort-js`:
 *
 *   openfort.funding.sessions.create({ target })
 *   openfort.funding.sessions.setPaymentMethod(id, { clientSecret, paymentMethod })
 *   openfort.funding.sessions.get(id, { clientSecret? })
 *   openfort.funding.payLink(params)
 *
 * `useFunding` depends only on this interface. Today it's backed by the
 * fetch adapter below (the standalone funding service); once the SDK ships the
 * namespace, the adapter is swapped for `coreClient.funding` with no hook change.
 */
export type FundingClient = {
  sessions: {
    create(params: { target: FundingTarget }): Promise<FundingSession>
    setPaymentMethod(
      id: string,
      params: { clientSecret: string; paymentMethod: PaymentMethodInput }
    ): Promise<FundingSession>
    get(id: string, params?: { clientSecret?: string }): Promise<FundingSession>
  }
  payLink(params: PayLinkParams): Promise<string>
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // The API returns { error: { type, message } }; the standalone prototype
    // returned a flat { error: string }. Handle both so the real rail message
    // surfaces instead of "[object Object]".
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string }
    const message = typeof body.error === 'string' ? body.error : body.error?.message
    logger.error('[funding:client] request failed', { status: res.status, message })
    throw new ApiRequestError({ operation: 'Funding request', status: res.status, body: message })
  }
  return res.json() as Promise<T>
}

/**
 * Fetch-backed funding client against the standalone funding service at
 * `baseUrl`. Temporary: replaced by the SDK's `funding` namespace at cutover.
 */
export function createFetchFundingClient(baseUrl: string, publishableKey?: string): FundingClient {
  // The /v2/funding session API is publishable-key authenticated. The standalone
  // prototype accepted no auth, so the key is optional and only attached when set.
  const authHeaders = (): Record<string, string> =>
    publishableKey ? { authorization: `Bearer ${publishableKey}` } : {}
  return {
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
