import type { BuyProviderId } from '../../Openfort/types'

type ProviderDefinition = {
  id: BuyProviderId
  name: string
}

const PROVIDERS: ProviderDefinition[] = [
  { id: 'coinbase', name: 'Coinbase' },
  { id: 'stripe', name: 'Stripe' },
]

export const getProviders = () => PROVIDERS
