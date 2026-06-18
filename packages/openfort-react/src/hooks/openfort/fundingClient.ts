import type { FundingSession, FundingTarget, PayLinkParams, PaymentMethodInput } from './useFunding'

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
