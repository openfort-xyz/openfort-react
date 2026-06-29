import { SDKConfiguration } from '@openfort/openfort-js'
import { FundingMethod } from '../../Openfort/types'

const getBackendUrl = (): string => {
  const sdkConfig = SDKConfiguration.getInstance()
  return sdkConfig?.backendUrl || 'https://api.openfort.io'
}

/** One Openfort-resolved fiat method. The provider is for telemetry — never shown. */
export type ResolvedOnrampMethod = {
  method: string
  provider: string
  angle: 'iframe' | 'native'
  label: string
  rail?: string
  requiresDeviceCheck?: boolean
}

// The SDK FundingMethod ids are camelCase; the backend uses snake_case.
const BACKEND_METHOD: Partial<Record<FundingMethod, string>> = {
  [FundingMethod.APPLE_PAY]: 'apple_pay',
  [FundingMethod.GOOGLE_PAY]: 'google_pay',
  [FundingMethod.CARD]: 'card',
  [FundingMethod.BANK_TRANSFER]: 'bank_transfer',
}

/** The backend (snake_case) id for an SDK FundingMethod, or undefined for crypto rails. */
export function backendMethodId(method: FundingMethod): string | undefined {
  return BACKEND_METHOD[method]
}

type FetchOnrampMethodsParams = {
  targetChain: string
  targetCurrency: string
  publishableKey: string
  country?: string
}

/**
 * GET /v1/onramp/methods — the fiat methods Openfort resolves for the destination
 * and the buyer's region. Never throws: returns [] on any failure so the Deposit
 * hub falls back to its static rows.
 */
export async function fetchOnrampMethods(params: FetchOnrampMethodsParams): Promise<ResolvedOnrampMethod[]> {
  const { targetChain, targetCurrency, publishableKey, country } = params
  if (!publishableKey) return []
  const query = new URLSearchParams({ targetChain, targetCurrency })
  if (country) query.set('country', country)
  try {
    const response = await fetch(`${getBackendUrl()}/v1/onramp/methods?${query.toString()}`, {
      headers: { Authorization: `Bearer ${publishableKey}` },
    })
    if (!response.ok) return []
    const data = (await response.json()) as { methods?: ResolvedOnrampMethod[] }
    return data.methods ?? []
  } catch {
    return []
  }
}
