'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import type { ChangeEvent, CSSProperties, ReactNode, SyntheticEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import logos from '../../../assets/logos'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useFunding } from '../../../hooks/openfort/useFunding'
import { useFundingChains } from '../../../hooks/openfort/useFundingChains'
import { invalidateBalance } from '../../../hooks/useBalance'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { logger } from '../../../utils/logger'
import { getPublishableKeyEnvironment } from '../../../utils/validation'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import Tooltip from '../../Common/Tooltip'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AmountCard, AmountInput, CurrencySymbol, PresetButton, PresetList, Section, SectionLabel } from '../Buy/styles'
import { CEX_CHAIN_NAMES, isCexDeliverable } from '../Deposit/cexChains'
import { DepositProgress, isDepositFlowActive } from '../Deposit/DepositProgress'
import { DepositStatus } from '../Deposit/DepositStatus'
import { walletListBtn } from '../Deposit/formStyles'
import { DEST_USDC, isSolana } from '../Deposit/sources'
import { ButtonLogo, StepDivider } from '../Deposit/styles'
import { TestnetNotice } from '../Deposit/TestnetNotice'
import { useFundingTarget } from '../Deposit/useFundingTarget'
import { sanitizeAmountInput, sanitizeForParsing } from '../Send/utils'

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
const PRESETS = [10, 25, 50]

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const helperText: CSSProperties = { fontSize: 12, color: 'var(--ck-body-color-muted, #6b7280)' }
const errorHelper: CSSProperties = { fontSize: 12, color: '#dc2626' }
const destinationRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, ...helperText }
const destinationLogo: CSSProperties = { width: 14, height: 14, borderRadius: '50%' }
const hideBrokenLogo = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none'
}

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
  const { triggerResize, publishableKey } = useOpenfort()
  // Coinbase onramp settles real funds on mainnet, so a test key can't deliver here.
  // Keep the button live for the demo but block the hand-off with a testnet notice.
  const testnet = getPublishableKeyEnvironment(publishableKey) === 'test'
  const target = useFundingTarget()
  // CEX (Coinbase pay-link + session) is served by the Openfort API, not the
  // standalone funding service — resolve this rail's base URL from the API backend.
  const { isAvailable, createSession, track, payLink, status } = useFunding({ useBackendUrl: true })
  const wallet = useEthereumEmbeddedWallet()
  const { embeddedAccounts } = useOpenfortCore()
  const { chains } = useFundingChains()

  const [amount, setAmount] = useState(String(MIN_AMOUNT))
  const [pressedPreset, setPressedPreset] = useState<number | null>(null)
  const [session, setSession] = useState<{ id: string; clientSecret: string } | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [opened, setOpened] = useState(false)

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
  const destAssetLogo = destAsset?.logo ?? null
  const destChainLogo = destChain?.logo ?? null

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
    createSessionRef
      .current({ chain: target.chain, currency: target.currency, address })
      .then((s) => {
        if (!cancelled) setSession({ id: s.id, clientSecret: s.clientSecret })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      })
    return () => {
      cancelled = true
      // Clear the key so a genuine destination change re-creates the session;
      // without this the guard above would block the retry after this cancel.
      sessionKey.current = ''
    }
  }, [isAvailable, address, chainSupported, testnet, target.chain, target.currency])

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
  useEffect(() => {
    triggerResize()
  }, [isAvailable, chainSupported, session, error, opened, amountTooLow, triggerResize])

  // Once the bound session settles, refresh balances so delivered funds show
  // without a manual reload.
  useEffect(() => {
    if (status === 'succeeded') invalidateBalance()
  }, [status])

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeAmountInput(event.target.value)
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setPressedPreset(null)
      setAmount(raw)
    }
  }

  const handleAmountBlur = () => {
    const normalized = sanitizeForParsing(sanitizeAmountInput(amount))
    if (!normalized) return
    const numeric = Number(normalized)
    if (Number.isFinite(numeric) && numeric > 0) setAmount(numeric.toFixed(2))
  }

  const handlePreset = (value: number) => {
    setPressedPreset(value)
    setAmount(value.toFixed(2))
  }

  const openExchange = () => {
    if (!session || fiatAmount === null || !amountValid) return
    // Open the tab up-front (sync) so the popup blocker permits it. Passing
    // `noopener` makes window.open return null, leaving the tab stuck on
    // about:blank — keep the handle and sever the opener link manually instead.
    const w = window.open('about:blank', '_blank')
    if (w) w.opener = null
    logger.log('[funding:cex] open pay-link', { sessionId: session.id, amount: fiatAmount, asset: destAssetLabel })
    void payLink({
      sessionId: session.id,
      clientSecret: session.clientSecret,
      amount: String(fiatAmount),
      ...(destAssetLabel ? { asset: destAssetLabel } : {}),
    })
      .then((url) => {
        if (!url) {
          w?.close() // no URL resolved — don't strand the popup on "undefined"
          return
        }
        if (w) w.location.href = url
        else window.location.assign(url) // popup blocked — fall back to this tab
        setOpened(true)
        // Watch the destination-bound session settle so the modal can show the
        // success / failed outcome instead of stranding the user on the form.
        if (session) void track({ id: session.id, clientSecret: session.clientSecret }).catch(() => {})
      })
      .catch((e) => {
        w?.close()
        setError(e instanceof Error ? e : new Error(String(e)))
      })
  }

  // Once the deposit lands, the session-status flow takes over the modal with the
  // success / refunded / expired screen (shared with the crypto rail).
  if (isDepositFlowActive(status)) return <DepositProgress status={status} />

  return (
    <PageContent onBack={routes.DEPOSIT}>
      <ModalHeading>Transfer from Exchange</ModalHeading>

      <TestnetNotice />

      <Section>
        <SectionLabel>Amount</SectionLabel>
        <AmountCard>
          <CurrencySymbol>$</CurrencySymbol>
          <AmountInput
            value={amount}
            onChange={handleAmountChange}
            onBlur={handleAmountBlur}
            placeholder="0.00"
            inputMode="decimal"
            autoComplete="off"
          />
        </AmountCard>
        <PresetList>
          {PRESETS.map((preset) => (
            <PresetButton
              key={preset}
              type="button"
              $active={pressedPreset === preset}
              onClick={() => handlePreset(preset)}
            >
              ${preset}
            </PresetButton>
          ))}
        </PresetList>
        {amountTooLow ? (
          <span style={errorHelper}>Enter at least ${MIN_AMOUNT}.00 — the Coinbase minimum.</span>
        ) : (
          <span style={helperText}>Minimum ${MIN_AMOUNT}.00</span>
        )}
        {chainSupported && (
          <span style={destinationRow}>
            {destAssetLogo && <img src={destAssetLogo} alt="" style={destinationLogo} onError={hideBrokenLogo} />}
            {destChainLogo && <img src={destChainLogo} alt="" style={destinationLogo} onError={hideBrokenLogo} />}
          </span>
        )}
      </Section>

      {!isAvailable && <ModalBody>Funding isn't available right now.</ModalBody>}
      {!testnet && isAvailable && !chainSupported && (
        <ModalBody>Coinbase can't deliver to {destChainName} yet.</ModalBody>
      )}
      {!testnet && error && <ModalBody style={{ color: '#dc2626' }}>{error.message}</ModalBody>}

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
