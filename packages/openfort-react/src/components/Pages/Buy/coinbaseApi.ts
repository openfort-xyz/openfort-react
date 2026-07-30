import { MissingParameterError } from '../../../errors/validation.js'
import type { Asset } from '../../Openfort/types.js'
import { getAssetSymbol } from '../Send/utils.js'
import { ONRAMP_SESSIONS_PATH } from './onrampApi.js'
import { createCurrencySupport, postOnramp } from './onrampRequest.js'

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

const coinbaseCurrencies = createCurrencySupport('Coinbase', COINBASE_SUPPORTED_CURRENCIES)

// Check if a token is supported by Coinbase
export const isCoinbaseSupported = (token: Asset): boolean => coinbaseCurrencies.isSupported(getAssetSymbol(token))

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

  const symbol = getAssetSymbol(token)
  coinbaseCurrencies.assertSupported(symbol)

  // Coinbase takes the currency code in the asset's own casing.
  const requestBody: CreateCoinbaseSessionParams & { provider: string } = {
    provider: 'coinbase',
    destinationCurrency: symbol,
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

  return postOnramp<CoinbaseOnrampResponse>({
    path: ONRAMP_SESSIONS_PATH,
    body: requestBody,
    publishableKey,
    operation: 'Coinbase session creation',
  })
}
