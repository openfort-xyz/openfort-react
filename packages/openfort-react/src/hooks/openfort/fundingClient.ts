import { logger } from '../../utils/logger'
import type {
  FundingSession,
  FundingTarget,
  OnrampMethodId,
  OnrampQuote,
  PayLinkParams,
  PaymentMethodInput,
  ResolvedFundingMethods,
} from './useFunding'

/**
 * The funding client surface, mirroring the `openfort.funding.*` namespace in
 * `@openfort/openfort-js`:
 *
 *   openfort.funding.sessions.create({ target })
 *   openfort.funding.sessions.setPaymentMethod(id, { clientSecret, paymentMethod })
 *   openfort.funding.sessions.get(id, { clientSecret? })
 *   openfort.funding.sessions.methods(id, { clientSecret, country? })
 *   openfort.funding.sessions.quote(id, { clientSecret, method, sourceAmount, sourceCurrency })
 *   openfort.funding.payLink(params)
 *
 * The hooks depend only on this interface. Today it's backed by the fetch
 * adapter below; once the SDK's namespace covers all calls, the adapter is
 * swapped for `coreClient.funding` with no hook change.
 */
export type FundingClient = {
  /**
   * Stripe Link auth for the v2 embedded-components onramp. Both 501/400 until
   * the deployment configures the crypto_onramp_beta=v2 access.
   */
  stripeLink: {
    createAuthIntent(params: { email: string }): Promise<{ id: string }>
    exchangeToken(intentId: string): Promise<{ exchanged: boolean }>
  }
  sessions: {
    create(params: { target: FundingTarget }): Promise<FundingSession>
    setPaymentMethod(
      id: string,
      params: { clientSecret: string; paymentMethod: PaymentMethodInput }
    ): Promise<FundingSession>
    get(id: string, params?: { clientSecret?: string }): Promise<FundingSession>
    /** Resolve the fiat methods for this session's destination + buyer region. */
    methods(id: string, params: { clientSecret: string; country?: string }): Promise<ResolvedFundingMethods>
    /**
     * Stripe Link (v2 headless) checkout: confirm the committed headless onramp
     * with mandate acceptance and get the provider client secret for
     * performCheckout. One-shot; only valid after a `stripeLink` commit.
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
      }
    ): Promise<OnrampQuote>
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
    throw new Error(message ?? `Funding request failed (${res.status})`)
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
    stripeLink: {
      async createAuthIntent({ email }) {
        const res = await fetch(`${baseUrl}/v2/funding/onramp/stripe/link_auth_intents`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ email }),
        })
        return readJson<{ id: string }>(res)
      },
      async exchangeToken(intentId) {
        const res = await fetch(
          `${baseUrl}/v2/funding/onramp/stripe/link_auth_intents/${encodeURIComponent(intentId)}/tokens`,
          { method: 'POST', headers: authHeaders() }
        )
        return readJson<{ exchanged: boolean }>(res)
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
      async methods(id, { clientSecret, country }) {
        const query = new URLSearchParams({ clientSecret })
        if (country) query.set('country', country)
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
