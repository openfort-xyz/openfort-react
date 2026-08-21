'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import type { ChangeEvent, CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import logos from '../../../assets/logos.js'
import { toDisplayMessage } from '../../../errors/base.js'
import { FundingError } from '../../../errors/funding.js'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { DEST_USDC, isSolana } from '../../../hooks/openfort/fundingSources.js'
import { useFunding } from '../../../hooks/openfort/useFunding.js'
import { useFundingChains } from '../../../hooks/openfort/useFundingChains.js'
import { useFundingTarget } from '../../../hooks/openfort/useFundingTarget.js'
import { useInvalidateBalance } from '../../../hooks/useBalance.js'
import { useAuthTransitions } from '../../../openfort/authTransitionContext.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import {
  clearPersistentOperation,
  getOrCreatePersistentOperation,
  hasPersistentOperation,
} from '../../../shared/utils/persistentOperationRegistry.js'
import { logger } from '../../../utils/logger.js'
import { getPublishableKeyEnvironment } from '../../../utils/validation.js'
import { Arrow, ArrowChevron } from '../../Common/Button/styles.js'
import { usePageActivity } from '../../Common/Modal/pageActivity.js'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles.js'
import Tooltip from '../../Common/Tooltip/index.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { BigAmountInput, BigAmountRow, BigAmountSymbol, MethodRowButton } from '../Buy/styles.js'
import { amountInputWidth } from '../Buy/utils.js'
import { CEX_CHAIN_NAMES, isCexDeliverable } from '../Deposit/cexChains.js'
import { DepositProgress, isDepositFlowActive } from '../Deposit/DepositProgress.js'
import { DepositStatus } from '../Deposit/DepositStatus.js'
import { walletListBtn } from '../Deposit/formStyles.js'
import { ButtonLogo, StepDivider } from '../Deposit/styles.js'
import { TestnetNotice } from '../Deposit/TestnetNotice.js'
import { sanitizeAmountInput, sanitizeForParsing } from '../Send/utils.js'

/** Exchange rails. Binance is gated until its rail lands. */
const EXCHANGES = [
  { id: 'coinbase', comingSoon: false },
  { id: 'binance', comingSoon: true },
] as const

/** Exchange brand logos keyed by exchange id. */
const EXCHANGE_LOGO: Record<string, ReactNode> = {
  coinbase: <logos.Coinbase background />,
  binance: <logos.Binance />,
}

/** Coinbase Onramp minimum (USD, ≈ USDC units); enforced client-side for UX. */
const MIN_AMOUNT = 5

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const helperText: CSSProperties = { fontSize: 12, color: 'var(--ck-body-color-muted, #6b7280)' }
const errorHelper: CSSProperties = { fontSize: 12, color: '#dc2626' }

/**
 * Transfer from Exchange — the user enters an amount; "Open Coinbase" hands off to
 * a hosted Coinbase pay-link that delivers to the embedded wallet on the
 * destination chain. The destination (chain + currency + address) is bound to a
 * funding session created up-front, so the client can't redirect the funds — only
 * the amount is chosen here. After hand-off the bound session is polled until it
 * settles (advanced by the Coinbase webhook on the backend), driving the
 * success / failed screen. No Relay routing; Binance is gated until its rail lands.
 */
const DepositCex = () => {
  const pageActive = usePageActivity()
  const { triggerResize, publishableKey, setRoute } = useOpenfort()
  // Coinbase onramp settles real funds on mainnet, so a test key can't deliver here.
  // Keep the button live for the demo but block the hand-off with a testnet notice.
  const testnet = getPublishableKeyEnvironment(publishableKey) === 'test'
  const target = useFundingTarget()
  // CEX (Coinbase pay-link + session) is served by the Openfort API, not the
  // standalone funding service — resolve this rail's base URL from the API backend.
  const { isAvailable, createSession, track, payLink, status } = useFunding({ useBackendUrl: true })
  const wallet = useEthereumEmbeddedWallet()
  const embeddedAccounts = useOpenfortCore((s) => s.embeddedAccounts)
  const client = useOpenfortCore((s) => s.client)
  const { captureAuthSession } = useAuthTransitions()
  const { chains } = useFundingChains()
  const invalidateBalance = useInvalidateBalance()

  const [amount, setAmount] = useState(String(MIN_AMOUNT))
  const [session, setSession] = useState<{ id: string; clientSecret: string } | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [opened, setOpened] = useState(false)
  const pageActiveRef = useRef(pageActive)
  const pendingPopupRef = useRef<Window | null>(null)
  const payLinkInFlightRef = useRef(false)
  const payLinkAttemptRef = useRef(0)
  pageActiveRef.current = pageActive

  useEffect(() => {
    if (pageActive) return
    pendingPopupRef.current?.close()
    pendingPopupRef.current = null
    payLinkAttemptRef.current += 1
    payLinkInFlightRef.current = false
  }, [pageActive])

  useEffect(
    () => () => {
      pendingPopupRef.current?.close()
      pendingPopupRef.current = null
      payLinkAttemptRef.current += 1
      payLinkInFlightRef.current = false
    },
    []
  )

  // Resolve the destination by chain family: EVM targets use the EVM embedded
  // wallet, Solana targets the Solana (SVM) embedded account — never cross families
  // (an EVM address on a Solana target would be rejected / mis-delivered). Accounts
  // come from the core store so EVM-only apps don't need the Solana React context.
  const solanaAddress = embeddedAccounts?.find((acc) => acc.chainType === ChainTypeEnum.SVM)?.address
  const address = isSolana(target.chain) ? solanaAddress : wallet.address
  const chainSupported = isCexDeliverable(target.chain)

  // Resolve the destination asset + chain for the "Arrives as …" line. The live
  // chain list is curated for source selection, so the destination may be absent;
  // only claim a symbol we resolved, or USDC for the zero-config default.
  const destChain = chains.find((c) => c.id === target.chain)
  const destChainName = destChain?.name ?? CEX_CHAIN_NAMES[target.chain] ?? target.chain
  const destAsset = destChain?.currencies.find((c) => c.address.toLowerCase() === target.currency.toLowerCase())
  const isDefaultUsdc = target.currency.toLowerCase() === DEST_USDC.toLowerCase()
  const destAssetLabel = destAsset?.symbol ?? (isDefaultUsdc ? 'USDC' : null)

  // Mint the destination-bound session up-front (per target wallet), so the click
  // that opens Coinbase is a single fast pay-link call and stays popup-safe.
  //
  // `createSession` is held in a ref and kept OUT of the effect deps: its identity
  // churns whenever the core client re-memoizes (e.g. during Solana recovery
  // retries, which re-render rapidly). If it were a dep, a churn mid-flight would
  // re-run the effect, fire its cleanup (`cancelled = true`), then early-return on
  // the unchanged sessionKey — so the in-flight create resolves but its result is
  // dropped and never retried, stranding the page on "Preparing…". The effect must
  // only re-run on a genuine destination change.
  const sessionKey = useRef('')
  const createSessionRef = useRef(createSession)
  createSessionRef.current = createSession
  useEffect(() => {
    // No session on testnet — Coinbase can't settle to a testnet wallet and the
    // button below is blocked anyway; skip the mint so we don't fire a doomed call.
    if (!isAvailable || !address || !chainSupported || testnet) return
    const key = `${target.chain}|${target.currency}|${address}`
    if (sessionKey.current === key) return
    sessionKey.current = key
    let cancelled = false
    setSession(null)
    setError(null)
    const operationKey = `funding-session:${key}`
    const authSession = captureAuthSession()
    const operation = getOrCreatePersistentOperation({
      owner: client,
      key: operationKey,
      principalIsCurrent: authSession.isCurrent,
      start: () => createSessionRef.current({ chain: target.chain, currency: target.currency, address }),
    })
    operation.promise.then((result) => {
      if (cancelled || !authSession.isCurrent() || !operation.isCurrent()) return
      if ('error' in result) {
        clearPersistentOperation(client, operationKey)
        setError(result.error)
        return
      }
      setSession({ id: result.session.id, clientSecret: result.session.clientSecret })
    })
    return () => {
      cancelled = true
      // Clear the key so a genuine destination change re-creates the session;
      // without this the guard above would block the retry after this cancel.
      sessionKey.current = ''
    }
  }, [isAvailable, address, chainSupported, testnet, target.chain, target.currency, captureAuthSession, client])

  useEffect(() => {
    if (!pageActive || !session) return
    const trackKey = `funding-track:${session.id}`
    const trackIntentKey = `funding-track-intent:${session.id}`
    if (hasPersistentOperation(client, trackKey) || hasPersistentOperation(client, trackIntentKey)) {
      void track({ id: session.id, clientSecret: session.clientSecret })
    }
  }, [client, pageActive, session, track])

  const fiatAmount = useMemo(() => {
    const normalized = sanitizeForParsing(sanitizeAmountInput(amount))
    if (!normalized) return null
    const numeric = Number(normalized)
    return Number.isFinite(numeric) ? numeric : null
  }, [amount])
  const amountValid = fiatAmount !== null && fiatAmount >= MIN_AMOUNT
  const amountTooLow = fiatAmount !== null && fiatAmount < MIN_AMOUNT

  const infraReady = isAvailable && chainSupported && Boolean(session) && !error
  const payReady = infraReady && amountValid

  // Resize when a block that changes the modal's height toggles.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are re-measure triggers, not inputs
  useEffect(() => {
    triggerResize()
  }, [isAvailable, chainSupported, session, error, opened, amountTooLow, triggerResize])

  // Once the bound session settles, refresh balances so delivered funds show
  // without a manual reload.
  useEffect(() => {
    if (status === 'succeeded') invalidateBalance()
    if (!session || !['succeeded', 'bounced', 'expired'].includes(status)) return
    clearPersistentOperation(client, `funding-track-intent:${session.id}`)
  }, [client, invalidateBalance, session, status])

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeAmountInput(event.target.value)
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setAmount(raw)
    }
  }

  const handleAmountBlur = () => {
    const normalized = sanitizeForParsing(sanitizeAmountInput(amount))
    if (!normalized) return
    const numeric = Number(normalized)
    if (Number.isFinite(numeric) && numeric > 0) setAmount(numeric.toFixed(2))
  }

  const openExchange = () => {
    if (!session || fiatAmount === null || !amountValid || payLinkInFlightRef.current || !pageActiveRef.current) return
    // Open the tab up-front (sync) so the popup blocker permits it. Passing
    // `noopener` makes window.open return null, leaving the tab stuck on
    // about:blank — keep the handle and sever the opener link manually instead.
    const w = window.open('about:blank', '_blank')
    if (w) w.opener = null
    pendingPopupRef.current = w
    const attempt = ++payLinkAttemptRef.current
    payLinkInFlightRef.current = true
    logger.log('[funding:cex] open pay-link', { sessionId: session.id, amount: fiatAmount, asset: destAssetLabel })
    const operationKey = `funding-pay-link:${session.id}:${fiatAmount}:${destAssetLabel ?? ''}`
    const operationLane = `funding-pay-link:${session.id}`
    const authSession = captureAuthSession()
    const operation = getOrCreatePersistentOperation({
      owner: client,
      key: operationKey,
      lane: operationLane,
      principalIsCurrent: authSession.isCurrent,
      start: () =>
        payLink({
          sessionId: session.id,
          clientSecret: session.clientSecret,
          amount: String(fiatAmount),
          ...(destAssetLabel ? { asset: destAssetLabel } : {}),
        }),
    })
    void operation.promise.then(
      (result) => {
        if (
          !authSession.isCurrent() ||
          !operation.isCurrent() ||
          payLinkAttemptRef.current !== attempt ||
          !pageActiveRef.current ||
          pendingPopupRef.current !== w
        ) {
          w?.close()
          return
        }
        payLinkInFlightRef.current = false
        clearPersistentOperation(client, operationKey)
        if ('error' in result) {
          w?.close()
          pendingPopupRef.current = null
          setError(result.error)
          return
        }
        if (!w) {
          pendingPopupRef.current = null
          setError(new FundingError('The Coinbase window was blocked. Allow popups and try again.'))
          return
        }
        w.location.href = result.url
        pendingPopupRef.current = null
        setOpened(true)
        getOrCreatePersistentOperation({
          owner: client,
          key: `funding-track-intent:${session.id}`,
          principalIsCurrent: authSession.isCurrent,
          start: async () => true,
          settledRetentionMs: 24 * 60 * 60 * 1000,
        })
        void track({ id: session.id, clientSecret: session.clientSecret })
      },
      (cause) => {
        if (
          !authSession.isCurrent() ||
          !operation.isCurrent() ||
          payLinkAttemptRef.current !== attempt ||
          !pageActiveRef.current ||
          pendingPopupRef.current !== w
        ) {
          w?.close()
          return
        }
        payLinkInFlightRef.current = false
        clearPersistentOperation(client, operationKey)
        w?.close()
        pendingPopupRef.current = null
        setError(cause instanceof Error ? cause : new FundingError('Failed to create a Coinbase pay link.'))
      }
    )
  }

  // Once the deposit lands, the session-status flow takes over the modal with the
  // success / refunded / expired screen (shared with the crypto rail).
  if (isDepositFlowActive(status)) return <DepositProgress status={status} />

  return (
    <PageContent onBack={routes.DEPOSIT}>
      <ModalHeading>Transfer from Exchange</ModalHeading>

      <TestnetNotice />

      <BigAmountRow>
        <BigAmountSymbol>$</BigAmountSymbol>
        <BigAmountInput
          value={amount}
          onChange={handleAmountChange}
          onBlur={handleAmountBlur}
          placeholder="0"
          inputMode="decimal"
          autoComplete="off"
          style={{ width: amountInputWidth(amount) }}
        />
      </BigAmountRow>
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        {amountTooLow ? (
          <span style={errorHelper}>Enter at least ${MIN_AMOUNT}.00 — the Coinbase minimum.</span>
        ) : (
          <span style={helperText}>Minimum ${MIN_AMOUNT}.00</span>
        )}
      </div>

      <MethodRowButton type="button" onClick={() => setRoute(routes.DEPOSIT)}>
        Other payment methods
        <Arrow width="11" height="10" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ArrowChevron
            stroke="currentColor"
            d="M7.51431 1.5L11.757 5.74264M7.5 10.4858L11.7426 6.24314"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Arrow>
      </MethodRowButton>

      {!isAvailable && <ModalBody>Funding isn't available right now.</ModalBody>}
      {!testnet && isAvailable && !chainSupported && (
        <ModalBody>Coinbase can't deliver to {destChainName} yet.</ModalBody>
      )}
      {!testnet && error && <ModalBody style={{ color: '#dc2626' }}>{toDisplayMessage(error)}</ModalBody>}

      <StepDivider>Then open an exchange</StepDivider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {EXCHANGES.map((ex) =>
          ex.comingSoon ? (
            <button
              key={ex.id}
              type="button"
              disabled
              style={{
                ...walletListBtn,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: 0.55,
                cursor: 'not-allowed',
              }}
            >
              <ButtonLogo>{EXCHANGE_LOGO[ex.id]}</ButtonLogo>
              <span>{titleCase(ex.id)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600 }}>Coming soon</span>
            </button>
          ) : testnet ? (
            // Blocked on testnet (Coinbase settles on mainnet). Use aria-disabled, not
            // `disabled`, so the hover still fires the tooltip that explains why.
            <Tooltip key={ex.id} message="Coinbase settles on mainnet — not available on testnet.">
              <button
                type="button"
                aria-disabled="true"
                style={{
                  ...walletListBtn,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: 0.55,
                  cursor: 'not-allowed',
                }}
              >
                <ButtonLogo>{EXCHANGE_LOGO[ex.id]}</ButtonLogo>
                {`Open ${titleCase(ex.id)} ↗`}
              </button>
            </Tooltip>
          ) : (
            <button
              key={ex.id}
              type="button"
              disabled={!payReady}
              style={{
                ...walletListBtn,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: payReady ? 1 : 0.55,
                cursor: payReady ? 'pointer' : 'not-allowed',
              }}
              onClick={openExchange}
            >
              <ButtonLogo>{EXCHANGE_LOGO[ex.id]}</ButtonLogo>
              {infraReady ? `Open ${titleCase(ex.id)} ↗` : 'Preparing…'}
            </button>
          )
        )}
      </div>

      {opened &&
        (status === 'waiting_payment' ? (
          <DepositStatus status={status} />
        ) : (
          <ModalBody style={{ marginTop: 12 }}>
            Finish in the Coinbase tab — we'll confirm here once your funds arrive.
          </ModalBody>
        ))}
    </PageContent>
  )
}

export default DepositCex
