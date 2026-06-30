import { SDKConfiguration } from '@openfort/openfort-js'
import type { Asset, BuyProviderId } from '../../Openfort/types'
import { getAssetSymbol } from '../Send/utils'
import { ONRAMP_API_BASE } from './onrampEndpoints'

const getBackendUrl = (): string => {
  const sdkConfig = SDKConfiguration.getInstance()
  return sdkConfig?.backendUrl || 'https://api.openfort.io'
}

/** A provider-agnostic onramp quote (matches the backend OnrampQuotesResponse). */
export type OnrampQuote = {
  provider: string
  sourceAmount: string
  sourceCurrency: string
  destinationAmount: string
  destinationCurrency: string
  destinationNetwork: string
  fees: Array<{ amount: string; currency: string; type: string }>
  exchangeRate: string
}

type FetchOnrampQuoteParams = {
  provider: BuyProviderId
  token: Asset
  network: string
  sourceCurrency: string
  sourceAmount: string
  publishableKey: string
}

/** Sum the quote's fee legs (all expressed in the source/fiat currency). */
export function totalFee(quote: OnrampQuote): number {
  return quote.fees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0)
}

/**
 * POST `{onramp}/quotes` — a real quote from the resolved provider for the entered
 * amount and destination. Request/response are provider-agnostic; the backend
 * translates per provider. Never throws: returns null on any failure so the preview
 * falls back to showing no estimate.
 */
export async function fetchOnrampQuote(params: FetchOnrampQuoteParams): Promise<OnrampQuote | null> {
  const { provider, token, network, sourceCurrency, sourceAmount, publishableKey } = params
  if (!publishableKey || !network) return null
  try {
    const response = await fetch(`${getBackendUrl()}${ONRAMP_API_BASE}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publishableKey}` },
      body: JSON.stringify({
        provider,
        destinationCurrency: getAssetSymbol(token).toLowerCase(),
        destinationNetwork: network,
        sourceCurrency: sourceCurrency.toLowerCase(),
        sourceAmount,
      }),
    })
    if (!response.ok) return null
    return (await response.json()) as OnrampQuote
  } catch {
    return null
  }
}
