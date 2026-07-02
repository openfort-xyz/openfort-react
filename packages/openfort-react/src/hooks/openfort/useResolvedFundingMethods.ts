import { useEffect, useState } from 'react'
import type { BuyProviderId, FundingMethod } from '../../components/Openfort/types'
import { useOpenfort } from '../../components/Openfort/useOpenfort'
import {
  backendMethodId,
  fetchOnrampMethods,
  type ResolvedOnrampMethod,
} from '../../components/Pages/Buy/onrampMethodsApi'
import { useFundingTarget } from '../../components/Pages/Deposit/useFundingTarget'

// Providers the Buy flow can execute end-to-end today. A resolved method whose
// provider isn't here is treated as unavailable (its row hides) — a row that
// throws when tapped is worse than no row.
const BUY_PROVIDERS = new Set<BuyProviderId>(['stripe', 'coinbase'])

type ResolvedFundingMethods = {
  /** True once the resolve request has completed (success or failure). */
  loaded: boolean
  /**
   * Backend method ids (snake_case) the region/config resolved to an executable
   * provider. Empty until loaded, and empty on failure — the Deposit hub hides
   * fiat rows rather than falling back to a static list.
   */
  availableMethodIds: Set<string>
  /** The executable Buy-flow provider for a method, when one resolved. */
  providerFor: (method: FundingMethod) => BuyProviderId | undefined
}

/**
 * Resolves the fiat methods for the deposit target + the buyer's region via
 * GET /v1/onramp/methods. On failure `loaded` turns true with an empty set, so
 * the hub shows only the crypto rails (never a fallback fiat list).
 */
export function useResolvedFundingMethods(): ResolvedFundingMethods {
  const { publishableKey, uiConfig } = useOpenfort()
  const target = useFundingTarget()
  // Region override for apps that know their user's country (and for local dev,
  // where no CDN geo header exists and IP detection resolves to rest-of-world).
  const country = uiConfig.funding?.country
  const [resolved, setResolved] = useState<ResolvedOnrampMethod[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    setLoaded(false)
    void fetchOnrampMethods({
      targetChain: target.chain,
      targetCurrency: target.currency,
      publishableKey,
      country,
    }).then((methods) => {
      if (!active) return
      setResolved(methods)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [publishableKey, target.chain, target.currency, country])

  const executable = resolved.filter((r) => BUY_PROVIDERS.has(r.provider as BuyProviderId))
  const availableMethodIds = new Set(executable.map((r) => r.method))

  const providerFor = (method: FundingMethod): BuyProviderId | undefined => {
    const id = backendMethodId(method)
    const provider = id ? executable.find((r) => r.method === id)?.provider : undefined
    return provider as BuyProviderId | undefined
  }

  return { loaded, availableMethodIds, providerFor }
}
