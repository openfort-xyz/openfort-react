import { ChainTypeEnum } from '@openfort/openfort-js'
import { MissingParameterError } from '../../../errors/validation.js'
import type { Asset } from '../../Openfort/types.js'
import { getAssetSymbol } from '../Send/utils.js'
import { postOnramp } from './onrampRequest.js'

/** Backend endpoint every provider opens its onramp session against. */
export const ONRAMP_SESSIONS_PATH = '/v1/onramp/sessions'

const ONRAMP_QUOTES_PATH = '/v1/onramp/quotes'

// Generic quote response type (matches backend OnrampQuoteResponse)
export type OnrampQuote = {
  provider: string
  sourceAmount: string
  sourceCurrency: string
  destinationAmount: string
  destinationCurrency: string
  destinationNetwork: string
  fees: Array<{
    amount: string
    currency: string
    type: string
  }>
  exchangeRate: string
}

/** EVM chain id → onramp network name. */
const EVM_NETWORK_MAP: Record<number, string> = {
  1: 'ethereum',
  8453: 'base',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
}

/**
 * Resolve the onramp destination network for the active chain. Solana always
 * resolves to `solana`; an EVM wallet whose `chainId` hasn't loaded yet returns
 * `undefined`, so callers stay gated until the chain is ready.
 */
export function resolveOnrampNetwork(chainType: ChainTypeEnum, chainId?: number): string | undefined {
  if (chainType === ChainTypeEnum.SVM) return 'solana'
  if (chainId == null) return undefined
  return EVM_NETWORK_MAP[chainId] ?? 'base'
}

// Map token symbol to currency code
const getCurrencyCode = (token: Asset): string => {
  return getAssetSymbol(token).toLowerCase()
}

type GetAllQuotesParams = {
  token: Asset
  network: string
  publishableKey: string
  sourceCurrency: string
  sourceAmount: string
}

/**
 * Get quotes from all available providers
 * Calls the backend without specifying a provider to get quotes from all providers
 */
export const getAllQuotes = async (params: GetAllQuotesParams): Promise<OnrampQuote[]> => {
  const { token, network, publishableKey, sourceCurrency, sourceAmount } = params

  if (!publishableKey) {
    throw new MissingParameterError({ params: ['publishableKey'] })
  }

  // Build request body WITHOUT provider to get all quotes
  const requestBody = {
    destinationCurrency: getCurrencyCode(token),
    destinationNetwork: network,
    sourceCurrency: sourceCurrency.toLowerCase(),
    sourceAmount,
  }

  const data = await postOnramp<OnrampQuote | OnrampQuote[]>({
    path: ONRAMP_QUOTES_PATH,
    body: requestBody,
    publishableKey,
    operation: 'Onramp quote lookup',
  })

  // Backend returns array when provider is not specified
  return Array.isArray(data) ? data : [data]
}
