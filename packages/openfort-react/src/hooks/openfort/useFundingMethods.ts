'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOpenfort } from '../../components/Openfort/useOpenfort'
import { logger } from '../../utils/logger'
import { type ResolvedFundingMethod, type UseFundingOptions, useFundingClient } from './useFunding'

/** The session handle the fiat hooks need — id + its clientSecret. */
export type FundingSessionRef = { id: string; clientSecret: string }

export type UseFundingMethods = {
  /** Server-resolved fiat rows to render, in display order. Empty until loaded. */
  methods: ResolvedFundingMethod[]
  /** Resolved buyer country (ISO-3166 alpha-2), or null for rest-of-world / not loaded. */
  country: string | null
  /** True once the resolve request has settled (rows or error). */
  loaded: boolean
  loading: boolean
  error: Error | null
  refresh: () => void
}

export type UseFundingMethodsOptions = UseFundingOptions & {
  /** Buyer-country override (ISO-3166 alpha-2); defaults to `uiConfig.funding.country`, else the request IP. */
  country?: string
}

/**
 * The fiat funding methods available for a session's destination and the
 * buyer's region, resolved server-side (`GET /v2/funding/sessions/{id}/methods`).
 * Openfort picks the provider per method — render the rows and commit one with
 * {@link useOnramp}; there is no provider choice on the client.
 *
 * Rows that fail to resolve are ABSENT, and on error `methods` is empty — never
 * render a fallback method list: a row whose tap can't execute (or isn't
 * available in the user's region) is worse than no row.
 */
export function useFundingMethods(
  session: FundingSessionRef | null | undefined,
  options?: UseFundingMethodsOptions
): UseFundingMethods {
  const { uiConfig } = useOpenfort()
  const client = useFundingClient(options)
  const country = options?.country ?? uiConfig.funding?.country

  const [methods, setMethods] = useState<ResolvedFundingMethod[]>([])
  const [resolvedCountry, setResolvedCountry] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  // Bumps invalidate in-flight resolves (session switch, refresh, unmount).
  const generation = useRef(0)

  const sessionId = session?.id
  const clientSecret = session?.clientSecret

  const resolve = useCallback(() => {
    generation.current += 1
    const gen = generation.current
    if (!sessionId || !clientSecret || !client) {
      setMethods([])
      setResolvedCountry(null)
      setLoaded(false)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    client.sessions
      .methods(sessionId, { clientSecret, country })
      .then((resolved) => {
        if (generation.current !== gen) return
        setMethods(resolved.methods)
        setResolvedCountry(resolved.country)
        setLoaded(true)
        setLoading(false)
      })
      .catch((e) => {
        if (generation.current !== gen) return
        const err = e instanceof Error ? e : new Error(String(e))
        logger.error('[funding] methods resolve failed', err)
        // Resolve failure hides the fiat rows (methods stays empty) — the crypto
        // rails are unaffected and the caller can offer a retry via refresh().
        setMethods([])
        setResolvedCountry(null)
        setLoaded(true)
        setLoading(false)
        setError(err)
      })
  }, [client, sessionId, clientSecret, country])

  useEffect(() => {
    resolve()
    return () => {
      generation.current += 1
    }
  }, [resolve])

  return { methods, country: resolvedCountry, loaded, loading, error, refresh: resolve }
}
