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
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Funding request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

/**
 * Fetch-backed funding client against the standalone funding service at
 * `baseUrl`. Temporary: replaced by the SDK's `funding` namespace at cutover.
 */
export function createFetchFundingClient(baseUrl: string): FundingClient {
  return {
    sessions: {
      async create({ target }) {
        const res = await fetch(`${baseUrl}/v1/funding/sessions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ target }),
        })
        return readJson<FundingSession>(res)
      },
      async setPaymentMethod(id, { clientSecret, paymentMethod }) {
        const res = await fetch(`${baseUrl}/v1/funding/sessions/${encodeURIComponent(id)}/paymentMethods`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ clientSecret, paymentMethod }),
        })
        return readJson<FundingSession>(res)
      },
      async get(id, params) {
        // clientSecret goes in a header, never the URL — query strings leak into
        // server logs, browser history, and Referer headers on outbound navigation.
        const headers = params?.clientSecret ? { 'x-client-secret': params.clientSecret } : undefined
        return readJson<FundingSession>(
          await fetch(`${baseUrl}/v1/funding/sessions/${encodeURIComponent(id)}`, { headers })
        )
      },
    },
    async payLink(params) {
      const res = await fetch(`${baseUrl}/v1/funding/pay-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await readJson<{ url: string }>(res)
      return data.url
    },
  }
}
