import { useEffect, useState } from 'react'
import { type OnrampMethodId, type OnrampQuote, useFundingClient } from './useFunding'
import type { FundingSessionRef } from './useFundingMethods'

type UseOnrampQuoteParams = {
  /** The session the buy would commit into; null disables fetching. */
  session: FundingSessionRef | null
  /** Backend method id (snake_case); undefined disables fetching. */
  method?: OnrampMethodId
  /** ISO-4217 fiat currency, e.g. "USD". */
  sourceCurrency: string
  /** Fiat amount as a number; null/≤0 disables fetching. */
  amount: number | null
}

type UseOnrampQuote = {
  quote: OnrampQuote | null
  loading: boolean
}

/** Sum the quote's fee legs (all expressed in the source/fiat currency). */
export function totalFee(quote: OnrampQuote): number {
  return quote.fees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0)
}

/**
 * Live quote for the buy preview, priced by the exact provider the commit would
 * resolve (`POST /v2/funding/sessions/{id}/quotes`). Debounced so typing doesn't
 * spam the backend; clears the stale quote while a new amount settles. Degrades
 * silently — a failed fetch leaves `quote` null and the preview omits the estimate.
 */
export function useOnrampQuote({ session, method, sourceCurrency, amount }: UseOnrampQuoteParams): UseOnrampQuote {
  // Onramp quotes are served by the Openfort API backend, like the sessions.
  const client = useFundingClient({ useBackendUrl: true })
  const [quote, setQuote] = useState<OnrampQuote | null>(null)
  const [loading, setLoading] = useState(false)

  const enabled = amount !== null && amount > 0 && Boolean(session) && Boolean(method) && Boolean(client)
  const sourceAmount = enabled && amount !== null ? amount.toFixed(2) : ''
  const sessionId = session?.id
  const clientSecret = session?.clientSecret

  useEffect(() => {
    if (!enabled || !client || !sessionId || !clientSecret || !method) {
      setQuote(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    const timer = setTimeout(() => {
      client.sessions
        .quote(sessionId, { clientSecret, method, sourceAmount, sourceCurrency })
        .then((result) => {
          if (!active) return
          setQuote(result)
          setLoading(false)
        })
        .catch(() => {
          if (!active) return
          setQuote(null)
          setLoading(false)
        })
    }, 400)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [enabled, client, sessionId, clientSecret, method, sourceCurrency, sourceAmount])

  return { quote, loading }
}
