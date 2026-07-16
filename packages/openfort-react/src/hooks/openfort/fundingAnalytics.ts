import { logger } from '../../utils/logger'
import type { FundingFee, PaymentMethodType, SessionStatus } from './useFunding'

/**
 * Typed analytics events for the funding-session rail (the crypto/wallet/exchange
 * deposit flow backed by `/v2/funding/sessions/*` + Relay bridging). The fiat
 * "buy" onramp rail is intentionally out of scope here — it's provider-hosted and
 * emits its own events elsewhere.
 *
 * The SDK does not bundle an analytics vendor. Instead `useFunding` emits these
 * events into an integrator-supplied {@link FundingAnalyticsSink}, wired via
 * `uiConfig.funding.onEvent`. Openfort's own app forwards them to PostHog; a
 * third-party integrator can forward them anywhere (or nowhere).
 *
 * Event names mirror the SDK's own vocabulary so a dashboard maps 1:1 to code:
 * - `session_status` values come from {@link SessionStatus}.
 * - `payment_method_type` values come from {@link PaymentMethodType} (`evm | solana | cex`).
 */
export type FundingAnalyticsEvent =
  /** A source chain/currency was selected and a session flow kicked off for it. */
  | {
      type: 'funding_route_selected'
      /** Which rail: self-custody wallet send vs exchange withdrawal. */
      kind: 'crypto' | 'cex'
      /** CAIP-2 source chain the user commits to sending from. */
      sourceChain: string
      /** Source currency symbol. */
      sourceCurrency: string
      /** CAIP-2 destination chain funds settle on. */
      destChain: string
    }
  /** `sessions.create` returned — a deposit attempt exists (no address yet). */
  | {
      type: 'funding_session_created'
      sessionId: string
      /** CAIP-2 destination chain. */
      targetChain: string
      targetCurrency: string
      status: SessionStatus
    }
  /** `sessions.setPaymentMethod` returned — a deposit address + quote now exist. */
  | {
      type: 'funding_payment_method_set'
      sessionId: string
      /** `evm | solana | cex`. */
      paymentMethodType: PaymentMethodType
      sourceChain: string
      sourceCurrency: string
      /** Source amount in the source token's smallest unit. */
      sourceAmount: string
      /** Address the user sends to (Relay deposit address). */
      receiverAddress: string | null
      /** Minimum to send for this route (source base units), or null. */
      minAmount: string | null
      /** Fee kinds attached to the route: `gas | relayerGas | relayerService | app`. */
      feeKinds: FundingFee['kind'][]
      status: SessionStatus
    }
  /** The polled session moved between non-terminal states (e.g. waiting_payment → processing). */
  | {
      type: 'funding_status_changed'
      sessionId: string
      from: SessionStatus
      to: SessionStatus
    }
  /** Terminal: funds delivered to the destination wallet. */
  | {
      type: 'funding_succeeded'
      sessionId: string
      /** On-chain settlement hash when available. */
      txHash: string | null
      secondsToTerminal: number
    }
  /** Terminal: source funds arrived but Relay refunded them (bridge failure). */
  | {
      type: 'funding_bounced'
      sessionId: string
      secondsToTerminal: number
    }
  /** Terminal: nothing arrived before the session's TTL. */
  | {
      type: 'funding_expired'
      sessionId: string
      secondsToTerminal: number
    }
  /** The flow was left (reset/unmount) with a non-terminal session — high-intent drop-off. */
  | {
      type: 'funding_session_abandoned'
      sessionId: string
      lastStatus: SessionStatus
      secondsInSession: number
    }
  /** A funding call threw. `stage` locates the failing hop. */
  | {
      type: 'funding_session_error'
      sessionId: string | null
      stage: 'create' | 'setPaymentMethod' | 'poll'
      message: string
    }

/** Sink an integrator wires to their analytics backend (e.g. PostHog). */
export type FundingAnalyticsSink = (event: FundingAnalyticsEvent) => void

/**
 * Wrap a sink so a throwing integrator handler can never break the funding flow.
 * Returns a no-op emitter when no sink is configured.
 */
export function createFundingEmitter(sink?: FundingAnalyticsSink): (event: FundingAnalyticsEvent) => void {
  if (!sink) return () => {}
  return (event) => {
    try {
      sink(event)
    } catch (e) {
      logger.warn('[funding:analytics] sink threw', e)
    }
  }
}
