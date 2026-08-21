'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOpenfort } from '../../components/Openfort/useOpenfort.js'
import { asOpenfortError, type OpenfortError } from '../../errors/base.js'
import { FundingError, FundingNotConfiguredError } from '../../errors/funding.js'
import { UnsupportedOperationError } from '../../errors/operation.js'
import { useAuthTransitions } from '../../openfort/authTransitionContext.js'
import { getOpenfortBackendUrl } from '../../openfort/core/client.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { getOrCreatePersistentOperation } from '../../shared/utils/persistentOperationRegistry.js'
import { getTrustedFundingProviderUrl } from '../../utils/fundingProviderUrl.js'
import { logger } from '../../utils/logger.js'
import {
  createFetchFundingClient,
  cryptoPaymentMethod,
  type FundingClient,
  type FundingSession,
  type FundingTarget,
  type PayLinkParams,
  type PaymentMethodInput,
  type SessionStatus,
} from './fundingClient.js'
import { notifyHookCallback } from './hookConsistency.js'

/** Pay-links aren't exposed by the SDK funding namespace yet (CEX is API-deferred). */
const sdkPayLinkUnavailable = async (): Promise<string> => {
  throw new UnsupportedOperationError({ operation: 'Exchange pay-links' })
}

/** Embedded onramp auth isn't exposed by the SDK funding namespace yet. */
const sdkAuthIntentsUnavailable: FundingClient['authIntents'] = {
  create: async () => {
    throw new UnsupportedOperationError({ operation: 'Onramp auth intents' })
  },
  exchangeToken: async () => {
    throw new UnsupportedOperationError({ operation: 'Onramp auth intents' })
  },
  identity: async () => {
    throw new UnsupportedOperationError({ operation: 'Onramp identity' })
  },
  limits: async () => {
    throw new UnsupportedOperationError({ operation: 'Onramp limits' })
  },
  startLimitUpgrade: async () => {
    throw new UnsupportedOperationError({ operation: 'Onramp limit upgrade' })
  },
}

const TERMINAL: SessionStatus[] = ['succeeded', 'bounced', 'expired']
const POLL_MS = 4000
const TRACK_ORPHAN_RETENTION_MS = 30_000

type FundingTrackSnapshot = Omit<FundingSession, 'clientSecret'>

function fundingTrackSnapshot(session: FundingSession): FundingTrackSnapshot {
  const { clientSecret: _clientSecret, ...snapshot } = session
  return snapshot
}

function restoreTrackedSession(snapshot: FundingTrackSnapshot, clientSecret: string): FundingSession {
  return { ...snapshot, clientSecret }
}

function fundingRequestSuperseded(): FundingError {
  return new FundingError('Funding request was superseded by a newer request.')
}

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
    if (!isCurrent()) throw fundingRequestSuperseded()
    current = await client.sessions.get(current.id, { clientSecret: current.clientSecret })
    if (!isCurrent()) throw fundingRequestSuperseded()
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

/**
 * The resolved result of a funding session action.
 *
 * @example
 * ```ts
 * import type { FundingSessionResult } from '@openfort/react'
 *
 * function sessionId(result: FundingSessionResult) {
 *   return 'error' in result ? undefined : result.session.id
 * }
 * ```
 */
export type FundingSessionResult = { session: FundingSession } | { error: OpenfortError }

/**
 * The resolved result of a hosted funding-link action.
 *
 * @example
 * ```ts
 * import type { FundingPayLinkResult } from '@openfort/react'
 *
 * function payLinkUrl(result: FundingPayLinkResult) {
 *   return 'error' in result ? undefined : result.url
 * }
 * ```
 */
export type FundingPayLinkResult = { url: string } | { error: OpenfortError }

export type UseFunding = {
  session: FundingSession | null
  status: SessionStatus | 'idle'
  error: OpenfortError | null
  /** True while a session is being created and its deposit address fetched. */
  loading: boolean
  /** True when a funding client is resolved (injected, or uiConfig.fundingBaseUrl set). */
  isAvailable: boolean
  /** Create a session, set a payment method, and poll until terminal. */
  fund: (target: FundingTarget, paymentMethod: PaymentMethodInput) => Promise<FundingSessionResult>
  /** Create a bare session for a target (no payment method, no polling). Used by
   * the Coinbase CEX rail, which only needs the session id + secret to mint a
   * pay-link; the destination is bound to the session so the client can't redirect funds. */
  createSession: (target: FundingTarget) => Promise<FundingSessionResult>
  /** Poll an already-created session (id + clientSecret) until it reaches a
   * terminal state, surfacing `status`/`session` updates as it goes. Used by the
   * CEX rail, which hands off to a hosted Coinbase flow and then watches the
   * bound session settle to drive the success/failed screen. */
  track: (session: { id: string; clientSecret: string }) => Promise<FundingSessionResult>
  /** Resolve a hosted Coinbase pay URL for an existing session. Coinbase delivers
   * to the session's bound destination, so only the amount (and optional asset) is client-supplied. */
  payLink: (params: PayLinkParams) => Promise<FundingPayLinkResult>
  /** Reset to the idle state (e.g. when leaving the Deposit flow). */
  reset: () => void
}

/**
 * Options for {@link useFunding}.
 *
 * @example
 * ```ts
 * import type { UseFundingOptions } from '@openfort/react'
 *
 * const options: UseFundingOptions = {
 *   onError: (error) => console.error(error.shortMessage),
 * }
 * ```
 */
export type UseFundingOptions = {
  /** Inject a funding client (tests, or a custom backend). Defaults to the
   * fetch adapter over `uiConfig.fundingBaseUrl`. */
  client?: FundingClient
  /**
   * Resolve the base URL from the configured Openfort API backend
   * instead of `uiConfig.fundingBaseUrl`. The CEX (Coinbase pay-link) rail is served
   * by the API, not the standalone funding service — `DepositCex` opts in.
   */
  useBackendUrl?: boolean
  /** Called when a funding action resolves with an error. Callback failures are isolated from the action result. */
  onError?: (error: OpenfortError) => unknown
}

/**
 * React surface over the funding session API.
 *
 * A session is one deposit attempt against a destination. The hook creates a
 * session, sets one payment method (a source the user commits to sending from,
 * or a fiat onramp method), then polls until the session reaches a terminal
 * state. The response carries everything the UI (or an agent) needs: a receiver
 * address, a scannable URI, prefilled wallet deeplinks, and CEX guidance.
 *
 * The hook depends on a {@link FundingClient}, not on `fetch` directly, so a
 * custom backend or a test double can be injected through
 * {@link UseFundingOptions.client}.
 *
 * Every action resolves to a discriminated result, so operational failures do
 * not require a `try`/`catch`.
 *
 * @returns Session state plus `fund` (run the deposit flow) and `reset`.
 *
 * @example
 * ```tsx
 * import { useFunding } from '@openfort/react'
 *
 * function FundingButton() {
 *   const { fund, error } = useFunding()
 *   const run = async () => {
 *     const result = await fund(
 *       { chain: 'eip155:8453', currency: 'native', address: '0x1111111111111111111111111111111111111111' },
 *       { type: 'evm', source: { chain: 'eip155:1', currency: 'native', amount: '1000000000000000' } }
 *     )
 *     if ('error' in result) return
 *     console.log(result.session.id)
 *   }
 *   return <button onClick={run}>{error ? error.shortMessage : 'Fund'}</button>
 * }
 * ```
 */
/**
 * Resolve the funding client every funding hook shares, in order of preference:
 *   1. an explicitly injected client (tests / custom backends),
 *   2. the SDK's `openfort.funding` namespace once it covers the full session
 *      surface (an older SDK without methods/quote would break the fiat hooks),
 *   3. the fetch adapter over `uiConfig.fundingBaseUrl` / the API backend.
 * The SDK namespace covers sessions; embedded auth and pay-links stay on the
 * fetch adapter until the SDK exposes them (CEX is deferred), so the two are
 * composed.
 */
export function useFundingClient(options?: UseFundingOptions): FundingClient | null {
  const { uiConfig, publishableKey } = useOpenfort()
  const coreClient = useOpenfortCore((s) => s.client)
  // The funding JSON API defaults to the Openfort backend (api.openfort.io);
  // integrators can point the crypto rails at a custom service via
  // uiConfig.fundingBaseUrl. The CEX rail always uses the backend (Coinbase pay-link).
  const backendUrl = getOpenfortBackendUrl()
  const baseUrl = options?.useBackendUrl ? backendUrl : uiConfig.fundingBaseUrl || backendUrl
  const injected = options?.client
  return useMemo<FundingClient | null>(() => {
    if (injected) return injected
    const sdkFunding = (coreClient as unknown as { funding?: Pick<FundingClient, 'sessions'> } | undefined)?.funding
    const fetchClient = baseUrl ? createFetchFundingClient(baseUrl, publishableKey) : null
    if (sdkFunding && typeof sdkFunding.sessions?.methods === 'function') {
      return {
        sessions: sdkFunding.sessions,
        authIntents: fetchClient?.authIntents ?? sdkAuthIntentsUnavailable,
        payLink: fetchClient?.payLink ?? sdkPayLinkUnavailable,
      }
    }
    return fetchClient
  }, [injected, coreClient, baseUrl, publishableKey])
}

export function useFunding(options?: UseFundingOptions): UseFunding {
  const coreClient = useOpenfortCore((s) => s.client)
  const { captureAuthSession } = useAuthTransitions()
  const client = useFundingClient(options)
  const isAvailable = client != null

  const [session, setSession] = useState<FundingSession | null>(null)
  const [error, setError] = useState<OpenfortError | null>(null)
  const [loading, setLoading] = useState(false)
  // Generation guard: only the latest fund()/reset() updates state, so
  // re-selecting a source mid-poll can't be clobbered by a stale request.
  const generation = useRef(0)
  const mountedRef = useRef(true)
  const trackSubscriptionRef = useRef<(() => void) | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const reportError = useCallback((fundingError: OpenfortError, isCurrent = true) => {
    if (isCurrent) {
      setError(fundingError)
      logger.error('[funding] action failed', fundingError)
      notifyHookCallback(optionsRef.current?.onError, fundingError, 'onError')
    }
    return { error: fundingError } as const
  }, [])

  // Detach this hook from shared tracking on unmount. The registry keeps a
  // restartable poll alive briefly so a remounted funding page can reattach.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      trackSubscriptionRef.current?.()
      trackSubscriptionRef.current = null
      generation.current += 1
      logger.log('[funding] unmounted — tracking observer detached')
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
    async (target: FundingTarget, paymentMethod: PaymentMethodInput): Promise<FundingSessionResult> => {
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
        ...(paymentMethod.type === 'onramp'
          ? { method: paymentMethod.method }
          : { sourceChain: paymentMethod.source.chain, amount: paymentMethod.source.amount }),
      })
      try {
        if (!client) {
          throw new FundingNotConfiguredError()
        }
        const created = await client.sessions.create({ target })
        if (!isCurrent()) throw fundingRequestSuperseded()
        logger.log('[funding] session created', { sessionId: created.id, status: created.status })
        const current = await client.sessions.setPaymentMethod(created.id, {
          clientSecret: created.clientSecret,
          paymentMethod,
        })
        if (!isCurrent()) throw fundingRequestSuperseded()
        setSession(current)
        setLoading(false)
        logger.log('[funding] payment method set', {
          sessionId: current.id,
          status: current.status,
          receiverAddress: cryptoPaymentMethod(current.paymentMethod)?.receiverAddress,
        })
        // The session status encodes both hops: waiting_payment (awaiting the source
        // deposit, e.g. the Coinbase withdrawal) → processing (deposit arrived on-chain,
        // Relay bridging) → succeeded / bounced (Relay refunded) / expired (no deposit).
        return { session: await pollUntilTerminal(client, setSession, current, isCurrent) }
      } catch (cause) {
        const fundingError = asOpenfortError(
          cause,
          (wrappedCause) => new FundingError('Failed to fund the wallet.', { cause: wrappedCause })
        )
        if (isCurrent()) setLoading(false)
        return reportError(fundingError, isCurrent())
      }
    },
    [client, reportError]
  )

  const createSession = useCallback(
    async (target: FundingTarget): Promise<FundingSessionResult> => {
      setError(null)
      try {
        if (!client) throw new FundingNotConfiguredError()
        const created = await client.sessions.create({ target })
        logger.log('[funding] session created (cex)', { sessionId: created.id, status: created.status })
        return { session: created }
      } catch (cause) {
        return reportError(
          asOpenfortError(
            cause,
            (wrappedCause) => new FundingError('Failed to create a funding session.', { cause: wrappedCause })
          )
        )
      }
    },
    [client, reportError]
  )

  const track = useCallback(
    async (toTrack: { id: string; clientSecret: string }): Promise<FundingSessionResult> => {
      generation.current += 1
      setError(null)
      const authSession = captureAuthSession()
      const operationKey = `funding-track:${toTrack.id}`
      try {
        if (!client) throw new FundingNotConfiguredError()
        const operation = getOrCreatePersistentOperation<FundingTrackSnapshot, FundingTrackSnapshot>({
          owner: coreClient,
          key: operationKey,
          principalIsCurrent: authSession.isCurrent,
          orphanRetentionMs: TRACK_ORPHAN_RETENTION_MS,
          start: async ({ publish, isCurrent }) => {
            const start = await client.sessions.get(toTrack.id, { clientSecret: toTrack.clientSecret })
            if (!isCurrent()) throw fundingRequestSuperseded()
            publish(fundingTrackSnapshot(start))
            logger.log('[funding] track() start', { sessionId: start.id, status: start.status })
            const terminal = await pollUntilTerminal(
              client,
              (next) => publish(fundingTrackSnapshot(next)),
              start,
              isCurrent
            )
            return fundingTrackSnapshot(terminal)
          },
        })
        trackSubscriptionRef.current?.()
        trackSubscriptionRef.current = operation.subscribe((snapshot) => {
          if (mountedRef.current) setSession(restoreTrackedSession(snapshot, toTrack.clientSecret))
        })
        const terminal = await operation.promise
        return { session: restoreTrackedSession(terminal, toTrack.clientSecret) }
      } catch (cause) {
        return reportError(
          asOpenfortError(
            cause,
            (wrappedCause) => new FundingError('Failed to track the funding session.', { cause: wrappedCause })
          ),
          mountedRef.current
        )
      }
    },
    [captureAuthSession, client, coreClient, reportError]
  )

  const payLink = useCallback(
    async (params: PayLinkParams): Promise<FundingPayLinkResult> => {
      setError(null)
      try {
        if (!client) throw new FundingNotConfiguredError()
        const url = await client.payLink(params)
        return { url: getTrustedFundingProviderUrl(url, 'coinbase').href }
      } catch (cause) {
        return reportError(
          asOpenfortError(
            cause,
            (wrappedCause) => new FundingError('Failed to create a funding pay link.', { cause: wrappedCause })
          )
        )
      }
    },
    [client, reportError]
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
