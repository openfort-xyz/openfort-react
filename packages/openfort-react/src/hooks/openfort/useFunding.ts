'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOpenfort } from '../../components/Openfort/useOpenfort'
import { useOpenfortCore } from '../../openfort/useOpenfort'
import { logger } from '../../utils/logger'
import { createFetchFundingClient, type FundingClient } from './fundingClient'

/** Pay-links aren't exposed by the SDK funding namespace yet (CEX is API-deferred). */
const sdkPayLinkUnavailable = async (): Promise<string> => {
  throw new Error('Exchange pay-links are not available through the SDK yet')
}

/**
 * Funding session client — adapted from the openfort-funding prototype.
 *
 * A session is one deposit attempt against a destination. The client creates a
 * session, sets one payment method (a source the user commits to sending from),
 * then polls until the session reaches a terminal state. The response carries
 * everything the UI (or an agent) needs: a receiver address, a scannable URI,
 * prefilled wallet deeplinks, and CEX guidance.
 *
 * The hook depends on a {@link FundingClient}, not on `fetch` directly. Today the
 * default client is the fetch adapter over `uiConfig.fundingBaseUrl`; once
 * `@openfort/openfort-js` ships the `funding` namespace, the resolution below
 * swaps to `coreClient.funding` with no change to this hook.
 */

/** Where funds should land. CAIP-2 chain + token contract (or native) + wallet. */
export type FundingTarget = {
  /** CAIP-2 chain id, e.g. "eip155:8453" for Base. */
  chain: string
  /** Token contract address, or the zero address for the chain's native asset. */
  currency: string
  /** Destination wallet that receives the bridged funds. */
  address: string
}

/** The route the user commits to sending from. */
export type FundingSource = {
  /** CAIP-2 chain id the user sends from, e.g. "eip155:137". */
  chain: string
  /** Token contract the user sends, or the zero address for native. */
  currency: string
  /** Amount in the source token's smallest unit (wei, lamports, base units). */
  amount: string
}

/** Session lifecycle, mirroring the prototype's vocabulary. */
export type SessionStatus =
  | 'requires_payment_method'
  | 'waiting_payment'
  | 'processing'
  | 'succeeded'
  | 'bounced'
  | 'expired'

export type FundingFee = {
  kind: 'gas' | 'relayerGas' | 'relayerService' | 'app'
  amount: string
  currency: string
}

/**
 * Payment-method-per-source input. `evm` and `solana` are self-custody wallet
 * sends (they get wallet deeplinks); `cex` is an exchange withdrawal (no
 * deeplink — exchanges can't be deeplinked into).
 */
export type PaymentMethodInput =
  | { type: 'evm'; source: FundingSource }
  | { type: 'solana'; source: FundingSource }
  | { type: 'cex'; cex: string; source: FundingSource }

export type PaymentMethodType = PaymentMethodInput['type']

/** A prefilled deeplink into a source wallet app (e.g. Trust Wallet). */
export type WalletDeeplink = { app: string; label: string; url: string }

/** Per-exchange guidance for the guided CEX flow. */
export type CexGuidance = {
  exchange: string
  network: string
  minWithdrawal: string | null
  requiresMemo: boolean
}

/** A resolved payment method — what the UI renders and the agent reads. */
export type PaymentMethod = {
  type: PaymentMethodType
  source: FundingSource
  /** Address the user (or their CEX/wallet) sends to. */
  receiverAddress: string
  /** Provider-side id used to track settlement. */
  providerRequestId: string
  /** BIP-21 / EIP-681 URI for QR. Scanner support for amount/token varies. */
  addressUri: string
  /** Prefilled deeplinks for source wallet apps, when available. */
  deeplinks: WalletDeeplink[]
  /** Guidance for the "cex" type; null otherwise. */
  cex: CexGuidance | null
  fees: FundingFee[]
  /** Minimum to send for this route (source base units), or null. */
  minAmount: string | null
}

/** A single deposit attempt. */
export type FundingSession = {
  id: string
  clientSecret: string
  target: FundingTarget
  status: SessionStatus
  amountUnits: string | null
  metadata: Record<string, string> | null
  externalId: string | null
  createdAt: number
  expiresAt: number
  paymentMethod: PaymentMethod | null
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

/** Parameters for a Coinbase pay-link request. The destination (chain, currency,
 * address) is bound to the session server-side; the client only chooses how much. */
export type PayLinkParams = {
  /** Session the pay-link settles into — pins the destination so it can't be redirected. */
  sessionId: string
  /** Secret returned when the session was created; authorizes this pay-link. */
  clientSecret: string
  /** Amount in the destination asset's units (≈ USD for USDC). Coinbase enforces its own minimum. */
  amount: string
  /** Destination asset ticker. Optional — the backend defaults to USDC. */
  asset?: string
}

/** Options for {@link useFunding}. */
export type UseFundingOptions = {
  /** Inject a funding client (tests, or a custom backend). Defaults to the
   * fetch adapter over `uiConfig.fundingBaseUrl`. */
  client?: FundingClient
}

/**
 * React surface over the funding session API.
 *
 * @returns Session state plus `fund` (run the deposit flow) and `reset`.
 */
export function useFunding(options?: UseFundingOptions): UseFunding {
  const { uiConfig, publishableKey } = useOpenfort()
  const { client: coreClient } = useOpenfortCore()
  const baseUrl = uiConfig.fundingBaseUrl ?? ''
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
          throw new Error('Funding is not configured (set uiConfig.fundingBaseUrl)')
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
      if (!client) throw new Error('Funding is not configured (set uiConfig.fundingBaseUrl)')
      const created = await client.sessions.create({ target })
      logger.log('[funding] session created (cex)', { sessionId: created.id, status: created.status })
      return created
    },
    [client]
  )

  const track = useCallback(
    async (toTrack: { id: string; clientSecret: string }): Promise<FundingSession> => {
      if (!client) throw new Error('Funding is not configured (set uiConfig.fundingBaseUrl)')
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
      if (!client) throw new Error('Funding is not configured (set uiConfig.fundingBaseUrl)')
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
