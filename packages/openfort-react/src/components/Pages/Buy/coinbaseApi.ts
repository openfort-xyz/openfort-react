import { SDKConfiguration } from '@openfort/openfort-js'
import { ApiRequestError, UnsupportedOperationError } from '../../../errors/operation.js'
import { MissingParameterError } from '../../../errors/validation.js'
import type { Asset } from '../../Openfort/types.js'
import { getAssetSymbol } from '../Send/utils.js'

const getBackendUrl = (): string => {
  const sdkConfig = SDKConfiguration.getInstance()
  return sdkConfig?.backendUrl || 'https://api.openfort.io'
}

type CoinbaseOnrampResponse = {
  provider: string
  onrampUrl: string
}

type CreateCoinbaseSessionParams = {
  destinationCurrency: string
  destinationNetwork: string
  destinationAddress: string
  sourceAmount?: string
  sourceCurrency?: string
  paymentMethod?: 'CARD' | 'ACH' | 'APPLE_PAY' | 'PAYPAL' | 'FIAT_WALLET' | 'CRYPTO_WALLET'
  country?: string
  subdivision?: string
  redirectUrl?: string
  clientIp?: string
}

// Coinbase supported currencies (more extensive than Stripe)
const COINBASE_SUPPORTED_CURRENCIES = [
  'btc',
  'eth',
  'usdc',
  'usdt',
  'matic',
  'pol', // Polygon native token (rebranded from MATIC)
  'sol',
  'avax',
  'atom',
  'dot',
  'link',
  'uni',
  'aave',
  'comp',
  'snx',
  'mkr',
  'dai',
  'wld',
  'xlm',
] as const

type SupportedCurrency = (typeof COINBASE_SUPPORTED_CURRENCIES)[number]

const isSupportedCurrency = (symbol: string): symbol is SupportedCurrency =>
  (COINBASE_SUPPORTED_CURRENCIES as readonly string[]).includes(symbol)

// Check if a token is supported by Coinbase
export const isCoinbaseSupported = (token: Asset): boolean => {
  const symbol = getAssetSymbol(token)
  return isSupportedCurrency(symbol.toLowerCase())
}

// Map token symbol to Coinbase currency code
const getCurrencyCode = (token: Asset): string => {
  const symbol = getAssetSymbol(token)
  const lowercaseSymbol = symbol.toLowerCase()

  // Validate that the currency is supported by Coinbase
  if (!isSupportedCurrency(lowercaseSymbol)) {
    throw new UnsupportedOperationError({
      operation: `Currency "${symbol}" on Coinbase`,
      details: `Supported currencies are: ${COINBASE_SUPPORTED_CURRENCIES.join(', ')}.`,
    })
  }

  return symbol
}

/**
 * Create a Coinbase onramp session
 * Supports three use cases based on provided parameters:
 * 1. Basic session: Only required params (destinationAddress, destinationCurrency, destinationNetwork)
 * 2. One-click URL: Required + sourceAmount + sourceCurrency
 * 3. One-click with quote: One-click + paymentMethod + country (+ subdivision for US)
 */
export const createCoinbaseSession = async (
  params: Omit<CreateCoinbaseSessionParams, 'destinationCurrency' | 'destinationNetwork'> & {
    token: Asset
    network: string
    publishableKey: string
  }
): Promise<CoinbaseOnrampResponse> => {
  const { token, network, publishableKey, ...rest } = params

  if (!publishableKey) {
    throw new MissingParameterError({ params: ['publishableKey'] })
  }

  // Build request body with only provided parameters
  const requestBody: CreateCoinbaseSessionParams & { provider: string } = {
    provider: 'coinbase',
    destinationCurrency: getCurrencyCode(token),
    destinationNetwork: network,
    destinationAddress: rest.destinationAddress,
  }

  // Add optional parameters only if provided
  if (rest.sourceAmount) requestBody.sourceAmount = rest.sourceAmount
  if (rest.sourceCurrency) requestBody.sourceCurrency = rest.sourceCurrency
  if (rest.paymentMethod) requestBody.paymentMethod = rest.paymentMethod
  if (rest.country) requestBody.country = rest.country
  if (rest.subdivision) requestBody.subdivision = rest.subdivision
  if (rest.redirectUrl) requestBody.redirectUrl = rest.redirectUrl
  if (rest.clientIp) requestBody.clientIp = rest.clientIp

  const response = await fetch(`${getBackendUrl()}/v1/onramp/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publishableKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ApiRequestError({
      operation: 'Coinbase session creation',
      status: response.status,
      body: errorData.error || errorData.errorMessage,
    })
  }

  return response.json()
}
