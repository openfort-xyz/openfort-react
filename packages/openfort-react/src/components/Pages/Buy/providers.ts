import type { BuyProviderId } from '../../Openfort/types.js'

type ProviderDefinition = {
  id: BuyProviderId
  name: string
  feeBps: number
  highlight?: 'best' | 'fast'
  url?: string
}

const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'coinbase',
    name: 'Coinbase',
    feeBps: 250,
    highlight: 'best',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    feeBps: 405,
    highlight: 'fast',
  },
]

export const getProviders = () => PROVIDERS
