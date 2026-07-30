import { SDKConfiguration } from '@openfort/openfort-js'
import { ApiRequestError, UnsupportedOperationError } from '../../../errors/operation.js'
import { MissingParameterError } from '../../../errors/validation.js'
import type { Asset } from '../../Openfort/types.js'
import { getAssetSymbol } from '../Send/utils.js'

const getBackendUrl = (): string => {
  const sdkConfig = SDKConfiguration.getInstance()
  return sdkConfig?.backendUrl || 'https://api.openfort.io'
}

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

type SupportedCurrency = (typeof STRIPE_SUPPORTED_CURRENCIES)[number]

const isSupportedCurrency = (symbol: string): symbol is SupportedCurrency =>
  (STRIPE_SUPPORTED_CURRENCIES as readonly string[]).includes(symbol)

// Check if a token is supported by Stripe
export const isStripeSupported = (token: Asset): boolean => {
  const symbol = getAssetSymbol(token)
  return isSupportedCurrency(symbol.toLowerCase())
}

// Map token symbol to Stripe currency code
const getCurrencyCode = (token: Asset): string => {
  const symbol = getAssetSymbol(token)
  const lowercaseSymbol = symbol.toLowerCase()

  // Validate that the currency is supported by Stripe
  if (!isSupportedCurrency(lowercaseSymbol)) {
    throw new UnsupportedOperationError({
      operation: `Currency "${symbol}" on Stripe`,
      details: `Supported currencies are: ${STRIPE_SUPPORTED_CURRENCIES.join(', ')}.`,
    })
  }

  return lowercaseSymbol
}

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

  const destinationCurrency = getCurrencyCode(token)
  const destinationNetwork = network

  // Build request body for backend API
  const requestBody: CreateStripeSessionParams & { provider: string } = {
    provider: 'stripe',
    destinationCurrency,
    destinationNetwork,
    destinationAddress,
    sourceAmount,
    sourceCurrency: sourceCurrency?.toLowerCase(),
    redirectUrl,
  }

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
      operation: 'Stripe session creation',
      status: response.status,
      body: errorData.error || errorData.errorMessage,
    })
  }

  const data: StripeOnrampResponse = await response.json()
  return data
}
