import { MissingParameterError } from '../../../errors/validation.js'
import type { Asset } from '../../Openfort/types.js'
import { getAssetSymbol } from '../Send/utils.js'
import { ONRAMP_SESSIONS_PATH } from './onrampApi.js'
import { createCurrencySupport, postOnramp } from './onrampRequest.js'

type StripeOnrampResponse = {
  provider: string
  sessionId: string
  clientSecret: string
  status: string
  onrampUrl: string // crypto.link.com URL with client_secret
}

type CreateStripeSessionParams = {
  destinationCurrency: string
  destinationNetwork: string
  destinationAddress: string
  sourceAmount?: string
  sourceCurrency?: string
  redirectUrl?: string
}

// Stripe supported currencies
const STRIPE_SUPPORTED_CURRENCIES = ['btc', 'eth', 'xlm', 'matic', 'pol', 'sol', 'usdc', 'avax', 'wld'] as const

const stripeCurrencies = createCurrencySupport('Stripe', STRIPE_SUPPORTED_CURRENCIES)

// Check if a token is supported by Stripe
export const isStripeSupported = (token: Asset): boolean => stripeCurrencies.isSupported(getAssetSymbol(token))

/**
 * Create a Stripe onramp session
 * Calls backend API to create a prefilled session with wallet addresses and amounts
 */
export const createStripeSession = async (
  params: Omit<CreateStripeSessionParams, 'destinationCurrency' | 'destinationNetwork'> & {
    token: Asset
    network: string
    publishableKey: string
  }
): Promise<StripeOnrampResponse> => {
  const { token, network, publishableKey, destinationAddress, sourceAmount, sourceCurrency, redirectUrl } = params

  if (!publishableKey) {
    throw new MissingParameterError({ params: ['publishableKey'] })
  }

  const symbol = getAssetSymbol(token)
  stripeCurrencies.assertSupported(symbol)

  // Stripe expects lowercase currency codes.
  const requestBody: CreateStripeSessionParams & { provider: string } = {
    provider: 'stripe',
    destinationCurrency: symbol.toLowerCase(),
    destinationNetwork: network,
    destinationAddress,
    sourceAmount,
    sourceCurrency: sourceCurrency?.toLowerCase(),
    redirectUrl,
  }

  return postOnramp<StripeOnrampResponse>({
    path: ONRAMP_SESSIONS_PATH,
    body: requestBody,
    publishableKey,
    operation: 'Stripe session creation',
  })
}
