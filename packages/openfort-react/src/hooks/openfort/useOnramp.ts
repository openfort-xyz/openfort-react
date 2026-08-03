'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOpenfort } from '../../components/Openfort/useOpenfort'
import { logger } from '../../utils/logger'
import {
  type FundingSession,
  type OnrampAngle,
  type OnrampMethodId,
  type OnrampQuote,
  type ResolvedFundingMethod,
  type SessionStatus,
  type UseFundingOptions,
  useFundingClient,
} from './useFunding'
import type { FundingSessionRef } from './useFundingMethods'

const TERMINAL: SessionStatus[] = ['succeeded', 'bounced', 'expired']
const POLL_MS = 4000

export type UseOnrampOptions = UseFundingOptions & {
  /**
   * How to present an iframe-angle checkout URL:
   * - 'popup' (default): `window.open` in a new window; the session keeps
   *   polling here, so completion is detected even if the popup never redirects.
   * - 'redirect': navigate the current page to the provider checkout.
   * - 'manual': don't present anything — read `url` and render it yourself.
   */
  mode?: 'popup' | 'redirect' | 'manual'
  /** Buyer-country override forwarded to commit + quote calls. */
  country?: string
}

export type OnrampOpenParams = {
  /** Fiat amount to prefill in the checkout, human units (e.g. "100.00"). */
  sourceAmount?: string
  /** ISO-4217 fiat currency for `sourceAmount`. */
  sourceCurrency?: string
  /** URL the provider redirects back to after checkout. */
  redirectUrl?: string
  /**
   * OTP-verified buyer identity — REQUIRED for the native wallet-pay angle
   * (`apple_pay` / `google_pay`), ignored otherwise. Verify email + phone via
   * Openfort's own OTP and capture the Coinbase Guest-Checkout consent BEFORE
   * calling open(); the server rejects the commit if these are missing,
   * malformed, or past Coinbase's re-verify window.
   */
  walletPay?: {
    email: string
    /** US mobile in E.164, e.g. "+14155550123". */
    phoneNumber: string
    /** ISO-8601 time the phone OTP was verified (Coinbase's 60-day window). */
    phoneNumberVerifiedAt: string
    /** ISO-8601 time the buyer accepted Coinbase's Guest Checkout terms. */
    agreementAcceptedAt: string
    /** Coinbase Verification API record ids (Coinbase-issued OTP). */
    smsVerificationId?: string
    emailVerificationId?: string
  }
  /**
   * Stripe v2 Link-auth flow — present when the buyer authenticated with Link
   * and a payment method was collected (the `embedded` angle's element flow).
   * The commit creates a HEADLESS Stripe session; redeem its secret afterwards
   * via `sessions.onrampCheckout` inside the coordinator's performCheckout.
   */
  stripeLink?: {
    linkAuthIntentId: string
    cryptoCustomerId: string
    cryptoPaymentToken: string
  }
}

export type UseOnramp = {
  /**
   * Commit the method as the session's payment method and present the checkout.
   * Resolves when the session reaches a terminal status (`succeeded` / `bounced`
   * / `expired`) — settlement is provider-webhook-driven, so this is the source
   * of truth, not the popup closing.
   */
  open: (params?: OnrampOpenParams) => Promise<FundingSession>
  /** Price the route before committing — same provider the commit would use. */
  quote: (params: { sourceAmount: string; sourceCurrency: string }) => Promise<OnrampQuote>
  /** Session lifecycle status; 'idle' before open(). */
  status: SessionStatus | 'idle'
  /**
   * The committed checkout URL. For the `iframe` angle it's the provider's hosted
   * page (auto-presented unless mode is 'manual'); for `native` it's the in-page
   * Pay-button link the caller mounts itself (never auto-presented). Null before
   * open() / when the provider returns none.
   */
  url: string | null
  /** The committed angle — branch on it to mount (`native`) vs open (`iframe`). */
  angle: OnrampAngle | null
  session: FundingSession | null
  /** True from open() until the checkout URL is presented (not until settlement). */
  loading: boolean
  error: Error | null
  reset: () => void
}

/**
 * Execute ONE resolved fiat method against a funding session — the headless
 * engine behind the modal's card / Apple Pay / Google Pay / bank-transfer rows.
 *
 * Angle-agnostic to the caller: `iframe` opens the provider's hosted checkout
 * (popup / redirect / manual); `native` (in-page provider SDK, e.g. Coinbase
 * wallet pay) commits a provider order from the OTP-verified `walletPay` identity
 * and surfaces its Pay-button `url` for the caller to mount in-page — the hook
 * never auto-presents a native url. Under the hood open() = `setPaymentMethod({
 * type: 'onramp', method })` — one endpoint and one state machine shared with the
 * crypto rails, polled here until terminal.
 *
 * A funding session accepts a single payment method: after open(), retrying
 * requires a fresh session (create one per attempt).
 */
export function useOnramp(
  session: FundingSessionRef | null | undefined,
  method: ResolvedFundingMethod | OnrampMethodId | null | undefined,
  options?: UseOnrampOptions
): UseOnramp {
  const client = useFundingClient(options)
  const mode = options?.mode ?? 'popup'
  const methodId = typeof method === 'string' ? method : method?.method
  // The commit and quote must route with the same region as the methods
  // preview — an explicit override wins, else `uiConfig.funding.country`, else
  // the server falls back to the request IP.
  const { uiConfig } = useOpenfort()
  const country = options?.country ?? uiConfig.funding?.country

  const [current, setCurrent] = useState<FundingSession | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)
  // Generation guard: only the latest open()/reset() updates state. Unmount is
  // tracked separately with a ref the mount effect re-arms — StrictMode's dev
  // double-mount must NOT kill an in-flight open() (the cleanup runs between
  // the paired mounts), only a real unmount stops the poll loop (otherwise it
  // runs until the session's 24h TTL).
  const generation = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const reset = useCallback(() => {
    generation.current += 1
    setCurrent(null)
    setError(null)
    setLoading(false)
  }, [])

  const quote = useCallback(
    async (params: { sourceAmount: string; sourceCurrency: string }): Promise<OnrampQuote> => {
      if (!client) throw new Error('Funding is not configured (set uiConfig.fundingBaseUrl)')
      if (!session || !methodId) throw new Error('useOnramp needs a session and a method to quote')
      return client.sessions.quote(session.id, {
        clientSecret: session.clientSecret,
        method: methodId,
        sourceAmount: params.sourceAmount,
        sourceCurrency: params.sourceCurrency,
        country,
      })
    },
    [client, session, methodId, country]
  )

  const open = useCallback(
    async (params?: OnrampOpenParams): Promise<FundingSession> => {
      if (!client) throw new Error('Funding is not configured (set uiConfig.fundingBaseUrl)')
      if (!session || !methodId) throw new Error('useOnramp needs a session and a method to open')
      generation.current += 1
      const gen = generation.current
      const isCurrent = () => generation.current === gen && mounted.current
      setError(null)
      setLoading(true)
      try {
        const committed = await client.sessions.setPaymentMethod(session.id, {
          clientSecret: session.clientSecret,
          paymentMethod: {
            type: 'onramp',
            method: methodId,
            sourceAmount: params?.sourceAmount,
            sourceCurrency: params?.sourceCurrency,
            redirectUrl: params?.redirectUrl,
            country,
            stripeLink: params?.stripeLink,
            // Native wallet pay only; spreading `undefined` adds nothing for
            // card / bank transfer.
            ...params?.walletPay,
          },
        })
        if (!isCurrent()) return committed
        setCurrent(committed)
        setLoading(false)

        const pm = committed.paymentMethod
        const angle = pm?.type === 'onramp' ? pm.angle : null
        const checkoutUrl = pm?.type === 'onramp' ? pm.url : null
        logger.log('[onramp] committed', {
          sessionId: committed.id,
          method: methodId,
          angle,
          hasUrl: Boolean(checkoutUrl),
        })
        // Only the hosted (iframe) angle is auto-presented. A native url is an
        // in-page Pay-button link — surfaced via `url`/`angle` for the caller to
        // mount; auto-opening it would break the in-page sheet.
        if (checkoutUrl && angle === 'iframe' && mode === 'popup') {
          window.open(checkoutUrl, 'openfort-onramp', 'popup,width=470,height=750')
        } else if (checkoutUrl && angle === 'iframe' && mode === 'redirect') {
          window.location.href = checkoutUrl
        }

        // Settlement is webhook-driven server-side; poll the session (never the
        // popup) until it turns terminal.
        let latest = committed
        while (!TERMINAL.includes(latest.status)) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS))
          if (!isCurrent()) return latest
          latest = await client.sessions.get(session.id, { clientSecret: session.clientSecret })
          if (!isCurrent()) return latest
          setCurrent(latest)
        }
        logger.log('[onramp] terminal', { sessionId: latest.id, status: latest.status })
        return latest
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        if (isCurrent()) {
          setError(err)
          setLoading(false)
          logger.error('[onramp] open() failed', err)
        }
        throw err
      }
    },
    [client, session, methodId, mode, country]
  )

  const pm = current?.paymentMethod
  return {
    open,
    quote,
    status: current?.status ?? 'idle',
    url: pm?.type === 'onramp' ? pm.url : null,
    angle: pm?.type === 'onramp' ? pm.angle : null,
    session: current,
    loading,
    error,
    reset,
  }
}
