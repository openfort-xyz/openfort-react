import { useEffect, useState } from 'react'
import type { BuyProviderId, FundingMethod } from '../../components/Openfort/types'
import { useOpenfort } from '../../components/Openfort/useOpenfort'
import {
  backendMethodId,
  fetchOnrampMethods,
  type ResolvedOnrampMethod,
} from '../../components/Pages/Buy/onrampMethodsApi'
import { useFundingTarget } from '../../components/Pages/Deposit/useFundingTarget'

// Providers the Buy flow can execute today. MoonPay-resolved methods still show,
// but their execution path (beyond the redirect URL) is not built yet.
const BUY_PROVIDERS = new Set<BuyProviderId>(['stripe', 'coinbase', 'moonpay'])

type ResolvedFundingMethods = {
  /** True once the resolve request has completed (success or failure). */
  loaded: boolean
  /** Backend method ids the region/config resolved (snake_case). Empty until loaded. */
  availableMethodIds: Set<string>
  /** A Buy-flow provider for a method, when one resolved (stripe/coinbase). */
  providerFor: (method: FundingMethod) => BuyProviderId | undefined
}

/**
 * Resolves the fiat methods for the deposit target + the buyer's region via
 * GET /v1/onramp/methods. Degrades gracefully: on failure `loaded` is true with an
 * empty set, and the Deposit hub keeps its static rows.
 */
export function useResolvedFundingMethods(): ResolvedFundingMethods {
  const { publishableKey } = useOpenfort()
  const target = useFundingTarget()
  const [resolved, setResolved] = useState<ResolvedOnrampMethod[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    setLoaded(false)
    void fetchOnrampMethods({
      targetChain: target.chain,
      targetCurrency: target.currency,
      publishableKey,
    }).then((methods) => {
      if (!active) return
      setResolved(methods)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [publishableKey, target.chain, target.currency])

  const availableMethodIds = new Set(resolved.map((r) => r.method))

  const providerFor = (method: FundingMethod): BuyProviderId | undefined => {
    const id = backendMethodId(method)
    const provider = id ? resolved.find((r) => r.method === id)?.provider : undefined
    return provider && BUY_PROVIDERS.has(provider as BuyProviderId) ? (provider as BuyProviderId) : undefined
  }

  return { loaded, availableMethodIds, providerFor }
}
