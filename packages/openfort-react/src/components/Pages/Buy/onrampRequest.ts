import { ApiRequestError, UnsupportedOperationError } from '../../../errors/operation.js'
import { getOpenfortBackendUrl } from '../../../openfort/core/client.js'

type PostOnrampParameters = {
  /** Backend path, relative to the SDK's configured backend URL. */
  path: string
  /** JSON request body. */
  body: unknown
  /** Openfort publishable key, sent as the bearer token. */
  publishableKey: string
  /** Operation name reported on failure. */
  operation: string
}

/**
 * Posts a JSON body to an Openfort onramp endpoint.
 *
 * @param parameters - Path, body, publishable key and the failure operation label.
 * @returns The parsed response body.
 * @throws {ApiRequestError} When the backend responds with a non-2xx status. The
 * error carries the status and the backend's `error` / `errorMessage` field.
 */
export async function postOnramp<TResponse>(parameters: PostOnrampParameters): Promise<TResponse> {
  const { path, body, publishableKey, operation } = parameters

  const response = await fetch(`${getOpenfortBackendUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publishableKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ApiRequestError({
      operation,
      status: response.status,
      body: errorData.error || errorData.errorMessage,
    })
  }

  return (await response.json()) as TResponse
}

type OnrampCurrencySupport = {
  /** Whether the provider accepts this token symbol, in any casing. */
  isSupported: (symbol: string) => boolean
  /** Same check, as a guard. */
  assertSupported: (symbol: string) => void
}

/**
 * Builds the supported-currency checks for one onramp provider.
 *
 * @param provider - Provider name, used in the unsupported-currency message.
 * @param currencies - Lowercase currency codes the provider accepts.
 * @returns A predicate and its throwing counterpart.
 */
export function createCurrencySupport(provider: string, currencies: readonly string[]): OnrampCurrencySupport {
  const isSupported = (symbol: string): boolean => currencies.includes(symbol.toLowerCase())

  return {
    isSupported,
    assertSupported: (symbol: string): void => {
      if (!isSupported(symbol)) {
        throw new UnsupportedOperationError({
          operation: `Currency "${symbol}" on ${provider}`,
          details: `Supported currencies are: ${currencies.join(', ')}.`,
        })
      }
    },
  }
}
