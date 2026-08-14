import { SDKConfiguration } from '@openfort/openfort-js'
import { FundingMethod } from '../../components/Openfort/types'
import type { OnrampMethodId, ResolvedFundingMethod } from './useFunding'

/**
 * Base path for the fiat-onramp API. The onramp is consolidated under the v2
 * funding namespace; the `/v1/onramp/*` alias no longer serves `/methods`, so
 * this widget release requires the v2 api.
 */
const ONRAMP_API_BASE = '/v2/funding/onramp'

export const getBackendUrl = (): string => {
  const sdkConfig = SDKConfiguration.getInstance()
  return sdkConfig?.backendUrl || 'https://api.openfort.io'
}

/** The stateless preview returns the same rows as the session-scoped methods endpoint. */
export type ResolvedOnrampMethod = ResolvedFundingMethod

// The SDK FundingMethod ids are camelCase; the backend uses snake_case.
const BACKEND_METHOD: Partial<Record<FundingMethod, OnrampMethodId>> = {
  [FundingMethod.APPLE_PAY]: 'apple_pay',
  [FundingMethod.GOOGLE_PAY]: 'google_pay',
  [FundingMethod.CARD]: 'card',
  [FundingMethod.BANK_TRANSFER]: 'bank_transfer',
}

/** The backend (snake_case) id for an SDK FundingMethod, or undefined for crypto rails. */
export function backendMethodId(method: FundingMethod): OnrampMethodId | undefined {
  return BACKEND_METHOD[method]
}

type FetchOnrampMethodsParams = {
  targetChain: string
  targetCurrency: string
  publishableKey: string
  country?: string
}

/**
 * GET /v2/funding/onramp/methods — the fiat methods Openfort resolves for the
 * destination and the buyer's region (the stateless preview behind the Deposit
 * hub rows). Never throws: returns [] on any failure — the hub then hides the
 * fiat rows.
 */
export async function fetchOnrampMethods(params: FetchOnrampMethodsParams): Promise<ResolvedOnrampMethod[]> {
  const { targetChain, targetCurrency, publishableKey, country } = params
  if (!publishableKey) return []
  const query = new URLSearchParams({ targetChain, targetCurrency })
  if (country) query.set('country', country)
  try {
    const response = await fetch(`${getBackendUrl()}${ONRAMP_API_BASE}/methods?${query.toString()}`, {
      headers: { Authorization: `Bearer ${publishableKey}` },
    })
    if (!response.ok) return []
    const data = (await response.json()) as { methods?: ResolvedOnrampMethod[] }
    return data.methods ?? []
  } catch {
    return []
  }
}
