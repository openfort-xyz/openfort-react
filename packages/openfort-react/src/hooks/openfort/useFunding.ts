'use client'

import { useCallback, useRef, useState } from 'react'
import { useOpenfort } from '../../components/Openfort/useOpenfort'

/**
 * Funding session client — adapted from the openfort-funding prototype.
 *
 * A session is one deposit attempt against a destination. The client creates a
 * session, sets one payment method (a source the user commits to sending from),
 * then polls until the session reaches a terminal state. The response carries
 * everything the UI (or an agent) needs: a receiver address, a scannable URI,
 * prefilled wallet deeplinks, and CEX guidance.
 *
 * The network layer is stubbed: it compiles and drives the UI state machine,
 * but does not talk to a live backend yet.
 *
 * TODO(openfort-funding-backend): replace the stubbed `createSession`,
 * `setPaymentMethod`, and `getSession` calls with real `fetch` requests against
 * `${fundingBaseUrl}/v1/funding/sessions...`. The prototype flow is:
 *   POST /v1/funding/sessions               { target }              -> FundingSession
 *   POST /v1/funding/sessions/:id/paymentMethods { clientSecret, paymentMethod } -> FundingSession
 *   GET  /v1/funding/sessions/:id?clientSecret=...                  -> FundingSession (poll)
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

export type UseFunding = {
  session: FundingSession | null
  status: SessionStatus | 'idle'
  error: Error | null
  /** True while a session is being created and its deposit address fetched. */
  loading: boolean
  /** True when the funding backend is configured (uiConfig.fundingBaseUrl set). */
  isAvailable: boolean
  /** Create a session, set a payment method, and poll until terminal. */
  fund: (target: FundingTarget, paymentMethod: PaymentMethodInput) => Promise<FundingSession>
  /** Resolve a prefilled exchange pay URL (Coinbase/Binance) from the backend. */
  payLink: (params: PayLinkParams) => Promise<string>
  /** Reset to the idle state (e.g. when leaving the Deposit flow). */
  reset: () => void
}

/** Parameters for an exchange pay-link request. */
export type PayLinkParams = {
  exchange: string
  address: string
  asset: string
  chain: string
  amount?: string
}

// --- Network layer ---------------------------------------------------------
// The three calls against the openfort-funding backend. The hook's state
// machine below drives create → set payment method → poll until terminal.

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Funding request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

async function createSession(baseUrl: string, target: FundingTarget): Promise<FundingSession> {
  const res = await fetch(`${baseUrl}/v1/funding/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ target }),
  })
  return readJson<FundingSession>(res)
}

async function setPaymentMethod(
  baseUrl: string,
  session: FundingSession,
  paymentMethod: PaymentMethodInput
): Promise<FundingSession> {
  const res = await fetch(`${baseUrl}/v1/funding/sessions/${session.id}/paymentMethods`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientSecret: session.clientSecret, paymentMethod }),
  })
  return readJson<FundingSession>(res)
}

async function getSession(baseUrl: string, session: FundingSession): Promise<FundingSession> {
  const url = `${baseUrl}/v1/funding/sessions/${session.id}?clientSecret=${encodeURIComponent(session.clientSecret)}`
  return readJson<FundingSession>(await fetch(url))
}

/**
 * React surface over the funding session API.
 *
 * @returns Session state plus `fund` (run the deposit flow) and `reset`.
 */
export function useFunding(): UseFunding {
  const { uiConfig } = useOpenfort()
  const baseUrl = uiConfig.fundingBaseUrl ?? ''
  const isAvailable = baseUrl.length > 0

  const [session, setSession] = useState<FundingSession | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)
  // Generation guard: only the latest fund()/reset() updates state, so
  // re-selecting a source mid-poll can't be clobbered by a stale request.
  const generation = useRef(0)

  const reset = useCallback(() => {
    generation.current += 1
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
      try {
        if (!isAvailable) {
          throw new Error('Funding backend not configured (set uiConfig.fundingBaseUrl)')
        }
        const created = await createSession(baseUrl, target)
        let current = await setPaymentMethod(baseUrl, created, paymentMethod)
        if (!isCurrent()) return current
        setSession(current)
        setLoading(false)

        while (!TERMINAL.includes(current.status)) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS))
          if (!isCurrent()) return current
          current = await getSession(baseUrl, current)
          if (!isCurrent()) return current
          setSession(current)
        }
        return current
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        if (isCurrent()) {
          setError(err)
          setLoading(false)
        }
        throw err
      }
    },
    [baseUrl, isAvailable]
  )

  const payLink = useCallback(
    async (params: PayLinkParams): Promise<string> => {
      const res = await fetch(`${baseUrl}/v1/funding/pay-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = (await res.json()) as { url: string }
      return data.url
    },
    [baseUrl]
  )

  return { session, status: session?.status ?? 'idle', error, loading, isAvailable, fund, payLink, reset }
}
