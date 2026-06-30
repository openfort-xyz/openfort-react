import { useEffect, useState } from 'react'
import type { Asset, BuyProviderId } from '../../components/Openfort/types'
import { useOpenfort } from '../../components/Openfort/useOpenfort'
import { fetchOnrampQuote, type OnrampQuote } from '../../components/Pages/Buy/onrampQuoteApi'

type UseOnrampQuoteParams = {
  provider: BuyProviderId
  token: Asset
  /** Onramp destination network, e.g. `base` / `solana`. Empty disables fetching. */
  network?: string
  sourceCurrency: string
  /** Fiat amount as a number; null/≤0 disables fetching. */
  amount: number | null
}

type UseOnrampQuote = {
  quote: OnrampQuote | null
  loading: boolean
}

/**
 * Live onramp quote for the buy preview. Debounced so typing doesn't spam the
 * backend; clears the stale quote while a new amount settles. Degrades silently —
 * a failed fetch leaves `quote` null and the preview omits the estimate.
 */
export function useOnrampQuote({
  provider,
  token,
  network,
  sourceCurrency,
  amount,
}: UseOnrampQuoteParams): UseOnrampQuote {
  const { publishableKey } = useOpenfort()
  const [quote, setQuote] = useState<OnrampQuote | null>(null)
  const [loading, setLoading] = useState(false)

  const enabled = amount !== null && amount > 0 && Boolean(network) && Boolean(publishableKey)
  const sourceAmount = enabled ? amount.toFixed(2) : ''

  useEffect(() => {
    if (!enabled) {
      setQuote(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    const timer = setTimeout(() => {
      void fetchOnrampQuote({
        provider,
        token,
        network: network ?? '',
        sourceCurrency,
        sourceAmount,
        publishableKey,
      }).then((result) => {
        if (!active) return
        setQuote(result)
        setLoading(false)
      })
    }, 400)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [enabled, provider, token, network, sourceCurrency, sourceAmount, publishableKey])

  return { quote, loading }
}
