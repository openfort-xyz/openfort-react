'use client'

import { SDKConfiguration } from '@openfort/openfort-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOpenfort } from '../../components/Openfort/useOpenfort.js'
import { FundingNotConfiguredError } from '../../errors/funding.js'
import { UnsupportedOperationError } from '../../errors/operation.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { logger } from '../../utils/logger.js'
import {
  createFetchFundingClient,
  type FundingClient,
  type FundingSession,
  type FundingTarget,
  type PayLinkParams,
  type PaymentMethodInput,
  type SessionStatus,
} from './fundingClient.js'

/** Pay-links aren't exposed by the SDK funding namespace yet (CEX is API-deferred). */
const sdkPayLinkUnavailable = async (): Promise<string> => {
  throw new UnsupportedOperationError({ operation: 'Exchange pay-links' })
}

const TERMINAL: SessionStatus[] = ['succeeded', 'bounced', 'expired']
const POLL_MS = 4000

/**
 * Poll a session until it reaches a terminal state, pushing each update through
 * `onUpdate`. Shared by `fund` (after a payment method is set) and `track` (the
 * CEX rail, watching a hosted Coinbase deposit settle). `isCurrent` guards a
 * stale loop from clobbering newer state after reset/unmount.
 */
async function pollUntilTerminal(
  client: FundingClient,
  onUpdate: (session: FundingSession) => void,
  start: FundingSession,
  isCurrent: () => boolean
): Promise<FundingSession> {
  let current = start
  let prev = current.status
  while (!TERMINAL.includes(current.status)) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    if (!isCurrent()) return current
    current = await client.sessions.get(current.id, { clientSecret: current.clientSecret })
    if (!isCurrent()) return current
    onUpdate(current)
    if (current.status !== prev) {
      logger.log('[funding] status', { sessionId: current.id, prev, status: current.status })
      prev = current.status
    }
  }
  if (current.status === 'succeeded') {
    logger.log('[funding] terminal: delivered', {
      sessionId: current.id,
      status: current.status,
      txHash: current.metadata?.txHash ?? current.externalId ?? null,
    })
  } else {
    // bounced = source delivered but Relay refunded; expired = nothing arrived in time.
    logger.warn('[funding] terminal: failed', { sessionId: current.id, status: current.status })
  }
  return current
}

export type UseFunding = {
  session: FundingSession | null
  status: SessionStatus | 'idle'
  error: Error | null
  /** True while a session is being created and its deposit address fetched. */
  loading: boolean
  /** True when a funding client is resolved (injected, or uiConfig.fundingBaseUrl set). */
  isAvailable: boolean
  /** Create a session, set a payment method, and poll until terminal. */
  fund: (target: FundingTarget, paymentMethod: PaymentMethodInput) => Promise<FundingSession>
  /** Create a bare session for a target (no payment method, no polling). Used by
   * the Coinbase CEX rail, which only needs the session id + secret to mint a
   * pay-link; the destination is bound to the session so the client can't redirect funds. */
  createSession: (target: FundingTarget) => Promise<FundingSession>
  /** Poll an already-created session (id + clientSecret) until it reaches a
   * terminal state, surfacing `status`/`session` updates as it goes. Used by the
   * CEX rail, which hands off to a hosted Coinbase flow and then watches the
   * bound session settle to drive the success/failed screen. */
  track: (session: { id: string; clientSecret: string }) => Promise<FundingSession>
  /** Resolve a hosted Coinbase pay URL for an existing session. Coinbase delivers
   * to the session's bound destination, so only the amount (and optional asset) is client-supplied. */
  payLink: (params: PayLinkParams) => Promise<string>
  /** Reset to the idle state (e.g. when leaving the Deposit flow). */
  reset: () => void
}

/** Options for {@link useFunding}. */
export type UseFundingOptions = {
  /** Inject a funding client (tests, or a custom backend). Defaults to the
   * fetch adapter over `uiConfig.fundingBaseUrl`. */
  client?: FundingClient
  /**
   * Resolve the base URL from the Openfort API backend (`SDKConfiguration.backendUrl`)
   * instead of `uiConfig.fundingBaseUrl`. The CEX (Coinbase pay-link) rail is served
   * by the API, not the standalone funding service — `DepositCex` opts in.
   */
  useBackendUrl?: boolean
}

/**
 * React surface over the funding session API.
 *
 * A session is one deposit attempt against a destination. The hook creates a
 * session, sets one payment method (a source the user commits to sending from),
 * then polls until the session reaches a terminal state. The response carries
 * everything the UI (or an agent) needs: a receiver address, a scannable URI,
 * prefilled wallet deeplinks, and CEX guidance.
 *
 * The hook depends on a {@link FundingClient}, not on `fetch` directly, so a
 * custom backend or a test double can be injected through
 * {@link UseFundingOptions.client}.
 *
 * @returns Session state plus `fund` (run the deposit flow) and `reset`.
 */
export function useFunding(options?: UseFundingOptions): UseFunding {
  const { uiConfig, publishableKey } = useOpenfort()
  const { client: coreClient } = useOpenfortCore()
  // The funding JSON API defaults to the Openfort backend (api.openfort.io);
  // integrators can point the crypto rails at a custom service via
  // uiConfig.fundingBaseUrl. The CEX rail always uses the backend (Coinbase pay-link).
  const backendUrl = SDKConfiguration.getInstance()?.backendUrl || 'https://api.openfort.io'
  const baseUrl = options?.useBackendUrl ? backendUrl : uiConfig.fundingBaseUrl || backendUrl
  const injected = options?.client
  // Resolve the client, in order of preference:
  //   1. an explicitly injected client (tests / custom backends),
  //   2. the SDK's `openfort.funding` namespace once available,
  //   3. the fetch adapter over uiConfig.fundingBaseUrl.
  // The SDK namespace covers sessions; pay-links stay on the backend adapter
  // until the API exposes them (CEX is deferred), so we compose the two.
  const client = useMemo<FundingClient | null>(() => {
    if (injected) return injected
    const sdkFunding = (coreClient as unknown as { funding?: Pick<FundingClient, 'sessions'> } | undefined)?.funding
    const fetchClient = baseUrl ? createFetchFundingClient(baseUrl, publishableKey) : null
    if (sdkFunding) {
      return { sessions: sdkFunding.sessions, payLink: fetchClient?.payLink ?? sdkPayLinkUnavailable }
    }
    return fetchClient
  }, [injected, coreClient, baseUrl, publishableKey])
  const isAvailable = client != null

  const [session, setSession] = useState<FundingSession | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)
  // Generation guard: only the latest fund()/reset() updates state, so
  // re-selecting a source mid-poll can't be clobbered by a stale request.
  const generation = useRef(0)

  // Stop any in-flight poll loop on unmount — without this the loop keeps
  // hitting the network until the session turns terminal (up to its 24h TTL).
  useEffect(() => {
    return () => {
      generation.current += 1
      logger.log('[funding] unmounted — poll loop stopped')
    }
  }, [])

  const reset = useCallback(() => {
    generation.current += 1
    logger.log('[funding] reset')
    setSession(null)
    setError(null)
    setLoading(false)
  }, [])

  const fund = useCallback(
    async (target: FundingTarget, paymentMethod: PaymentMethodInput): Promise<FundingSession> => {
      generation.current += 1
      const gen = generation.current
      const isCurrent = () => generation.current === gen
      setError(null)
      setLoading(true)
      logger.log('[funding] fund() start', {
        chain: target.chain,
        currency: target.currency,
        address: target.address,
        paymentMethod: paymentMethod.type,
        sourceChain: paymentMethod.source.chain,
        amount: paymentMethod.source.amount,
      })
      try {
        if (!client) {
          throw new FundingNotConfiguredError()
        }
        const created = await client.sessions.create({ target })
        logger.log('[funding] session created', { sessionId: created.id, status: created.status })
        const current = await client.sessions.setPaymentMethod(created.id, {
          clientSecret: created.clientSecret,
          paymentMethod,
        })
        if (!isCurrent()) return current
        setSession(current)
        setLoading(false)
        logger.log('[funding] payment method set', {
          sessionId: current.id,
          status: current.status,
          receiverAddress: current.paymentMethod?.receiverAddress,
        })
        // The session status encodes both hops: waiting_payment (awaiting the source
        // deposit, e.g. the Coinbase withdrawal) → processing (deposit arrived on-chain,
        // Relay bridging) → succeeded / bounced (Relay refunded) / expired (no deposit).
        return pollUntilTerminal(client, setSession, current, isCurrent)
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        if (isCurrent()) {
          setError(err)
          setLoading(false)
          logger.error('[funding] fund() failed', err)
        }
        throw err
      }
    },
    [client]
  )

  const createSession = useCallback(
    async (target: FundingTarget): Promise<FundingSession> => {
      if (!client) throw new FundingNotConfiguredError()
      const created = await client.sessions.create({ target })
      logger.log('[funding] session created (cex)', { sessionId: created.id, status: created.status })
      return created
    },
    [client]
  )

  const track = useCallback(
    async (toTrack: { id: string; clientSecret: string }): Promise<FundingSession> => {
      if (!client) throw new FundingNotConfiguredError()
      generation.current += 1
      const gen = generation.current
      const isCurrent = () => generation.current === gen
      setError(null)
      try {
        const start = await client.sessions.get(toTrack.id, { clientSecret: toTrack.clientSecret })
        if (!isCurrent()) return start
        setSession(start)
        logger.log('[funding] track() start', { sessionId: start.id, status: start.status })
        return await pollUntilTerminal(client, setSession, start, isCurrent)
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        if (isCurrent()) {
          setError(err)
          logger.error('[funding] track() failed', err)
        }
        throw err
      }
    },
    [client]
  )

  const payLink = useCallback(
    async (params: PayLinkParams): Promise<string> => {
      if (!client) throw new FundingNotConfiguredError()
      return client.payLink(params)
    },
    [client]
  )

  return {
    session,
    status: session?.status ?? 'idle',
    error,
    loading,
    isAvailable,
    fund,
    createSession,
    track,
    payLink,
    reset,
  }
}
