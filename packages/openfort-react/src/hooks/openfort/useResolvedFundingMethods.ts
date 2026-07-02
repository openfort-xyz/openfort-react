import { useEffect, useState } from 'react'
import type { FundingMethod } from '../../components/Openfort/types'
import { useOpenfort } from '../../components/Openfort/useOpenfort'
import { backendMethodId, fetchOnrampMethods, type ResolvedOnrampMethod } from './onrampMethodsApi'
import { useFundingTarget } from './useFundingTarget'

type ResolvedFundingMethods = {
  /** True once the resolve request has completed (success or failure). */
  loaded: boolean
  /**
   * Backend method ids (snake_case) the region/config resolved. The server only
   * resolves methods whose provider can execute, so every id here is startable.
   * Empty until loaded, and empty on failure — the Deposit hub hides fiat rows
   * rather than falling back to a static list.
   */
  availableMethodIds: Set<string>
  /** The resolved row for a hub method (label/rail/device-check), if available. */
  rowFor: (method: FundingMethod) => ResolvedOnrampMethod | undefined
}

/**
 * Resolves the fiat methods for the deposit target + the buyer's region — the
 * stateless preview behind the Deposit hub rows (the session-scoped counterpart
 * is {@link useFundingMethods}). On failure `loaded` turns true with an empty
 * set, so the hub shows only the crypto rails (never a fallback fiat list).
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

  const availableMethodIds = new Set(resolved.map((r) => r.method))

  const rowFor = (method: FundingMethod): ResolvedOnrampMethod | undefined => {
    const id = backendMethodId(method)
    return id ? resolved.find((r) => r.method === id) : undefined
  }

  return { loaded, availableMethodIds, rowFor }
}
